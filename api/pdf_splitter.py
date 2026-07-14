"""
pdf_splitter.py v4 — Tích hợp logic từ skill luu-nhap-kho / luu-xuat-kho
- Dùng fitz render 3x PNG (nếu có) → AI đọc chữ viết tay tốt hơn nhiều
- Text-extraction trước (miễn phí) → chỉ gọi AI khi cần
- Tên file chuẩn: NK4914.pdf + PGH NK4914.pdf (theo skill)
- Xuất kho: XK4758.pdf theo đúng structure
- Dùng Sonnet cho page classification → chính xác hơn
"""
import io, shutil, base64, json, re, urllib.request, urllib.error
from pathlib import Path

# ── Inline thay vì import file_manager ───────────────────────
THANG_VI = {
    1: "THÁNG 01", 2: "THÁNG 02", 3: "THÁNG 03",
    4: "THÁNG 04", 5: "THÁNG 05", 6: "THÁNG 06",
    7: "THÁNG 07", 8: "THÁNG 08", 9: "THÁNG 09",
    10: "THÁNG 10", 11: "THÁNG 11", 12: "THÁNG 12",
}

def _safe_name(s: str) -> str:
    for c in r'\/:*?"<>|':
        s = s.replace(c, '_')
    return s.strip() or "Khac"


# ── Render trang thành ảnh PNG 3x (dùng fitz nếu có) ─────────
def _render_page_png(src_path: str, page_idx: int, scale: float = 3.0):
    """Render trang PDF thành PNG 3x. Trả None nếu không có fitz."""
    try:
        import fitz
        doc = fitz.open(src_path)
        page = doc[page_idx]
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        data = pix.tobytes("png")
        doc.close()
        return data
    except Exception:
        return None


# ── Extract text từ trang (pypdf, miễn phí) ──────────────────
def _extract_text(reader, page_idx: int) -> str:
    try:
        return (reader.pages[page_idx].extract_text() or '').lower()
    except Exception:
        return ''


# ── Nhận diện loại trang từ text ─────────────────────────────
def _page_type_from_text(text: str) -> str:
    if any(k in text for k in ['phiếu nhập kho', 'phieu nhap kho', 'pnk', 'nhập kho']):
        return 'PNK'
    if any(k in text for k in ['phiếu giao nhận', 'phieu giao nhan', 'pgn',
                                'phiếu giao hàng', 'phieu giao hang', 'pgh',
                                'biên bản giao hàng', 'bien ban giao hang', 'bbgh',
                                'delivery', 'hóa đơn', 'invoice']):
        return 'PGH'
    if any(k in text for k in ['phiếu xuất kho', 'phieu xuat kho', 'pxk', 'xuất kho']):
        return 'PXK'
    return 'OTHER'


# ── Chuẩn hóa tên file theo skill ────────────────────────────
def _short_so(so: str, loai: str) -> str:
    """PNK4914 → NK4914, PXK4758 → XK4758, NK-2026-001 → NK001"""
    if not so:
        return ''
    m = re.search(r'(\d{3,6})', so)
    num = m.group(1) if m else re.sub(r'[^A-Za-z0-9]', '', so)[:8]
    prefix = 'NK' if loai == 'NK' else 'XK'
    return f"{prefix}{num}"


