"""
supabase_client.py — Kết nối Supabase cho KhoUNICE Web Backend
Dùng urllib thuần (không cần thư viện ngoài) để gọi Supabase REST API
Load config từ environment variable thay vì file txt
"""
import json, urllib.request, urllib.error, os
from typing import Optional, Any
from dotenv import load_dotenv

load_dotenv()

# ── Load config từ environment variable ─────────────────────
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong environment")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def _request(method: str, path: str, data=None, params: str = "") -> list | dict:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += f"?{params}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"Supabase {method} {path}: {e.code} — {err}")


# ── CRUD helpers ──────────────────────────────────────────────

def select(table: str, query: str = "*", filters: str = "", order: str = "") -> list:
    params = f"select={query}"
    if filters: params += f"&{filters}"
    if order:   params += f"&order={order}"
    return _request("GET", table, params=params)


def insert(table: str, data: dict | list) -> list:
    return _request("POST", table, data=data)


def update(table: str, data: dict, filters: str) -> list:
    return _request("PATCH", table, data=data, params=filters)


def delete(table: str, filters: str) -> list:
    return _request("DELETE", table, params=filters)


def rpc(func: str, params: dict = None) -> Any:
    """Gọi Postgres function / stored procedure"""
    return _request("POST", f"rpc/{func}", data=params or {})


# ── Công trình ────────────────────────────────────────────────

def get_all_cong_trinh() -> list:
    return select("cong_trinh", order="ten_ct.asc")


def get_cong_trinh_by_ma(ma_ct: str) -> Optional[dict]:
    rows = select("cong_trinh", filters=f"ma_ct=eq.{ma_ct}")
    return rows[0] if rows else None


def get_cong_trinh_by_id(id: int) -> Optional[dict]:
    rows = select("cong_trinh", filters=f"id=eq.{id}")
    return rows[0] if rows else None


def upsert_cong_trinh(ma_ct: str, ten_ct: str, dia_chi: str = "", ghi_chu: str = "") -> dict:
    existing = get_cong_trinh_by_ma(ma_ct)
    if existing:
        rows = update("cong_trinh", {"ten_ct": ten_ct, "dia_chi": dia_chi},
                      filters=f"ma_ct=eq.{ma_ct}")
    else:
        rows = insert("cong_trinh", {"ma_ct": ma_ct, "ten_ct": ten_ct,
                                      "dia_chi": dia_chi, "ghi_chu": ghi_chu})
    return rows[0] if rows else {}


# ── Phiếu ─────────────────────────────────────────────────────

def get_phieu_list(cong_trinh_id: int = None, loai: str = None,
                   search: str = None, limit: int = 200,
                   offset: int = 0,
                   date_from: str = None, date_to: str = None) -> list:
    extra = ""
    if cong_trinh_id:
        extra += f"&cong_trinh_id=eq.{cong_trinh_id}"
    if loai:
        extra += f"&loai=eq.{loai}"
    if search:
        extra += f"&or=(so_phieu.ilike.*{search}*,doi_tac.ilike.*{search}*)"
    if date_from:
        extra += f"&ngay=gte.{date_from}"
    if date_to:
        extra += f"&ngay=lte.{date_to}"
    page_size = min(limit, 1000)
    rows = select("phieu", query="*",
                  filters=f"limit={page_size}&offset={offset}{extra}",
                  order="ngay.desc")
    return rows


def push_phieu(cong_trinh_id: int, local_id: int, loai: str, so_phieu: str,
               ngay: str, doi_tac: str, ghi_chu: str = "",
               tong_tien: float = 0, nguon: str = "web") -> Optional[int]:
    """Push 1 phiếu lên Supabase. Trả về id cloud hoặc None nếu đã tồn tại."""
    existing = select("phieu",
                      filters=f"cong_trinh_id=eq.{cong_trinh_id}&local_id=eq.{local_id}")
    if existing:
        return existing[0]["id"]
    rows = insert("phieu", {
        "cong_trinh_id": cong_trinh_id, "local_id": local_id,
        "loai": loai, "so_phieu": so_phieu, "ngay": ngay,
        "doi_tac": doi_tac, "ghi_chu": ghi_chu,
        "tong_tien": tong_tien, "nguon": nguon,
    })
    return rows[0]["id"] if rows else None


