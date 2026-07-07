import base64, json, re, urllib.request, urllib.error
from pathlib import Path


def _file_to_base64(path):
    p = Path(path); s = p.suffix.lower()
    if s == '.pdf': mt = 'application/pdf'
    elif s in ('.jpg','.jpeg'): mt = 'image/jpeg'
    elif s == '.png': mt = 'image/png'
    elif s == '.webp': mt = 'image/webp'
    else: mt = 'image/jpeg'
    with open(path,'rb') as f: data = base64.b64encode(f.read()).decode()
    return data, mt


def _render_pages_fitz(file_path, max_pages=8, scale=3.0):
    """Render tung trang PDF thanh anh PNG 3x bang fitz. Tra ve [] neu khong co fitz."""
    try:
        import fitz
        doc = fitz.open(str(file_path))
        pages = []
        for i in range(min(len(doc), max_pages)):
            page = doc[i]
            mat = fitz.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            pages.append(pix.tobytes("png"))
        doc.close()
        return pages
    except Exception:
        return []


def _build_prompt(loai, date_mode='auto'):
    loai_text = "NHAP KHO" if loai == "NK" else "XUAT KHO"
    dt = "nha cung cap (NCC/NTP) da giao hang" if loai == "NK" else "noi nhan / cong trinh nhan hang"
    if date_mode == 'signature':
        dn = "Ngay: CHI lay tu vung chu ky (goc duoi phieu). Neu khong co thi de rong."
    elif date_mode == 'signature_priority':
        dn = "Ngay: UU TIEN lay tu vung chu ky (cuoi phieu). Neu khong co moi lay o dau phieu."
    else:
        dn = "Ngay dinh dang YYYY-MM-DD. Neu nam chi 2 chu so (vi du 26) thi them 2000. Neu khong ro thi de rong."
    return (
        f"Day la phieu {loai_text} cua cong ty xay dung HP Cons Viet Nam.\n"
        "Phieu co the viet tay, scan, hoac chu viet tay xen chu in — hay doc ky ca chu viet tay nho.\n"
        "Cau truc phieu gom: tieu de, so phieu, ngay, ten NCC/nguoi nhan, bang hang hoa chi tiet.\n"
        "Neu co ca Phieu Nhap Kho (PNK) va Phieu Giao Hang/Hoa Don NCC (PGH) trong file:\n"
        "  - Lay so_phieu, ngay, doi_tac tu PHIEU NHAP KHO\n"
        "  - Lay items (chi tiet hang hoa) UU TIEN tu PGH/hoa don (so lieu chinh xac hon)\n"
        "  - Neu khong co PGH thi lay items tu chinh PNK\n\n"
        "CHI TRA VE JSON THUAN, KHONG CO BAT KY TEXT NAO KHAC, KHONG MARKDOWN:\n"
        "{\"so_phieu\":\"\",\"ngay\":\"YYYY-MM-DD\",\"doi_tac\":\"\",\"ghi_chu\":\"\","
        "\"items\":[{\"ten_hang\":\"\",\"dvt\":\"\",\"so_luong\":0,\"don_gia\":0}]}\n"
        "Luu y quan trong:\n"
        f"- {dn}\n"
        f"- doi_tac = {dt}\n"
        "- ten_hang: giu nguyen tieng Viet co dau, day du thong so ky thuat (kich thuoc, mac, loai, quy cach)\n"
        "- dvt: don vi tinh (cai, met, kg, m2, m3, cuon, thanh, bo, hop...)\n"
        "- so_luong va don_gia la so thuc (don_gia = 0 neu khong co gia)\n"
        "- Trich xuat TAT CA hang hoa trong phieu, khong bo sot dong nao du it hay nhieu\n"
        "- Neu truong nao khong doc duoc ro, de chuoi rong (khong doan mo)"
    )