# ── Gọi AI nhận diện 1 trang (Sonnet để nhận diện chính xác) ───
def _ai_read_page(page_data: bytes, media_type: str, api_key: str,
                  page_num: int, loai: str) -> dict:
    loai_hint = "NHAP KHO" if loai == 'NK' else "XUAT KHO"
    prompt = (
        f"Day la trang {page_num} trong bo phieu {loai_hint} cong ty xay dung HP Cons Viet Nam.\n"
        "Phieu co the viet tay, scan, hoac chu viet tay xen chu in — hay doc ky.\n"
        "Xac dinh loai trang theo noi dung:\n"
        "- PNK: co chu 'Phieu Nhap Kho', 'PNK', hoac bang hang hoa co cot Nhap\n"
        "- PGH: co chu 'Phieu Giao Hang', 'Phieu Giao Nhan', 'Hoa Don', 'PGH', 'Invoice'\n"
        "- PXK: co chu 'Phieu Xuat Kho', 'PXK'\n"
        "- OTHER: khong xac dinh duoc hoac trang trong\n"
        "Doc chu viet tay de lay so phieu (dang NK/PNK xxxx), ngay (DD/MM/YYYY), ten NCC.\n"
        "Tra ve JSON thuan, KHONG markdown:\n"
        "{\"loai\":\"PNK|PGH|PXK|OTHER\","
        "\"so_phieu\":\"so phieu day du vi du NK4914\","
        "\"ngay\":\"DD/MM/YYYY\","
        "\"ncc\":\"ten NCC hoac nguoi nhan day du\"}"
    )
    b64 = base64.b64encode(page_data).decode()
    if media_type == 'application/pdf':
        cp = {"type": "document",
              "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    else:
        cp = {"type": "image",
              "source": {"type": "base64", "media_type": media_type, "data": b64}}

    body = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 400,
        "messages": [{"role": "user", "content": [cp, {"type": "text", "text": prompt}]}]
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"Content-Type": "application/json",
                 "x-api-key": api_key, "anthropic-version": "2023-06-01"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read())
        text = ''.join(c.get('text', '') for c in result.get('content', []))
        text = re.sub(r'```json|```', '', text).strip()
        return json.loads(text)
    except Exception as e:
        return {"loai": "OTHER", "so_phieu": "", "ngay": "", "ncc": str(e)}


# ── Tạo folder đích ───────────────────────────────────────────
def _make_folder(ngay: str, ncc: str, loai_folder: str, root: str = None) -> Path:
    from datetime import datetime
    now = datetime.now()
    root_dir = Path(root) if root else Path.cwd() / "split_output"
    try:
        if '/' in str(ngay):
            d, m, y = str(ngay).split('/')
        else:
            y, m, d = str(ngay).split('-')
        nam, thang, ngay_num = int(y), int(m), int(d)
        if nam < 100:
            nam += 2000
        if not (2020 <= nam <= 2050):
            nam = now.year
        if not (1 <= thang <= 12) or not (1 <= ngay_num <= 31):
            thang, ngay_num = now.month, now.day
    except Exception:
        nam, thang, ngay_num = now.year, now.month, now.day

    thang_folder = THANG_VI.get(thang, f"THÁNG {thang:02d}")
    ngay_folder  = f"{ngay_num:02d}.{thang:02d}"
    doi_tac_folder = _safe_name(ncc).upper() if ncc else "KHONG_RO_NCC"

    folder = root_dir / str(nam) / loai_folder / thang_folder / ngay_folder / doi_tac_folder
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _unique_path(p: Path) -> Path:
    if not p.exists():
        return p
    stem, suffix = p.stem, p.suffix
    c = 1
    while True:
        np = p.parent / f"{stem}_{c}{suffix}"
        if not np.exists():
            return np
        c += 1


