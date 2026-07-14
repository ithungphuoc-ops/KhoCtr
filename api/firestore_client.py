"""
firestore_client.py — Kết nối Firebase Firestore cho KhoUNICE Web Backend
Thay thế supabase_client.py. Giữ nguyên chữ ký mọi hàm (select/insert/update/delete
+ toàn bộ hàm nghiệp vụ) để các router không phải sửa logic, chỉ đổi import.

Chiến lược ID (khớp design.md):
- Bảng có FK/tra cứu theo id số nguyên (cong_trinh, phieu, app_users, ghi_chu):
  doc ID Firestore = str(id), field "id" = int, sinh tự động qua counter transaction
  (giữ hành vi SERIAL của Postgres) — trong lúc migrate dữ liệu thật, ID cũ được
  giữ nguyên làm doc ID + field id, và counter được seed = max(id) + 1.
- Bảng có khóa tự nhiên (hang_hoa.ma_hang, project_ai_config.cong_trinh_id):
  doc ID = giá trị khóa đó, không cần counter.
- Bảng còn lại (chi_tiet_phieu, activity_log, user_congtrinh): doc ID tự sinh
  (Firestore auto-id), không có field "id" ý nghĩa nghiệp vụ nào phụ thuộc vào.

Chiến lược filter (khớp cú pháp mini-PostgREST đang dùng trong toàn bộ router):
Chỉ hỗ trợ đúng tập toán tử đang thực sự được dùng trong codebase này
(eq, gte, lte, gt, lt, in, is.null, ilike, or=(...), limit, offset) — KHÔNG
phải toàn bộ PostgREST. Cách làm: đọc cả collection vào bộ nhớ rồi lọc bằng
Python (giống tinh thần compute_ton_kho() đã làm) — đơn giản, dễ đúng, đủ
nhanh cho quy mô dữ liệu 1 kho công trình. Có thể tối ưu bằng Firestore
composite index sau nếu cần (xem openspec task 3.4).
"""
import os
import json
import time
from functools import lru_cache
from typing import Optional
from datetime import datetime, timezone
from urllib.parse import unquote

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import transactional

APP_NAME = "khoctr"

_app = None


def _get_app():
    global _app
    if _app is None:
        sa_json = os.getenv("KHOCTR_FIREBASE_SERVICE_ACCOUNT", "")
        if not sa_json:
            raise RuntimeError("Thiếu KHOCTR_FIREBASE_SERVICE_ACCOUNT trong environment")
        cred = credentials.Certificate(json.loads(sa_json))
        try:
            _app = firebase_admin.get_app(APP_NAME)
        except ValueError:
            _app = firebase_admin.initialize_app(cred, name=APP_NAME)
    return _app


def _db():
    return firestore.client(app=_get_app())


# ── Doc-ID strategy per collection ──────────────────────────────
COUNTER_TABLES = {"cong_trinh", "phieu", "app_users", "ghi_chu"}
NATURAL_KEY_FIELD = {"hang_hoa": "ma_hang", "project_ai_config": "cong_trinh_id"}


@transactional
def _increment_txn(transaction, counter_ref):
    snapshot = counter_ref.get(transaction=transaction)
    current = snapshot.get("value") if snapshot.exists else 0
    next_val = int(current) + 1
    transaction.set(counter_ref, {"value": next_val})
    return next_val


def _next_id(table: str) -> int:
    """Sinh id số nguyên tăng dần, thay SERIAL của Postgres."""
    counter_ref = _db().collection("_counters").document(table)
    transaction = _db().transaction()
    return _increment_txn(transaction, counter_ref)


def _resolve_doc_id(table: str, data: dict) -> tuple[str, dict]:
    """
    Trả về (doc_id, data_đã_bổ_sung_id_nếu_cần) cho 1 bản ghi mới.
    KHÔNG override nếu data đã có id/khóa tự nhiên (dùng khi migrate dữ liệu thật,
    giữ nguyên ID cũ).
    """
    if table in COUNTER_TABLES:
        if data.get("id") is not None:
            doc_id = str(data["id"])
        else:
            new_id = _next_id(table)
            data = {**data, "id": new_id}
            doc_id = str(new_id)
        return doc_id, data

    if table in NATURAL_KEY_FIELD:
        key_field = NATURAL_KEY_FIELD[table]
        key_val = data.get(key_field)
        if not key_val:
            raise ValueError(f"{table}: thiếu '{key_field}' — bắt buộc làm doc ID")
        return str(key_val), data

    # Auto-id: để Firestore tự sinh
    doc_ref = _db().collection(table).document()
    return doc_ref.id, data