def _build_prompt_multi(loai, date_mode='auto'):
    """Prompt cho PDF nhieu phieu - tra ve JSON array"""
    loai_text = "NHAP KHO" if loai == "NK" else "XUAT KHO"
    dt = "nha cung cap (NCC/NTP)" if loai == "NK" else "noi nhan / cong trinh"
    if date_mode == 'signature':
        dn = "Ngay: CHI lay tu vung chu ky (goc duoi phieu)."
    elif date_mode == 'signature_priority':
        dn = "Ngay: UU TIEN lay tu vung chu ky, neu khong co moi lay o dau phieu."
    else:
        dn = "Ngay dinh dang YYYY-MM-DD. Neu nam 2 chu so thi them 2000."
    return (
        f"File nay chua nhieu bo phieu {loai_text} cua cong ty xay dung HP Cons Viet Nam.\n"
        "Moi bo gom: 1 PHIEU NHAP KHO (PNK) + 1 hoac nhieu PHIEU GIAO HANG/HOA DON NCC (PGH) ngay sau no.\n"
        "File co the viet tay, scan, chu viet tay xen chu in — hay doc ky ca chu viet tay nho.\n\n"
        "QUY TAC XAC DINH VA GHEP CAP:\n"
        "  - PNK: trang co chu 'Phieu Nhap Kho', 'PNK xxxx', 'NK xxxx' — trang chinh cua moi bo\n"
        "  - PGH/Hoa don: trang co chu 'Phieu Giao Hang', 'Hoa Don', 'Invoice', 'Delivery'...\n"
        "  - Moi PNK ghep voi tat ca PGH ngay sau no (truoc PNK tiep theo)\n\n"
        "VOI MOI BO PNK+PGH, tao 1 object JSON — lay thong tin theo nguon:\n"
        "  so_phieu : lay tu PNK (so PNK / PNK xxxx / NK xxxx)\n"
        "  ngay     : lay tu PNK\n"
        f"  doi_tac  : lay tu PNK — {dt}\n"
        "  items    : UU TIEN lay tu PGH/hoa don (chinh xac hon); neu khong co PGH thi lay tu PNK\n\n"
        "Tra ve JSON MANG, KHONG TEXT KHAC, KHONG MARKDOWN:\n"
        "[{\"so_phieu\":\"\",\"ngay\":\"YYYY-MM-DD\",\"doi_tac\":\"\",\"ghi_chu\":\"\","
        "\"items\":[{\"ten_hang\":\"\",\"dvt\":\"\",\"so_luong\":0,\"don_gia\":0}]}]\n"
        "Luu y quan trong:\n"
        f"  - {dn}\n"
        "  - ten_hang: giu nguyen tieng Viet co dau, day du thong so ky thuat, KHONG viet tat\n"
        "  - Trich xuat TAT CA hang hoa moi bo, khong bo sot dong nao\n"
        "  - Moi cap PNK+PGH = 1 phan tu mang. Chi co 1 cap → mang 1 phan tu"
    )


def _parse_json(text):
    """Parser manh: xu ly moi truong hop tra ve cua AI"""
    text = re.sub(r'```json|```', '', text).strip()
    for ch in ('{', '['):
        idx = text.find(ch)
        if idx >= 0:
            try:
                parsed, _ = json.JSONDecoder().raw_decode(text, idx)
                if isinstance(parsed, list):
                    parsed = {"items": parsed}
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass
    raise RuntimeError("AI khong tra ve JSON hop le. Thu lai hoac nhap tay.")


def _parse_json_list(text):
    """Parser cho multi-phieu: luon tra ve list"""
    text = re.sub(r'```json|```', '', text).strip()
    for ch in ('[', '{'):
        idx = text.find(ch)
        if idx >= 0:
            try:
                parsed, _ = json.JSONDecoder().raw_decode(text, idx)
                if isinstance(parsed, list):
                    return parsed
                if isinstance(parsed, dict):
                    return [parsed]
            except Exception:
                pass
    raise RuntimeError("AI khong tra ve JSON hop le. Thu lai hoac nhap tay.")


