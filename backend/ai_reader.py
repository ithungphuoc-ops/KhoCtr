import base64, json, re, urllib.request, urllib.error
from pathlib import Path

MAX_IMAGES_PER_REQUEST = 6   # spec: 6 anh/request on dinh da model
PAGE_THRESHOLD = 8            # <= 8 trang → fitz inline; > 8 trang → batch/Files API


def _file_to_base64(path):
    p = Path(path); s = p.suffix.lower()
    if s == '.pdf': mt = 'application/pdf'
    elif s in ('.jpg','.jpeg'): mt = 'image/jpeg'
    elif s == '.png': mt = 'image/png'
    elif s == '.webp': mt = 'image/webp'
    else: mt = 'image/jpeg'
    with open(path,'rb') as f: data = base64.b64encode(f.read()).decode()
    return data, mt


def _count_pages_fitz(file_path):
    """Dem so trang PDF. Tra ve 0 neu khong co fitz."""
    try:
        import fitz
        doc = fitz.open(str(file_path))
        n = len(doc)
        doc.close()
        return n
    except Exception:
        return 0


def _render_pages_fitz(file_path, page_start=0, page_end=None, scale=2.5):
    """Render cac trang PDF tu page_start den page_end (exclusive). Tra ve list png bytes."""
    try:
        import fitz
        doc = fitz.open(str(file_path))
        total = len(doc)
        end = total if page_end is None else min(page_end, total)
        pages = []
        for i in range(page_start, end):
            page = doc[i]
            mat = fitz.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            pages.append(pix.tobytes("png"))
        doc.close()
        return pages
    except Exception:
        return []


def _call_with_retry(call_fn, max_retries=3):
    """Retry toi da max_retries lan. Neu van loi thi tra ve None (bo qua batch)."""
    last_err = None
    for attempt in range(max_retries):
        try:
            return call_fn()
        except Exception as e:
            last_err = e
            print(f"[ai_reader] Retry {attempt+1}/{max_retries}: {e}")
    print(f"[ai_reader] Bo qua batch sau {max_retries} lan that bai: {last_err}")
    return None


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