# ── Filter parser (subset PostgREST-style đang dùng trong repo) ─

def _parse_condition(cond: str):
    """'field=op.value' hoặc 'field.op.value' (dùng trong or=(...)) → (field, op, value)."""
    if "=" in cond:
        field, rest = cond.split("=", 1)
    else:
        field, rest = cond.split(".", 1)
    if "." in rest:
        op, value = rest.split(".", 1)
    else:
        op, value = "eq", rest
    return field, op, unquote(value)


@lru_cache(maxsize=64)
def _in_opts(value: str) -> frozenset:
    return frozenset(value.strip("()").split(","))


def _match_value(row_val, op: str, value: str, field: str = "") -> bool:
    # 'id=gte.0' trong codebase này chỉ có 1 ý nghĩa thực tế: xoá/khớp TOÀN BỘ bản ghi
    # (vd save_permissions xoá sạch user_congtrinh trước khi ghi lại). Với các bảng
    # dùng doc-id tự sinh (không có field "id" số thật), so sánh số/chuỗi thường không
    # đáng tin — nên coi thẳng là "khớp mọi dòng" thay vì cố so sánh.
    if field == "id" and op == "gte" and value == "0":
        return True
    if op == "is" and value == "null":
        return row_val is None
    if op == "in":
        # cache theo value: 1 lệnh select() gọi _match_value cho MOI dong dữ liệu
        # với cùng chuỗi "in.(...)" — tách chuỗi 1 lần, dùng set để tra O(1) thay vì
        # re-split + list-scan cho từng dòng (quan trọng khi list id ~1-2 nghìn phần tử).
        return str(row_val) in _in_opts(value)
    if op == "ilike":
        needle = value.strip("*").lower()
        return needle in str(row_val or "").lower()
    if op == "eq":
        # so sánh cả dạng string lẫn số để khớp id int/str lẫn lộn
        return str(row_val) == str(value)
    if op in ("gte", "lte", "gt", "lt"):
        try:
            a, b = float(row_val if row_val is not None else 0), float(value)
        except (TypeError, ValueError):
            a, b = str(row_val or ""), str(value)
        if op == "gte": return a >= b
        if op == "lte": return a <= b
        if op == "gt":  return a > b
        if op == "lt":  return a < b
    return False


def _row_matches(row: dict, filters: str) -> bool:
    if not filters:
        return True
    # tách limit=/offset= ra trước (xử lý riêng, không phải điều kiện lọc)
    parts = [p for p in filters.split("&") if p and not p.startswith(("limit=", "offset="))]
    for part in parts:
        if part.startswith("or=("):
            or_conds = [_parse_condition(c) for c in part[len("or=("):-1].split(",")]
            if not any(_match_value(row.get(f), op, val, field=f) for f, op, val in or_conds):
                return False
            continue
        field, op, value = _parse_condition(part)
        if not _match_value(row.get(field), op, value, field=field):
            return False
    return True


def _parse_pagination(filters: str) -> tuple[Optional[int], int]:
    limit = offset = None
    for part in (filters or "").split("&"):
        if part.startswith("limit="):
            limit = int(part[len("limit="):])
        elif part.startswith("offset="):
            offset = int(part[len("offset="):])
    return limit, offset or 0


def _doc_to_row(doc) -> dict:
    row = doc.to_dict() or {}
    row.setdefault("id", doc.id)
    return row


def _order_key(field_spec: str):
    field, _, direction = field_spec.partition(".")
    reverse = direction == "desc"
    def key(row):
        v = row.get(field)
        return (v is None, v if v is not None else "")
    return key, reverse