def _normalize(parsed):
    if not isinstance(parsed, dict): parsed = {}
    parsed.setdefault('so_phieu', '')
    parsed.setdefault('ngay', '')
    parsed.setdefault('doi_tac', '')
    parsed.setdefault('ghi_chu', '')
    items = parsed.get('items', [])
    if not isinstance(items, list): items = []
    parsed['items'] = items
    for it in items:
        if not isinstance(it, dict): continue
        it.setdefault('ten_hang', '')
        it.setdefault('dvt', 'cai')
        it.setdefault('so_luong', 0)
        it.setdefault('don_gia', 0)
        try: it['so_luong'] = float(it['so_luong'])
        except: it['so_luong'] = 0
        try: it['don_gia'] = float(it['don_gia'])
        except: it['don_gia'] = 0
    return parsed


def _build_content_parts(file_path, prompt):
    """
    Tao content parts cho API Claude:
    - Neu file la PDF va fitz co san: render tung trang 3x → list anh PNG (chat luong cao hon)
    - Nguoc lai: gui PDF goc hoac anh nguyen ban
    """
    p = Path(file_path)
    if p.suffix.lower() == '.pdf':
        pages = _render_pages_fitz(file_path, max_pages=8, scale=3.0)
        if pages:
            parts = []
            for png_data in pages:
                b64 = base64.b64encode(png_data).decode()
                parts.append({"type": "image",
                               "source": {"type": "base64", "media_type": "image/png", "data": b64}})
            parts.append({"type": "text", "text": prompt})
            return parts

    # Fallback: gui file goc
    b64, mt = _file_to_base64(file_path)
    if mt == 'application/pdf':
        cp = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    else:
        cp = {"type": "image", "source": {"type": "base64", "media_type": mt, "data": b64}}
    return [cp, {"type": "text", "text": prompt}]