def create_phieu(cong_trinh_id: int, loai: str, so_phieu: str,
                 ngay: str, doi_tac: str, ghi_chu: str = "",
                 tong_tien: float = 0, nguon: str = "web") -> Optional[dict]:
    """Tạo phiếu mới, trả về dict phiếu vừa tạo."""
    rows = insert("phieu", {
        "cong_trinh_id": cong_trinh_id,
        "loai": loai, "so_phieu": so_phieu, "ngay": ngay,
        "doi_tac": doi_tac, "ghi_chu": ghi_chu,
        "tong_tien": tong_tien, "nguon": nguon,
    })
    return rows[0] if rows else None


def push_chi_tiet(phieu_cloud_id: int, items: list):
    """Push danh sách chi tiết phiếu lên Supabase."""
    if not items:
        return
    data = [{"phieu_id": phieu_cloud_id,
             "ten_hang": it.get("ten_hang", ""),
             "dvt": it.get("dvt", "cái"),
             "so_luong": it.get("so_luong", 0),
             "don_gia": it.get("don_gia", 0),
             "thanh_tien": it.get("thanh_tien", 0),
             "ghi_chu": it.get("ghi_chu", ""),
             "ma_hang": it.get("ma_hang", "")} for it in items]
    try:
        insert("chi_tiet_phieu", data)
    except RuntimeError:
        # Fallback: cột ma_hang chưa tồn tại (trước migration) — bỏ ma_hang
        data_fallback = [{k: v for k, v in d.items() if k != "ma_hang"} for d in data]
        insert("chi_tiet_phieu", data_fallback)


def delete_phieu(phieu_id: int):
    """Xóa phiếu và chi tiết phiếu theo id."""
    delete("chi_tiet_phieu", filters=f"phieu_id=eq.{phieu_id}")
    delete("phieu", filters=f"id=eq.{phieu_id}")


# ── Danh mục hàng hóa ────────────────────────────────────────

def get_all_hang_hoa(cong_trinh_id: int = None, search: str = None,
                     limit: int = 10000, offset: int = 0) -> list:
    """Lấy danh mục hàng hóa từ Supabase với pagination đầy đủ (vượt giới hạn 1000/page)."""
    # Build filter suffix cho CT và search
    extra = ""
    if cong_trinh_id:
        extra += f"&cong_trinh_id=eq.{cong_trinh_id}"
    if search:
        extra += f"&or=(ten_hang.ilike.*{search}*,ma_hang.ilike.*{search}*)"

    # Phân trang để vượt giới hạn 1000 rows/request của PostgREST
    page_size = 1000
    all_rows  = []
    cur_offset = offset
    while True:
        filters = f"limit={page_size}&offset={cur_offset}{extra}"
        rows = select("hang_hoa",
                      query="ma_hang,ten_hang,dvt,nhom,cong_trinh_id",
                      filters=filters,
                      order="nhom.asc,ten_hang.asc")
        all_rows.extend(rows)
        if len(rows) < page_size or len(all_rows) >= limit:
            break
        cur_offset += page_size
    return all_rows[:limit]


def create_hang_hoa(data: dict) -> Optional[dict]:
    rows = insert("hang_hoa", data)
    return rows[0] if rows else None


def update_hang_hoa(ma_hang: str, data: dict) -> Optional[dict]:
    rows = update("hang_hoa", data, filters=f"ma_hang=eq.{ma_hang}")
    return rows[0] if rows else None


def delete_hang_hoa(ma_hang: str):
    delete("hang_hoa", filters=f"ma_hang=eq.{ma_hang}")


# ── Tồn kho (từ view) ─────────────────────────────────────────