# ── Cache đọc toàn bộ collection (TTL ngắn) ─────────────────────
# select() luôn stream() TOÀN BỘ collection rồi lọc trong Python. Nhiều
# hàm nghiệp vụ (vd bao_cao_tong_hop khi xem "Tất cả công trình") gọi
# select() trên CÙNG 1 bảng (phieu, chi_tiet_phieu) nhiều lần độc lập
# trong 1 request — gây quét mạng lặp lại không cần thiết (đã gây timeout
# thật trên production 2026-07-14). Cache raw rows theo tên bảng, TTL
# ngắn để vẫn thấy dữ liệu mới sau ghi gần như ngay lập tức; insert/
# update/delete tự xoá cache của bảng đó để không đọc dữ liệu cũ.
_COLLECTION_CACHE: dict = {}
_CACHE_TTL_SECONDS = 8


def _fetch_collection_rows(table: str) -> list:
    now = time.time()
    cached = _COLLECTION_CACHE.get(table)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return [dict(r) for r in cached[1]]
    docs = _db().collection(table).stream()
    rows = [_doc_to_row(d) for d in docs]
    _COLLECTION_CACHE[table] = (now, rows)
    return [dict(r) for r in rows]


def _invalidate_cache(table: str):
    _COLLECTION_CACHE.pop(table, None)


# ── CRUD helpers (chữ ký giống hệt supabase_client.py) ──────────

def select(table: str, query: str = "*", filters: str = "", order: str = "") -> list:
    rows = _fetch_collection_rows(table)
    rows = [r for r in rows if _row_matches(r, filters)]

    if order:
        for field_spec in reversed(order.split(",")):
            key_fn, reverse = _order_key(field_spec.strip())
            rows.sort(key=key_fn, reverse=reverse)

    limit, offset = _parse_pagination(filters)
    if offset:
        rows = rows[offset:]
    if limit is not None:
        rows = rows[:limit]

    if query and query != "*":
        cols = [c.strip() for c in query.split(",")]
        rows = [{c: r.get(c) for c in cols} for r in rows]
    return rows


def insert(table: str, data) -> list:
    items = data if isinstance(data, list) else [data]
    db = _db()
    results = []
    for i in range(0, len(items), 400):  # Firestore batch limit 500 — chừa biên an toàn
        batch = db.batch()
        chunk_results = []
        for item in items[i:i + 400]:
            doc_id, full_data = _resolve_doc_id(table, item)
            doc_ref = db.collection(table).document(doc_id)
            batch.set(doc_ref, full_data)
            chunk_results.append({**full_data, "id": full_data.get("id", doc_id)})
        batch.commit()
        results.extend(chunk_results)
    _invalidate_cache(table)
    return results


def update(table: str, data: dict, filters: str) -> list:
    matched = select(table, filters=filters)
    db = _db()
    updated = []
    for i in range(0, len(matched), 400):
        batch = db.batch()
        chunk = matched[i:i + 400]
        for row in chunk:
            doc_ref = db.collection(table).document(str(row["id"]))
            batch.update(doc_ref, data)
        batch.commit()
        updated.extend({**row, **data} for row in chunk)
    _invalidate_cache(table)
    return updated


def delete(table: str, filters: str) -> list:
    matched = select(table, filters=filters)
    db = _db()
    for i in range(0, len(matched), 400):
        batch = db.batch()
        for row in matched[i:i + 400]:
            batch.delete(db.collection(table).document(str(row["id"])))
        batch.commit()
    _invalidate_cache(table)
    return matched


# ═════════════════════════════════════════════════════════════
# Từ đây trở xuống: PORT NGUYÊN VẸN từ supabase_client.py —
# chỉ dùng select/insert/update/delete ở trên, không đổi logic.
# ═════════════════════════════════════════════════════════════

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
    return select("phieu", query="*", filters=f"limit={limit}&offset={offset}{extra}", order="ngay.desc")


def push_phieu(cong_trinh_id: int, local_id: int, loai: str, so_phieu: str,
               ngay: str, doi_tac: str, ghi_chu: str = "",
               tong_tien: float = 0, nguon: str = "web") -> Optional[int]:
    """Push 1 phiếu lên Firestore. Trả về id cloud hoặc None nếu đã tồn tại."""
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
    """Push danh sách chi tiết phiếu lên Firestore."""
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
    insert("chi_tiet_phieu", data)