# ── HÀM CHÍNH ────────────────────────────────────────────────
def split_and_save(src_path: str, loai: str, so_phieu: str,
                   ngay: str, doi_tac: str,
                   root: str = None, api_key: str = '') -> dict:
    """
    Tách PDF theo logic skill luu-nhap-kho / luu-xuat-kho:
    NK: PNK + PGH(s) → NK[số].pdf + PGH NK[số].pdf
    XK: mỗi trang = XK[số].pdf
    Ưu tiên fitz 3x image → text extract → AI (Sonnet)

    Returns:
        dict với keys:
          - saved: list[{type, path, so_phieu}]
          - folder: str — thư mục lưu đầu tiên
          - summary: str — mô tả kết quả
    """
    src = Path(src_path)
    ext = src.suffix.lower()
    loai_folder = "Nhập Kho" if loai == 'NK' else "Xuất Kho"
    result = {'saved': [], 'folder': '', 'summary': ''}

    # Không phải PDF → lưu nguyên 1 file
    if ext != '.pdf':
        folder = _make_folder(ngay, doi_tac, loai_folder, root)
        so_s = _short_so(so_phieu, loai) or _safe_name(so_phieu) or 'phieu'
        dst = _unique_path(folder / f"{so_s}{ext}")
        shutil.copy2(src, dst)
        result.update({'saved': [{'type': loai, 'path': str(dst), 'so_phieu': so_phieu}],
                       'folder': str(folder), 'summary': f"Lưu 1 file: {dst.name}"})
        return result

    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        folder = _make_folder(ngay, doi_tac, loai_folder, root)
        so_s = _short_so(so_phieu, loai) or _safe_name(so_phieu) or 'phieu'
        dst = _unique_path(folder / f"{so_s}.pdf")
        shutil.copy2(src, dst)
        result.update({'saved': [{'type': loai, 'path': str(dst), 'so_phieu': so_phieu}],
                       'folder': str(folder), 'summary': "pypdf chưa cài — lưu file nguyên"})
        return result

    reader  = PdfReader(str(src))
    n_pages = len(reader.pages)

    # Kiểm tra fitz có dùng được không (1 lần)
    fitz_ok = _render_page_png(str(src), 0) is not None

    # ── Nhận diện từng trang ─────────────────────────────────
    page_infos = []
    for i in range(n_pages):
        text  = _extract_text(reader, i)
        ptype = _page_type_from_text(text)

        info = {}
        # Gọi AI khi text không nhận diện được và có API key
        if ptype == 'OTHER' and api_key:
            if fitz_ok:
                png = _render_page_png(str(src), i, scale=3.0)
                data, mt = png, 'image/png'
            else:
                w = PdfWriter(); w.add_page(reader.pages[i])
                buf = io.BytesIO(); w.write(buf)
                data, mt = buf.getvalue(), 'application/pdf'
            info = _ai_read_page(data, mt, api_key, i + 1, loai)
            ptype = info.get('loai', 'OTHER')

        page_infos.append({
            'page_idx': i,
            'loai':     ptype,
            'so_phieu': info.get('so_phieu', '') or so_phieu,
            'ngay':     info.get('ngay', '')     or ngay,
            'ncc':      info.get('ncc', '')      or doi_tac,
        })

    # ── Ghép nhóm ────────────────────────────────────────────
    groups = []
    if loai == 'NK':
        cur = None
        for inf in page_infos:
            t = inf['loai']
            if t == 'PNK':
                if cur: groups.append(cur)
                cur = {'pnk': inf, 'pghs': []}
            else:  # PGH hoặc OTHER → gắn vào nhóm hiện tại
                if cur:
                    cur['pghs'].append(inf)
                else:
                    groups.append({'pnk': None, 'pghs': [inf]})
        if cur: groups.append(cur)
    else:  # XK: mỗi trang = 1 phiếu riêng
        for inf in page_infos:
            groups.append({'pnk': inf, 'pghs': []})

    # ── Lưu file ─────────────────────────────────────────────
    for g_idx, group in enumerate(groups):
        pnk  = group.get('pnk')
        pghs = group.get('pghs', [])

        g_so_raw  = (pnk or {}).get('so_phieu') or so_phieu or f"{'NK' if loai=='NK' else 'XK'}{g_idx+1:03d}"
        g_ngay    = (pnk or {}).get('ngay')     or ngay
        g_ncc     = (pnk or {}).get('ncc')      or doi_tac
        g_so_file = _short_so(g_so_raw, loai) or _safe_name(g_so_raw)

        folder = _make_folder(g_ngay, g_ncc, loai_folder, root)
        if not result['folder']:
            result['folder'] = str(folder)

        # File chính: NK4914.pdf hoặc XK4758.pdf
        if pnk:
            w = PdfWriter()
            w.add_page(reader.pages[pnk['page_idx']])
            path = _unique_path(folder / f"{g_so_file}.pdf")
            with open(path, 'wb') as f: w.write(f)
            result['saved'].append({'type': loai, 'path': str(path), 'so_phieu': g_so_raw})

        # PGH: gộp tất cả trang PGH → "PGH NK4914.pdf" (chỉ NK)
        if pghs and loai == 'NK':
            w2 = PdfWriter()
            for pgh in pghs:
                w2.add_page(reader.pages[pgh['page_idx']])
            path2 = _unique_path(folder / f"PGH {g_so_file}.pdf")
            with open(path2, 'wb') as f: w2.write(f)
            result['saved'].append({'type': 'PGH', 'path': str(path2), 'so_phieu': g_so_raw})

    # ── Summary ──────────────────────────────────────────────
    n_main = sum(1 for s in result['saved'] if s['type'] != 'PGH')
    n_pgh  = sum(1 for s in result['saved'] if s['type'] == 'PGH')
    if loai == 'NK':
        result['summary'] = (
            f"Tách {n_pages} trang → {n_main} phiếu NK + {n_pgh} phiếu PGH"
        )
    else:
        result['summary'] = f"Tách {n_pages} trang → {n_main} phiếu XK"

    return result