def get_ton_kho_all() -> list:
    """Lấy tồn kho tổng hợp tất cả công trình từ view v_ton_kho"""
    return select("v_ton_kho", order="ma_ct.asc,nhom.asc,ten_hang.asc")


def get_ton_kho_by_ct(cong_trinh_id: int = None, ma_ct: str = None) -> list:
    if cong_trinh_id:
        # v_ton_kho không có cột cong_trinh_id — lookup ma_ct từ bảng cong_trinh trước
        cts = select("cong_trinh", query="id,ma_ct", filters=f"id=eq.{cong_trinh_id}")
        if cts:
            _ma_ct = cts[0].get("ma_ct", "")
            if _ma_ct:
                return select("v_ton_kho", filters=f"ma_ct=eq.{_ma_ct}",
                              order="nhom.asc,ten_hang.asc")
        return []
    if ma_ct:
        return select("v_ton_kho", filters=f"ma_ct=eq.{ma_ct}",
                      order="nhom.asc,ten_hang.asc")
    return get_ton_kho_all()


def compute_ton_kho(cong_trinh_id: int = None) -> list:
    """
    Tính tồn kho trực tiếp từ phieu + chi_tiet_phieu.
    Enrich từ hang_hoa để lấy ma_hang + nhom chính xác.
    Hỗ trợ cả pre và post migration (cột ma_hang trong chi_tiet_phieu).
    """
    phieu_list = get_phieu_list(cong_trinh_id=cong_trinh_id, limit=10000)
    if not phieu_list:
        return []

    phieu_map = {p["id"]: p for p in phieu_list}
    phieu_ids = list(phieu_map.keys())

    # Probe một lần: chi_tiet_phieu có cột ma_hang chưa? (post-migration)
    has_ma_hang_col = False
    try:
        select("chi_tiet_phieu", query="ma_hang", filters="limit=1")
        has_ma_hang_col = True
    except RuntimeError:
        pass

    ct_query = "phieu_id,ten_hang,dvt,so_luong" + (",ma_hang" if has_ma_hang_col else "")

    # Lấy chi tiết theo batch 100 IDs
    chi_tiets: list = []
    for i in range(0, len(phieu_ids), 100):
        chunk = phieu_ids[i:i + 100]
        ids_str = ",".join(str(x) for x in chunk)
        rows = select("chi_tiet_phieu",
                      query=ct_query,
                      filters=f"phieu_id=in.({ids_str})")
        chi_tiets.extend(rows)

    if not chi_tiets:
        return []

    # Map CT → ma_ct
    ct_list = get_all_cong_trinh()
    ct_map = {ct["id"]: ct for ct in ct_list}

    # Load hang_hoa để enrich ma_hang + nhom (lookup by ten_hang + cong_trinh_id)
    hh_list = get_all_hang_hoa(cong_trinh_id=cong_trinh_id, limit=10000)
    hh_by_name: dict = {}   # (ten_hang_lower, cong_trinh_id) → hh
    hh_by_ma:   dict = {}   # (ma_hang, cong_trinh_id)        → hh
    for hh in hh_list:
        name_key = ((hh.get("ten_hang") or "").strip().lower(), hh.get("cong_trinh_id"))
        hh_by_name[name_key] = hh
        if hh.get("ma_hang"):
            hh_by_ma[(hh["ma_hang"], hh.get("cong_trinh_id"))] = hh

    # Group theo (group_key, cong_trinh_id)
    # group_key = ma_hang (ưu tiên) hoặc ten_hang (fallback)
    groups: dict = {}
    for row in chi_tiets:
        pid = row.get("phieu_id")
        p = phieu_map.get(pid, {})
        ct_id = p.get("cong_trinh_id")
        if not ct_id:
            continue
        ten_hang = (row.get("ten_hang") or "").strip()
        ma_hang_row = (row.get("ma_hang") or "").strip()  # từ chi_tiet (post-migration)
        if not ten_hang and not ma_hang_row:
            continue

        # Lookup hang_hoa: ưu tiên tìm theo ma_hang_row trước, fallback theo ten_hang
        if ma_hang_row:
            hh_info = hh_by_ma.get((ma_hang_row, ct_id)) or hh_by_name.get((ten_hang.lower(), ct_id), {})
        else:
            hh_info = hh_by_name.get((ten_hang.lower(), ct_id), {})

        # Xác định ma_hang cuối: từ catalog (ưu tiên) hoặc từ chi_tiet
        ma_hang = hh_info.get("ma_hang", "") or ma_hang_row
        # Group key thống nhất: dùng ma_hang nếu có, else ten_hang
        group_key = ma_hang if ma_hang else ten_hang
        key = (group_key, ct_id)

        if key not in groups:
            ct_info = ct_map.get(ct_id, {})
            groups[key] = {
                "ma_hang": ma_hang,
                "ten_hang": hh_info.get("ten_hang", ten_hang),
                "dvt": hh_info.get("dvt", "") or row.get("dvt") or "",
                "nhom": hh_info.get("nhom", "") or "",
                "cong_trinh_id": ct_id,
                "ma_ct": ct_info.get("ma_ct", ""),
                "tong_nhap": 0.0,
                "tong_xuat": 0.0,
            }
        loai = p.get("loai", "")
        sl = float(row.get("so_luong") or 0)
        if loai == "NK":
            groups[key]["tong_nhap"] += sl
        elif loai == "XK":
            groups[key]["tong_xuat"] += sl

    result = []
    for item in groups.values():
        item["ton_cuoi"] = item["tong_nhap"] - item["tong_xuat"]
        result.append(item)

    result.sort(key=lambda x: (x.get("nhom", ""), x.get("ten_hang", "")))
    return result