def _build_prompt_continuation(loai):
    """Prompt cho batch tiep theo cua CUNG MOT PHIEU — chi doc items, khong tao header moi."""
    loai_text = "NHAP KHO" if loai == "NK" else "XUAT KHO"
    return (
        f"Day la cac trang tiep theo cua CUNG MOT PHIEU {loai_text} da bat dau o trang truoc.\n"
        "KHONG tao so phieu moi. KHONG tao NCC moi. KHONG tao ngay moi.\n"
        "Chi doc cac dong hang hoa con lai tren cac trang nay.\n"
        "CHI TRA VE JSON MANG items, KHONG CO BAT KY TEXT NAO KHAC, KHONG MARKDOWN:\n"
        "[{\"ten_hang\":\"\",\"dvt\":\"\",\"so_luong\":0,\"don_gia\":0}]"
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
    Tao content parts cho API Claude (dung cho anh hoac PDF <= PAGE_THRESHOLD trang).
    PDF: render fitz → list PNG. Khac: gui file goc.
    """
    p = Path(file_path)
    if p.suffix.lower() == '.pdf':
        pages = _render_pages_fitz(file_path, scale=2.5)
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


def _png_list_to_parts(png_list):
    """Chuyen list png bytes thanh content parts cho Claude API."""
    parts = []
    for png_data in png_list:
        b64 = base64.b64encode(png_data).decode()
        parts.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}})
    return parts


def _claude_fitz_batched(file_path, loai, api_key, date_mode, total_pages):
    """
    Doc 1 phieu tu PDF nhieu trang: chia batch MAX_IMAGES_PER_REQUEST trang/lan.
    Batch dau: full prompt → lay header + items.
    Batch sau: continuation prompt → chi lay items.
    Merge theo thu tu batch (da dam bao thu tu vi range() chay tuan tu).
    Khong dedup — de nguoi dung kiem tra.
    """
    prompt_first = _build_prompt(loai, date_mode)
    prompt_cont = _build_prompt_continuation(loai)

    merged_header = {}
    all_items = []
    total_batches = (total_pages + MAX_IMAGES_PER_REQUEST - 1) // MAX_IMAGES_PER_REQUEST

    for batch_idx, batch_start in enumerate(range(0, total_pages, MAX_IMAGES_PER_REQUEST)):
        batch_end = min(batch_start + MAX_IMAGES_PER_REQUEST, total_pages)
        batch_num = batch_idx + 1
        print(f"[ai_reader] Batch {batch_num}/{total_batches}: trang {batch_start+1}-{batch_end}/{total_pages}")

        pages = _render_pages_fitz(file_path, page_start=batch_start, page_end=batch_end, scale=2.5)
        if not pages:
            continue

        is_first = (batch_idx == 0)
        prompt = prompt_first if is_first else prompt_cont
        parts = _png_list_to_parts(pages) + [{"type": "text", "text": prompt}]

        text = _call_with_retry(lambda p=parts: _call_claude_api(api_key, p))
        if text is None:
            continue

        try:
            if is_first:
                data = _normalize(_parse_json(text))
                merged_header = {k: v for k, v in data.items() if k != 'items'}
                all_items.extend(data.get('items', []))
            else:
                raw = re.sub(r'```json|```', '', text).strip()
                for ch in ('[', '{'):
                    pos = raw.find(ch)
                    if pos >= 0:
                        try:
                            parsed, _ = json.JSONDecoder().raw_decode(raw, pos)
                            if isinstance(parsed, list):
                                items = parsed
                            elif isinstance(parsed, dict):
                                items = parsed.get('items', [])
                            else:
                                items = []
                            for item in items:
                                if isinstance(item, dict):
                                    all_items.append(item)
                            break
                        except Exception:
                            pass
        except Exception as e:
            print(f"[ai_reader] Parse loi batch {batch_num}: {e}")

    result = dict(merged_header)
    result['items'] = all_items
    return _normalize(result)


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


# ── Anthropic Files API (cho PDF nhieu trang) ────────────────


def _build_multipart(file_path):
    """Build multipart/form-data body thu cong (urllib khong ho tro native)."""
    import uuid
    boundary = uuid.uuid4().hex
    p = Path(file_path)
    with open(file_path, 'rb') as f:
        file_data = f.read()
    mime = 'application/pdf' if p.suffix.lower() == '.pdf' else 'image/jpeg'
    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{p.name}"\r\n'
        f'Content-Type: {mime}\r\n'
        f'\r\n'
    ).encode() + file_data + f'\r\n--{boundary}--\r\n'.encode()
    return body, f'multipart/form-data; boundary={boundary}'


def _upload_to_claude_files_api(file_path, api_key):
    """
    Upload file len Anthropic Files API. Tra ve file_id.
    Dung cho file 5MB - 32MB de tranh loi 413 khi gui base64 inline.
    """
    body, content_type = _build_multipart(file_path)
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/files',
        data=body,
        headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'files-api-2025-04-14',
            'Content-Type': content_type,
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            result = json.loads(r.read())
        file_id = result.get('id') or result.get('file_id')
        if not file_id:
            raise RuntimeError(f"Files API khong tra ve file_id: {result}")
        print(f"[ai_reader] Files API upload OK: {file_id}")
        return file_id
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        try: msg = json.loads(err).get('error', {}).get('message', err)
        except: msg = err
        raise RuntimeError(f"Files API upload loi {e.code}: {msg}")


def _delete_claude_file(file_id, api_key):
    """Xoa file sau khi dung xong - giu sach quota."""
    try:
        req = urllib.request.Request(
            f'https://api.anthropic.com/v1/files/{file_id}',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'anthropic-beta': 'files-api-2025-04-14',
            },
            method='DELETE'
        )
        urllib.request.urlopen(req, timeout=15)
        print(f"[ai_reader] Files API delete OK: {file_id}")
    except Exception as e:
        print(f"[ai_reader] Files API delete warning: {e}")


def _call_claude_api_with_beta(api_key, content_parts, max_tokens=8000):
    """Goi Claude API voi Files API beta header (dung khi co file_id)."""
    body = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": content_parts}]
    }).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "files-api-2025-04-14",
        },
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


def _build_content_parts_with_file_id(file_path, file_id, prompt):
    """Tao content parts dung file_id tu Files API (thay the base64 inline)."""
    p = Path(file_path)
    if p.suffix.lower() == '.pdf':
        doc_part = {"type": "document", "source": {"type": "file", "file_id": file_id}}
    else:
        doc_part = {"type": "image", "source": {"type": "file", "file_id": file_id}}
    return [doc_part, {"type": "text", "text": prompt}]


def _claude(file_path, loai, api_key, date_mode='auto'):
    """Doc 1 phieu: <= PAGE_THRESHOLD trang → fitz inline; > PAGE_THRESHOLD → fitz batch."""
    p = Path(file_path)
    prompt = _build_prompt(loai, date_mode)

    if p.suffix.lower() == '.pdf':
        total_pages = _count_pages_fitz(file_path)
        print(f"[ai_reader] PDF {p.name}: {total_pages} trang")

        if total_pages > PAGE_THRESHOLD:
            print(f"[ai_reader] > {PAGE_THRESHOLD} trang → fitz batch (1 phieu)")
            return _claude_fitz_batched(file_path, loai, api_key, date_mode, total_pages)

        if total_pages > 0:
            print(f"[ai_reader] <= {PAGE_THRESHOLD} trang → fitz inline")
            pages = _render_pages_fitz(file_path, page_end=total_pages, scale=2.5)
            if pages:
                parts = _png_list_to_parts(pages) + [{"type": "text", "text": prompt}]
                text = _call_with_retry(lambda: _call_claude_api(api_key, parts))
                if text:
                    return _normalize(_parse_json(text))

    # Fallback: anh hoac PDF khong dem duoc trang
    parts = _build_content_parts(file_path, prompt)
    text = _call_with_retry(lambda: _call_claude_api(api_key, parts))
    if not text:
        raise RuntimeError("Khong the goi Claude API sau nhieu lan thu. Thu lai sau.")
    return _normalize(_parse_json(text))


def _claude_multi(file_path, loai, api_key, date_mode='auto'):
    """
    Doc nhieu phieu tu 1 PDF:
    <= PAGE_THRESHOLD trang → fitz inline.
    > PAGE_THRESHOLD trang → Files API (AI doc toan bo PDF, nhan dien tat ca phieu).
    """
    p = Path(file_path)
    prompt = _build_prompt_multi(loai, date_mode)

    if p.suffix.lower() == '.pdf':
        total_pages = _count_pages_fitz(file_path)
        print(f"[ai_reader] PDF multi {p.name}: {total_pages} trang")

        if total_pages > PAGE_THRESHOLD:
            print(f"[ai_reader] > {PAGE_THRESHOLD} trang → Files API (multi-phieu)")
            file_id = _upload_to_claude_files_api(file_path, api_key)
            try:
                parts = _build_content_parts_with_file_id(file_path, file_id, prompt)
                text = _call_with_retry(lambda: _call_claude_api_with_beta(api_key, parts))
            finally:
                _delete_claude_file(file_id, api_key)
            if not text:
                raise RuntimeError("Khong the goi Claude API sau nhieu lan thu. Thu lai sau.")
            lst = _parse_json_list(text)
            return [_normalize(q) for q in lst if isinstance(q, dict)]

        if total_pages > 0:
            print(f"[ai_reader] <= {PAGE_THRESHOLD} trang → fitz inline (multi-phieu)")
            pages = _render_pages_fitz(file_path, page_end=total_pages, scale=2.5)
            if pages:
                parts = _png_list_to_parts(pages) + [{"type": "text", "text": prompt}]
                text = _call_with_retry(lambda: _call_claude_api(api_key, parts))
                if text:
                    lst = _parse_json_list(text)
                    return [_normalize(q) for q in lst if isinstance(q, dict)]

    # Fallback
    parts = _build_content_parts(file_path, prompt)
    text = _call_with_retry(lambda: _call_claude_api(api_key, parts))
    if not text:
        raise RuntimeError("Khong the goi Claude API sau nhieu lan thu. Thu lai sau.")
    lst = _parse_json_list(text)
    return [_normalize(q) for q in lst if isinstance(q, dict)]


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
        pages = _render_pages_fitz(file_path, page_end=PAGE_THRESHOLD, scale=2.5)
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
        pages = _render_pages_fitz(file_path, page_end=PAGE_THRESHOLD * 2, scale=2.5)
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