def _call_claude_api(api_key, content_parts, max_tokens=8000):
    """Goi Claude API voi content parts da chuan bi san."""
    body = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": content_parts}]
    }).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
        headers={"Content-Type": "application/json", "x-api-key": api_key,
                 "anthropic-version": "2023-06-01"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        try: msg = json.loads(err).get('error', {}).get('message', err)
        except: msg = err
        raise RuntimeError(f"Claude API loi {e.code}: {msg}")
    return ''.join(c.get('text', '') for c in result.get('content', []))


def _claude(file_path, loai, api_key, date_mode='auto'):
    prompt = _build_prompt(loai, date_mode)
    parts = _build_content_parts(file_path, prompt)
    text = _call_claude_api(api_key, parts)
    return _normalize(_parse_json(text))


def _claude_multi(file_path, loai, api_key, date_mode='auto'):
    prompt = _build_prompt_multi(loai, date_mode)
    parts = _build_content_parts(file_path, prompt)
    text = _call_claude_api(api_key, parts)
    lst = _parse_json_list(text)
    return [_normalize(p) for p in lst if isinstance(p, dict)]


def _gemini(file_path, loai, api_key, date_mode='auto', model='gemini-1.5-flash'):
    """Goi Gemini API doc phieu. Model mac dinh: gemini-2.0-flash-lite"""
    b64, mt = _file_to_base64(file_path)
    prompt = _build_prompt(loai, date_mode)
    body = json.dumps({
        "contents": [{"parts": [
            {"inlineData": {"mimeType": mt, "data": b64}},
            {"text": prompt}
        ]}],
        "generationConfig": {"maxOutputTokens": 8000}
    }).encode()
    url = f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={api_key}"
    masked_key = (api_key[:6] + "..." + api_key[-4:]) if api_key and len(api_key) > 10 else "SHORT_KEY"
    print(f"[ai_reader] Goi Gemini model={model} | key={masked_key}")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        print(f"[ai_reader] Gemini HTTP {e.code}: {raw[:500]}")
        try:
            err_obj = json.loads(raw)
            msg = err_obj.get('error', {}).get('message', raw)
            status_str = err_obj.get('error', {}).get('status', '')
        except Exception:
            msg = raw
            status_str = ''
        if e.code == 429:
            print(f"[ai_reader] HET QUOTA Gemini model={model} — doi GEMINI_MODEL trong .env hoac cho reset quota")
            raise RuntimeError(f"Hết quota Gemini ({model}). Thử lại sau hoặc đổi model trong .env")
        raise RuntimeError(f"Gemini HTTP {e.code}{' (' + status_str + ')' if status_str else ''}: {msg}")
    try:
        text = result['candidates'][0]['content']['parts'][0]['text']
    except Exception:
        print(f"[ai_reader] Gemini response unexpected: {str(result)[:300]}")
        raise RuntimeError(f"Gemini tra ve ket qua khong hop le: {str(result)[:200]}")
    return _normalize(_parse_json(text))


def _gemini_multi(file_path, loai, api_key, date_mode='auto', model='gemini-1.5-flash'):
    """Goi Gemini API doc nhieu phieu. Tra ve list."""
    b64, mt = _file_to_base64(file_path)
    prompt = _build_prompt_multi(loai, date_mode)
    body = json.dumps({
        "contents": [{"parts": [
            {"inlineData": {"mimeType": mt, "data": b64}},
            {"text": prompt}
        ]}],
        "generationConfig": {"maxOutputTokens": 8000}
    }).encode()
    url = f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={api_key}"
    masked_key = (api_key[:6] + "..." + api_key[-4:]) if api_key and len(api_key) > 10 else "SHORT_KEY"
    print(f"[ai_reader] Goi Gemini multi model={model} | key={masked_key}")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        print(f"[ai_reader] Gemini HTTP {e.code}: {raw[:500]}")
        try:
            err_obj = json.loads(raw)
            msg = err_obj.get('error', {}).get('message', raw)
            status_str = err_obj.get('error', {}).get('status', '')
        except Exception:
            msg = raw
            status_str = ''
        if e.code == 429:
            print(f"[ai_reader] HET QUOTA Gemini multi model={model} — doi GEMINI_MODEL trong .env hoac cho reset quota")
            raise RuntimeError(f"Hết quota Gemini ({model}). Thử lại sau hoặc đổi model trong .env")
        raise RuntimeError(f"Gemini HTTP {e.code}{' (' + status_str + ')' if status_str else ''}: {msg}")
    try:
        text = result['candidates'][0]['content']['parts'][0]['text']
    except Exception:
        print(f"[ai_reader] Gemini multi response unexpected: {str(result)[:300]}")
        raise RuntimeError(f"Gemini tra ve ket qua khong hop le: {str(result)[:200]}")
    lst = _parse_json_list(text)
    return [_normalize(p) for p in lst if isinstance(p, dict)]


def _openai(file_path, loai, api_key, date_mode='auto', model='gpt-4o-mini'):
    """Goi OpenAI Vision API doc phieu. PDF render qua fitz truoc."""
    prompt = _build_prompt(loai, date_mode)
    p = Path(file_path)
    masked_key = (api_key[:7] + "..." + api_key[-4:]) if api_key and len(api_key) > 11 else "SHORT_KEY"
    print(f"[ai_reader] Goi OpenAI model={model} | key={masked_key}")

    # Build content: PDF → render PNG; anh → base64 truc tiep
    content = []
    if p.suffix.lower() == '.pdf':
        pages = _render_pages_fitz(file_path, max_pages=8, scale=3.0)
        if pages:
            for png_data in pages:
                b64 = base64.b64encode(png_data).decode()
                content.append({"type": "image_url",
                                 "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}})
        else:
            b64, _ = _file_to_base64(file_path)
            content.append({"type": "image_url",
                             "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"}})
    else:
        b64, mt = _file_to_base64(file_path)
        content.append({"type": "image_url",
                         "image_url": {"url": f"data:{mt};base64,{b64}", "detail": "high"}})
    content.append({"type": "text", "text": prompt})

    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 8000
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {api_key}"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        print(f"[ai_reader] OpenAI HTTP {e.code}: {raw[:500]}")
        try:
            msg = json.loads(raw).get('error', {}).get('message', raw)
        except Exception:
            msg = raw
        if e.code == 429:
            print(f"[ai_reader] HET QUOTA OpenAI model={model}")
            raise RuntimeError(f"Hết quota OpenAI ({model}). Kiểm tra billing tại platform.openai.com")
        if e.code in (401, 403):
            raise RuntimeError(f"OpenAI API key không hợp lệ (HTTP {e.code})")
        raise RuntimeError(f"OpenAI HTTP {e.code}: {msg}")
    try:
        text = result['choices'][0]['message']['content']
    except Exception:
        print(f"[ai_reader] OpenAI response unexpected: {str(result)[:300]}")
        raise RuntimeError(f"OpenAI trả về kết quả không hợp lệ: {str(result)[:200]}")
    return _normalize(_parse_json(text))


def _openai_multi(file_path, loai, api_key, date_mode='auto', model='gpt-4o-mini'):
    """Goi OpenAI Vision API doc nhieu phieu. Tra ve list."""
    prompt = _build_prompt_multi(loai, date_mode)
    p = Path(file_path)
    masked_key = (api_key[:7] + "..." + api_key[-4:]) if api_key and len(api_key) > 11 else "SHORT_KEY"
    print(f"[ai_reader] Goi OpenAI multi model={model} | key={masked_key}")

    content = []
    if p.suffix.lower() == '.pdf':
        pages = _render_pages_fitz(file_path, max_pages=16, scale=3.0)
        if pages:
            for png_data in pages:
                b64 = base64.b64encode(png_data).decode()
                content.append({"type": "image_url",
                                 "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}})
        else:
            b64, _ = _file_to_base64(file_path)
            content.append({"type": "image_url",
                             "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"}})
    else:
        b64, mt = _file_to_base64(file_path)
        content.append({"type": "image_url",
                         "image_url": {"url": f"data:{mt};base64,{b64}", "detail": "high"}})
    content.append({"type": "text", "text": prompt})

    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 8000
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {api_key}"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        print(f"[ai_reader] OpenAI multi HTTP {e.code}: {raw[:500]}")
        try:
            msg = json.loads(raw).get('error', {}).get('message', raw)
        except Exception:
            msg = raw
        if e.code == 429:
            print(f"[ai_reader] HET QUOTA OpenAI multi model={model}")
            raise RuntimeError(f"Hết quota OpenAI ({model}). Kiểm tra billing tại platform.openai.com")
        if e.code in (401, 403):
            raise RuntimeError(f"OpenAI API key không hợp lệ (HTTP {e.code})")
        raise RuntimeError(f"OpenAI HTTP {e.code}: {msg}")
    try:
        text = result['choices'][0]['message']['content']
    except Exception:
        print(f"[ai_reader] OpenAI multi response unexpected: {str(result)[:300]}")
        raise RuntimeError(f"OpenAI trả về kết quả không hợp lệ: {str(result)[:200]}")
    lst = _parse_json_list(text)
    return [_normalize(p) for p in lst if isinstance(p, dict)]


# ── Public API ────────────────────────────────────────────────

def doc_phieu(file_path: str, loai: str, api_key: str,
              provider: str = 'claude', date_mode: str = 'auto',
              model: str = 'gemini-1.5-flash') -> dict:
    """
    Doc 1 phieu tu file anh hoac PDF.
    provider: 'claude' hoac 'gemini'
    date_mode: 'auto' | 'signature' | 'signature_priority'
    model: Gemini model (doc tu GEMINI_MODEL trong .env)
    Tra ve dict: {so_phieu, ngay, doi_tac, ghi_chu, items[]}
    """
    if provider == 'gemini':
        return _gemini(file_path, loai, api_key, date_mode, model=model)
    if provider == 'openai':
        return _openai(file_path, loai, api_key, date_mode, model=model)
    return _claude(file_path, loai, api_key, date_mode)


def doc_phieu_multi(file_path: str, loai: str, api_key: str,
                    provider: str = 'claude', date_mode: str = 'auto',
                    model: str = 'gemini-1.5-flash') -> list:
    """
    Doc nhieu phieu tu 1 file PDF.
    model: Gemini model (doc tu GEMINI_MODEL trong .env)
    Tra ve list dict: [{so_phieu, ngay, doi_tac, ghi_chu, items[]}]
    """
    if provider == 'gemini':
        return _gemini_multi(file_path, loai, api_key, date_mode, model=model)
    if provider == 'openai':
        return _openai_multi(file_path, loai, api_key, date_mode, model=model)
    return _claude_multi(file_path, loai, api_key, date_mode)