def delete_phieu(phieu_id: int):
    """Xóa phiếu và chi tiết phiếu theo id."""
    delete("chi_tiet_phieu", filters=f"phieu_id=eq.{phieu_id}")
    delete("phieu", filters=f"id=eq.{phieu_id}")


# ── Danh mục hàng hóa ────────────────────────────────────────

def get_all_hang_hoa(cong_trinh_id: int = None, search: str = None,
                     limit: int = 10000, offset: int = 0) -> list:
    extra = ""
    if cong_trinh_id:
        extra += f"&cong_trinh_id=eq.{cong_trinh_id}"
    if search:
        extra += f"&or=(ten_hang.ilike.*{search}*,ma_hang.ilike.*{search}*)"
    return select("hang_hoa",
                  query="ma_hang,ten_hang,dvt,nhom,cong_trinh_id",
                  filters=f"limit={limit}&offset={offset}{extra}",
                  order="nhom.asc,ten_hang.asc")


def create_hang_hoa(data: dict) -> Optional[dict]:
    rows = insert("hang_hoa", data)
    return rows[0] if rows else None


def update_hang_hoa(ma_hang: str, data: dict) -> Optional[dict]:
    rows = update("hang_hoa", data, filters=f"ma_hang=eq.{ma_hang}")
    return rows[0] if rows else None


def delete_hang_hoa(ma_hang: str):
    delete("hang_hoa", filters=f"ma_hang=eq.{ma_hang}")


# ── Tồn kho ───────────────────────────────────────────────────
# Không còn view v_ton_kho trên Firestore — get_ton_kho_all/get_ton_kho_by_ct
# nay chỉ là alias của compute_ton_kho() (đã tính runtime từ trước, xem design.md).

def get_ton_kho_all() -> list:
    return compute_ton_kho()


def get_ton_kho_by_ct(cong_trinh_id: int = None, ma_ct: str = None) -> list:
    if cong_trinh_id:
        return compute_ton_kho(cong_trinh_id=cong_trinh_id)
    if ma_ct:
        ct = get_cong_trinh_by_ma(ma_ct)
        return compute_ton_kho(cong_trinh_id=ct["id"]) if ct else []
    return compute_ton_kho()


def compute_ton_kho(cong_trinh_id: int = None) -> list:
    """Tính tồn kho trực tiếp từ phieu + chi_tiet_phieu — port nguyên vẹn logic cũ."""
    phieu_list = get_phieu_list(cong_trinh_id=cong_trinh_id, limit=10000)
    if not phieu_list:
        return []

    phieu_map = {p["id"]: p for p in phieu_list}
    phieu_id_set = set(phieu_map.keys())

    # 1 lần quét toàn bộ chi_tiet_phieu rồi lọc trong Python — KHÔNG chia batch
    # gọi select() nhiều lần, vì mỗi lần select() đều quét lại TOÀN BỘ collection
    # (xem ghi chú đầu file). Chia batch ở đây từng gây timeout thật trên production
    # (2026-07-14): quét lại ~4000 doc x 15 lần cho 1 công trình ~1500 phiếu.
    all_chi_tiets = select("chi_tiet_phieu", query="phieu_id,ten_hang,dvt,so_luong,ma_hang")
    chi_tiets = [r for r in all_chi_tiets if r.get("phieu_id") in phieu_id_set]

    if not chi_tiets:
        return []

    ct_list = get_all_cong_trinh()
    ct_map = {ct["id"]: ct for ct in ct_list}

    hh_list = get_all_hang_hoa(cong_trinh_id=cong_trinh_id, limit=10000)
    hh_by_name: dict = {}
    hh_by_ma:   dict = {}
    for hh in hh_list:
        name_key = ((hh.get("ten_hang") or "").strip().lower(), hh.get("cong_trinh_id"))
        hh_by_name[name_key] = hh
        if hh.get("ma_hang"):
            hh_by_ma[(hh["ma_hang"], hh.get("cong_trinh_id"))] = hh

    groups: dict = {}
    for row in chi_tiets:
        pid = row.get("phieu_id")
        p = phieu_map.get(pid, {})
        ct_id = p.get("cong_trinh_id")
        if not ct_id:
            continue
        ten_hang = (row.get("ten_hang") or "").strip()
        ma_hang_row = (row.get("ma_hang") or "").strip()
        if not ten_hang and not ma_hang_row:
            continue

        if ma_hang_row:
            hh_info = hh_by_ma.get((ma_hang_row, ct_id)) or hh_by_name.get((ten_hang.lower(), ct_id), {})
        else:
            hh_info = hh_by_name.get((ten_hang.lower(), ct_id), {})

        ma_hang = hh_info.get("ma_hang", "") or ma_hang_row
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
    rows = update("phieu", data, filters=f"id=eq.{phieu_id}")
    return rows[0] if rows else None