def update_phieu(phieu_id: int, data: dict) -> Optional[dict]:
    """Cập nhật header phiếu (ngay, doi_tac, ghi_chu, tong_tien)."""
    rows = update("phieu", data, filters=f"id=eq.{phieu_id}")
    return rows[0] if rows else None


def get_phieu_ids_by_ct(cong_trinh_id: int) -> list:
    """Lấy toàn bộ id phiếu của 1 công trình (có phân trang)."""
    ids, offset = [], 0
    while True:
        rows = select("phieu", query="id",
                      filters=f"cong_trinh_id=eq.{cong_trinh_id}&limit=1000&offset={offset}")
        ids.extend(r["id"] for r in rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return ids


def delete_chi_tiet_by_hang(cong_trinh_id: int, ten_hang: str) -> int:
    """
    Xóa mọi dòng chi tiết phiếu của 1 mặt hàng trong 1 công trình
    (dùng khi xóa hẳn 1 hàng khỏi tồn kho). Trả về số dòng đã xóa.
    """
    from urllib.parse import quote
    ids = [str(i) for i in get_phieu_ids_by_ct(cong_trinh_id)]
    if not ids:
        return 0
    ten_enc = quote(ten_hang, safe="")
    deleted = 0
    for i in range(0, len(ids), 100):
        chunk = ",".join(ids[i:i + 100])
        rows = delete("chi_tiet_phieu",
                      filters=f"phieu_id=in.({chunk})&ten_hang=eq.{ten_enc}")
        deleted += len(rows) if isinstance(rows, list) else 0
    return deleted


# ── Thống kê nhanh ────────────────────────────────────────────

def get_thong_ke_tong() -> dict:
    """Đếm nhanh số phiếu NK/XK và số công trình active"""
    cts = get_all_cong_trinh()
    phieus = select("phieu", query="loai,cong_trinh_id,tong_tien,ngay")
    nk = sum(1 for p in phieus if p["loai"] == "NK")
    xk = sum(1 for p in phieus if p["loai"] == "XK")
    tong_tien_nk = sum(p.get("tong_tien") or 0 for p in phieus if p["loai"] == "NK")
    tong_tien_xk = sum(p.get("tong_tien") or 0 for p in phieus if p["loai"] == "XK")
    return {
        "so_cong_trinh": len(cts),
        "so_phieu_nk": nk,
        "so_phieu_xk": xk,
        "tong_phieu": nk + xk,
        "tong_tien_nk": tong_tien_nk,
        "tong_tien_xk": tong_tien_xk,
    }


# ── Chi tiết phiếu ────────────────────────────────────────────

def get_chi_tiet_phieu(cloud_phieu_id: int) -> list:
    """Lấy danh sách hàng hóa của 1 phiếu theo cloud id."""
    return select("chi_tiet_phieu",
                  filters=f"phieu_id=eq.{cloud_phieu_id}",
                  order="id.asc")


def _fetch_all(table: str, query: str, order: str = "id.asc",
               page_size: int = 1000, max_rows: int = 100000) -> list:
    """Lấy toàn bộ dữ liệu với pagination — vượt qua giới hạn 1000 rows/lần."""
    all_rows = []
    offset   = 0
    while True:
        rows = select(table, query=query,
                      filters=f"limit={page_size}&offset={offset}",
                      order=order)
        all_rows.extend(rows)
        if len(rows) < page_size or len(all_rows) >= max_rows:
            break
        offset += page_size
    return all_rows


def get_all_chi_tiet() -> list:
    """Lấy toàn bộ chi tiết phiếu với pagination."""
    return _fetch_all(
        "chi_tiet_phieu",
        query="phieu_id,ten_hang,dvt,so_luong,don_gia,thanh_tien,ghi_chu",
        order="phieu_id.asc"
    )


def get_lich_su(phieu_list: list, limit: int = 20000) -> list:
    """
    Tạo lịch sử giao dịch — fetch chi_tiet_phieu THEO phieu_ids cụ thể.
    Nguyên tắc: mọi truy vấn Supabase phải lọc theo cong_trinh_id (qua phieu_ids).
    """
    if not phieu_list:
        return []
    phieu_map = {p["id"]: p for p in phieu_list if p.get("id")}
    phieu_ids = list(phieu_map.keys())
    if not phieu_ids:
        return []

    # Batch-fetch chi_tiet chỉ cho các phieu_ids thuộc CT đã lọc
    chi_tiets: list = []
    for i in range(0, len(phieu_ids), 100):
        chunk = phieu_ids[i:i + 100]
        ids_str = ",".join(str(x) for x in chunk)
        rows = select("chi_tiet_phieu",
                      query="phieu_id,ten_hang,dvt,so_luong,don_gia,thanh_tien,ghi_chu",
                      filters=f"phieu_id=in.({ids_str})")
        chi_tiets.extend(rows)

    result = []
    for r in chi_tiets:
        pid = r.get("phieu_id")
        p   = phieu_map.get(pid)
        if not p:
            continue
        result.append({
            "ten_hang":      r.get("ten_hang", ""),
            "dvt":           r.get("dvt", ""),
            "so_luong":      r.get("so_luong", 0),
            "don_gia":       r.get("don_gia", 0),
            "thanh_tien":    r.get("thanh_tien", 0),
            "ghi_chu":       r.get("ghi_chu", ""),
            "loai":          p.get("loai", ""),
            "so_phieu":      p.get("so_phieu", ""),
            "ngay":          p.get("ngay", ""),
            "doi_tac":       p.get("doi_tac", ""),
            "cong_trinh_id": p.get("cong_trinh_id"),
        })
    return result[:limit]


# ── Nhật ký hoạt động ────────────────────────────────────────

def log_activity(
    action: str,
    entity_type: str = "phieu",
    entity_id: str = "",
    details: str = "",
    user_email: str = "",
    cong_trinh_id=None,
):
    """Ghi nhật ký hành động. Không throw exception để không ảnh hưởng luồng chính."""
    try:
        data: dict = {
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else "",
            "details": details,
            "user_email": user_email or "",
        }
        if cong_trinh_id:
            data["cong_trinh_id"] = int(cong_trinh_id)
        insert("activity_log", data)
    except Exception:
        pass  # Log thất bại không được làm hỏng API chính


def get_activity_log(limit: int = 100, offset: int = 0,
                     action: Optional[str] = None,
                     cong_trinh_id: Optional[int] = None) -> list:
    """Lấy danh sách nhật ký hoạt động, mới nhất trước."""
    filters = f"limit={limit}&offset={offset}"
    if action:
        filters += f"&action=eq.{action}"
    if cong_trinh_id:
        filters += f"&cong_trinh_id=eq.{cong_trinh_id}"
    try:
        return select("activity_log", query="*", filters=filters, order="created_at.desc")
    except Exception:
        return []


# ── AI Config theo công trình ────────────────────────────────

def get_ai_config_by_ct(cong_trinh_id: int) -> Optional[dict]:
    """
    Lấy config AI của 1 công trình. Trả None nếu chưa có.
    QUAN TRỌNG: response chứa api_key_enc (đã mã hóa) — KHÔNG trả về frontend.
    Frontend chỉ nhận dạng masked từ router.
    """
    rows = select("project_ai_config",
                  filters=f"cong_trinh_id=eq.{cong_trinh_id}")
    return rows[0] if rows else None


def get_all_ai_configs() -> list:
    """Lấy tất cả config AI — dành cho admin view tổng hợp."""
    return select("project_ai_config",
                  order="cong_trinh_id.asc")


def create_ai_config(
    cong_trinh_id: int,
    provider: str = "gemini",
    api_key_enc: str = "",
    model: str = "",
    max_tokens: int = 4096,
    system_prompt: str = "",
    is_active: bool = False,
) -> Optional[dict]:
    """
    Tạo config AI mới cho 1 công trình.
    api_key_enc phải là ciphertext (đã qua encrypt_api_key) — không bao giờ plaintext.
    last_test_at / last_test_status / last_error để NULL — sẽ điền sau khi test kết nối.
    """
    data: dict = {
        "cong_trinh_id": cong_trinh_id,
        "provider":      provider,
        "is_active":     is_active,
        "max_tokens":    max_tokens,
    }
    if api_key_enc:    data["api_key_enc"]   = api_key_enc
    if model:          data["model"]         = model
    if system_prompt:  data["system_prompt"] = system_prompt
    rows = insert("project_ai_config", data)
    return rows[0] if rows else None


def update_ai_config_test_result(
    cong_trinh_id: int,
    status: str,          # 'ok' | 'error' | 'quota_exceeded'
    error_msg: str = "",
) -> Optional[dict]:
    """
    Ghi kết quả kiểm tra kết nối API vào DB.
    Gọi sau endpoint /test-connection — không gọi trực tiếp từ frontend.
    Nếu status='ok' → tự động set is_active=True và xóa last_error.
    """
    data: dict = {
        "last_test_at":     "now()",   # PostgreSQL NOW() qua REST
        "last_test_status": status,
        "last_error":       error_msg if status != "ok" else None,
    }
    if status == "ok":
        data["is_active"] = True
    rows = update("project_ai_config", data,
                  filters=f"cong_trinh_id=eq.{cong_trinh_id}")
    return rows[0] if rows else None


def update_ai_config(cong_trinh_id: int, data: dict) -> Optional[dict]:
    """
    Cập nhật config AI theo cong_trinh_id.
    Caller phải tự encrypt api_key trước khi truyền vào data["api_key_enc"].
    """
    rows = update("project_ai_config", data,
                  filters=f"cong_trinh_id=eq.{cong_trinh_id}")
    return rows[0] if rows else None


def delete_ai_config(cong_trinh_id: int):
    """
    Xóa config AI theo CT (hiếm dùng trực tiếp — CASCADE tự xóa khi CT bị xóa).
    """
    delete("project_ai_config",
           filters=f"cong_trinh_id=eq.{cong_trinh_id}")


def ensure_ai_config_exists(cong_trinh_id: int) -> dict:
    # Đảm bảo CT có ít nhất 1 config rỗng trong DB.
    existing = get_ai_config_by_ct(cong_trinh_id)
    if existing:
        return existing
    new_cfg = create_ai_config(cong_trinh_id=cong_trinh_id, is_active=False)
    return new_cfg or {}