def get_phieu_ids_by_ct(cong_trinh_id: int) -> list:
    rows = select("phieu", query="id", filters=f"cong_trinh_id=eq.{cong_trinh_id}")
    return [r["id"] for r in rows]


def delete_chi_tiet_by_hang(cong_trinh_id: int, ten_hang: str) -> int:
    ids = [str(i) for i in get_phieu_ids_by_ct(cong_trinh_id)]
    if not ids:
        return 0
    ids_str = ",".join(ids)
    rows = delete("chi_tiet_phieu", filters=f"phieu_id=in.({ids_str})&ten_hang=eq.{ten_hang}")
    return len(rows) if isinstance(rows, list) else 0


# ── Thống kê nhanh ────────────────────────────────────────────

def get_thong_ke_tong() -> dict:
    cts = get_all_cong_trinh()
    phieus = select("phieu", query="loai,cong_trinh_id,tong_tien,ngay", filters="limit=100000")
    nk = sum(1 for p in phieus if p.get("loai") == "NK")
    xk = sum(1 for p in phieus if p.get("loai") == "XK")
    tong_tien_nk = sum(float(p.get("tong_tien") or 0) for p in phieus if p.get("loai") == "NK")
    tong_tien_xk = sum(float(p.get("tong_tien") or 0) for p in phieus if p.get("loai") == "XK")
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
    return select("chi_tiet_phieu", filters=f"phieu_id=eq.{cloud_phieu_id}")


def get_all_chi_tiet() -> list:
    return select("chi_tiet_phieu",
                  query="phieu_id,ten_hang,dvt,so_luong,don_gia,thanh_tien,ghi_chu",
                  filters="limit=100000")


def get_lich_su(phieu_list: list, limit: int = 20000) -> list:
    if not phieu_list:
        return []
    phieu_map = {p["id"]: p for p in phieu_list if p.get("id")}
    phieu_id_set = set(phieu_map.keys())
    if not phieu_id_set:
        return []

    all_chi_tiets = select("chi_tiet_phieu",
                           query="phieu_id,ten_hang,dvt,so_luong,don_gia,thanh_tien,ghi_chu")
    chi_tiets = [r for r in all_chi_tiets if r.get("phieu_id") in phieu_id_set]

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
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if cong_trinh_id:
            data["cong_trinh_id"] = int(cong_trinh_id)
        insert("activity_log", data)
    except Exception:
        pass


def get_activity_log(limit: int = 100, offset: int = 0,
                     action: Optional[str] = None,
                     cong_trinh_id: Optional[int] = None) -> list:
    extra = ""
    if action:
        extra += f"&action=eq.{action}"
    if cong_trinh_id:
        extra += f"&cong_trinh_id=eq.{cong_trinh_id}"
    try:
        return select("activity_log", query="*",
                      filters=f"limit={limit}&offset={offset}{extra}",
                      order="created_at.desc")
    except Exception:
        return []


# ── AI Config theo công trình ────────────────────────────────

def get_ai_config_by_ct(cong_trinh_id: int) -> Optional[dict]:
    rows = select("project_ai_config", filters=f"cong_trinh_id=eq.{cong_trinh_id}")
    return rows[0] if rows else None


def get_all_ai_configs() -> list:
    return select("project_ai_config", order="cong_trinh_id.asc")


def create_ai_config(
    cong_trinh_id: int,
    provider: str = "gemini",
    api_key_enc: str = "",
    model: str = "",
    max_tokens: int = 4096,
    system_prompt: str = "",
    is_active: bool = False,
) -> Optional[dict]:
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
    status: str,
    error_msg: str = "",
) -> Optional[dict]:
    data: dict = {
        "last_test_at":     datetime.now(timezone.utc).isoformat(),
        "last_test_status": status,
        "last_error":       error_msg if status != "ok" else None,
    }
    if status == "ok":
        data["is_active"] = True
    rows = update("project_ai_config", data, filters=f"cong_trinh_id=eq.{cong_trinh_id}")
    return rows[0] if rows else None


def update_ai_config(cong_trinh_id: int, data: dict) -> Optional[dict]:
    rows = update("project_ai_config", data, filters=f"cong_trinh_id=eq.{cong_trinh_id}")
    return rows[0] if rows else None


def delete_ai_config(cong_trinh_id: int):
    delete("project_ai_config", filters=f"cong_trinh_id=eq.{cong_trinh_id}")


def ensure_ai_config_exists(cong_trinh_id: int) -> dict:
    existing = get_ai_config_by_ct(cong_trinh_id)
    if existing:
        return existing
    new_cfg = create_ai_config(cong_trinh_id=cong_trinh_id, is_active=False)
    return new_cfg or {}


# ── Ghi chú công việc ────────────────────────────────────────

def get_ghi_chu_list(
    cong_trinh_id: Optional[int] = None,
    trang_thai: Optional[str] = None,
    uu_tien: Optional[str] = None,
    search: Optional[str] = None,
    deadline_from: Optional[str] = None,
    deadline_to: Optional[str] = None,
    include_deleted: bool = False,
    limit: int = 200,
    offset: int = 0,
) -> list:
    extra = ""
    if not include_deleted:
        extra += "&deleted_at=is.null"
    if cong_trinh_id:
        extra += f"&cong_trinh_id=eq.{cong_trinh_id}"
    if trang_thai:
        extra += f"&trang_thai=eq.{trang_thai}"
    if uu_tien:
        extra += f"&uu_tien=eq.{uu_tien}"
    if search:
        extra += f"&or=(tieu_de.ilike.*{search}*,noi_dung.ilike.*{search}*)"
    if deadline_from:
        extra += f"&deadline=gte.{deadline_from}"
    if deadline_to:
        extra += f"&deadline=lte.{deadline_to}"
    filters = f"limit={limit}&offset={offset}{extra}"
    return select("ghi_chu", query="*", filters=filters, order="created_at.desc")


def get_ghi_chu_by_id(ghi_chu_id: int) -> Optional[dict]:
    rows = select("ghi_chu", filters=f"id=eq.{ghi_chu_id}&deleted_at=is.null")
    return rows[0] if rows else None


def create_ghi_chu(
    cong_trinh_id: int,
    tieu_de: str,
    noi_dung: str = "",
    mau: str = "warning",
    uu_tien: str = "binh_thuong",
    trang_thai: str = "mo",
    deadline: Optional[str] = None,
    created_by: str = "",
) -> Optional[dict]:
    data = {
        "cong_trinh_id": cong_trinh_id,
        "tieu_de":       tieu_de,
        "noi_dung":      noi_dung or "",
        "mau":           mau,
        "uu_tien":       uu_tien,
        "trang_thai":    trang_thai,
        "created_by":    created_by,
        "updated_by":    created_by,
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "deleted_at":    None,
    }
    if deadline:
        data["deadline"] = deadline
    rows = insert("ghi_chu", data)
    return rows[0] if rows else None


def update_ghi_chu(ghi_chu_id: int, data: dict) -> Optional[dict]:
    rows = update("ghi_chu", data, filters=f"id=eq.{ghi_chu_id}&deleted_at=is.null")
    return rows[0] if rows else None


def soft_delete_ghi_chu(ghi_chu_id: int, deleted_by: str = "") -> bool:
    now = datetime.now(timezone.utc).isoformat()
    rows = update("ghi_chu",
                  {"deleted_at": now, "updated_by": deleted_by},
                  filters=f"id=eq.{ghi_chu_id}&deleted_at=is.null")
    return len(rows) > 0


def complete_ghi_chu(ghi_chu_id: int, updated_by: str = "") -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()
    rows = update("ghi_chu",
                  {"trang_thai": "hoan_thanh",
                   "completed_at": now,
                   "updated_by": updated_by},
                  filters=f"id=eq.{ghi_chu_id}&deleted_at=is.null")
    return rows[0] if rows else None
