"""
mapping_service.py — Dịch vụ ánh xạ tên AI → tên chuẩn danh mục
Dự án: KhoUNICE Web — HP Cons

Thứ tự lookup cho mỗi dòng:
  1. Mapping riêng của công trình  (ai_name_mapping WHERE cong_trinh_id = ID)
  2. Mapping chung                  (ai_name_mapping WHERE cong_trinh_id IS NULL)
  3. Fuzzy match danh mục           (hang_hoa WHERE cong_trinh_id = ID)
  → Nếu tất cả đều không đủ ngưỡng: phân loại 🔴 (hàng mới)
"""
import time
from typing import Optional
from datetime import datetime, timezone

import supabase_client as db
from fuzzy_match import normalize, fuzzy_score, find_best_match, classify_tab

# ── Hằng số mặc định ────────────────────────────────────────
DEFAULT_GREEN  = 90
DEFAULT_YELLOW = 70


# ── DB helpers cho ai_name_mapping ──────────────────────────

def get_ct_mappings(cong_trinh_id: int) -> list[dict]:
    """Lấy tất cả mapping riêng của công trình (cache gọi 1 lần/request)."""
    try:
        return db.select(
            "ai_name_mapping",
            filters=f"cong_trinh_id=eq.{cong_trinh_id}",
            order="so_lan_dung.desc",
        )
    except Exception as e:
        print(f"[mapping_service] get_ct_mappings error: {e}")
        return []


def get_global_mappings() -> list[dict]:
    """Lấy tất cả mapping chung (cong_trinh_id IS NULL)."""
    try:
        return db.select(
            "ai_name_mapping",
            filters="cong_trinh_id=is.null",
            order="so_lan_dung.desc",
        )
    except Exception as e:
        print(f"[mapping_service] get_global_mappings error: {e}")
        return []


def upsert_name_mapping(
    ten_ai_raw: str,
    ten_chuan: str,
    cong_trinh_id: Optional[int] = None,
) -> Optional[dict]:
    """
    Thêm mới hoặc cập nhật mapping (tăng so_lan_dung nếu đã tồn tại).
    Gọi sau khi người dùng bấm Xác nhận trên popup.
    """
    ten_norm = normalize(ten_ai_raw)

    # Tìm mapping đã có
    if cong_trinh_id:
        existing = db.select(
            "ai_name_mapping",
            filters=f"cong_trinh_id=eq.{cong_trinh_id}&ten_ai_normalized=eq.{ten_norm}",
        )
    else:
        existing = db.select(
            "ai_name_mapping",
            filters=f"cong_trinh_id=is.null&ten_ai_normalized=eq.{ten_norm}",
        )

    if existing:
        row = existing[0]
        updated = db.update(
            "ai_name_mapping",
            {
                "ten_chuan":  ten_chuan,
                "so_lan_dung": row.get("so_lan_dung", 1) + 1,
            },
            filters=f"id=eq.{row['id']}",
        )
        return updated[0] if updated else None
    else:
        data: dict = {
            "ten_ai_raw":        ten_ai_raw,
            "ten_ai_normalized": ten_norm,
            "ten_chuan":         ten_chuan,
            "so_lan_dung":       1,
        }
        if cong_trinh_id is not None:
            data["cong_trinh_id"] = cong_trinh_id
        inserted = db.insert("ai_name_mapping", data)
        return inserted[0] if inserted else None


def log_match_history(
    cong_trinh_id: int,
    loai_phieu: str,
    file_name: str,
    tong_so_dong: int,
    khop_xanh: int,
    khop_vang: int,
    hang_moi: int,
    user_id: Optional[int],
    user_email: Optional[str],
    processing_time_ms: Optional[int],
    ai_provider: Optional[str],
    ai_model: Optional[str],
) -> Optional[dict]:
    """Ghi 1 bản ghi vào ai_match_history. Gọi sau khi popup xử lý xong."""
    try:
        row = db.insert("ai_match_history", {
            "cong_trinh_id":      cong_trinh_id,
            "loai_phieu":         loai_phieu,
            "file_name":          file_name,
            "tong_so_dong":       tong_so_dong,
            "khop_xanh":          khop_xanh,
            "khop_vang":          khop_vang,
            "hang_moi":           hang_moi,
            "user_id":            user_id,
            "user_email":         user_email,
            "processing_time_ms": processing_time_ms,
            "ai_provider":        ai_provider,
            "ai_model":           ai_model,
        })
        return row[0] if row else None
    except Exception as e:
        print(f"[mapping_service] log_match_history error: {e}")
        return None


# ── Hàm chính: phân loại 1 item ──────────────────────────────

def classify_item(
    ten_ai_raw: str,
    ct_mappings: list[dict],
    global_mappings: list[dict],
    catalog: list[dict],
    green_threshold: int = DEFAULT_GREEN,
    yellow_threshold: int = DEFAULT_YELLOW,
) -> dict:
    """
    Phân loại 1 dòng hàng hóa từ AI.

    Thứ tự:
      1. Tìm exact trong CT mappings (ten_ai_normalized)
      2. Tìm exact trong global mappings
      3. Fuzzy match CT mappings (ten_chuan)
      4. Fuzzy match catalog (ten_hang)
      5. Không khớp → "red"

    Returns dict:
      {
        ten_ai_raw,          # tên gốc từ AI
        ten_chuan,           # tên chuẩn đề xuất (có thể rỗng nếu red)
        score,               # 0-100
        tab,                 # "green" | "yellow" | "red"
        source,              # "ct_mapping" | "global_mapping" | "ct_fuzzy" | "catalog_fuzzy" | "none"
        matched_id,          # id record trong mapping hoặc catalog (None nếu red)
      }
    """
    ten_norm = normalize(ten_ai_raw)

    # ── Bước 1: Exact match trong CT mappings ──────────────
    for m in ct_mappings:
        if m.get("ten_ai_normalized", "") == ten_norm:
            score = 100
            return _result(ten_ai_raw, m["ten_chuan"], score,
                           green_threshold, yellow_threshold,
                           "ct_mapping", m.get("id"))

    # ── Bước 2: Exact match trong global mappings ──────────
    for m in global_mappings:
        if m.get("ten_ai_normalized", "") == ten_norm:
            score = 100
            return _result(ten_ai_raw, m["ten_chuan"], score,
                           green_threshold, yellow_threshold,
                           "global_mapping", m.get("id"))

    # ── Bước 3: Fuzzy trên CT mappings (so sánh ten_chuan) ─
    best_ct = _fuzzy_in_list(ten_ai_raw, ct_mappings, "ten_chuan", yellow_threshold)
    if best_ct:
        item, score = best_ct
        return _result(ten_ai_raw, item["ten_chuan"], score,
                       green_threshold, yellow_threshold,
                       "ct_mapping", item.get("id"))

    # ── Bước 4: Fuzzy match catalog ────────────────────────
    best_cat = _fuzzy_in_list(ten_ai_raw, catalog, "ten_hang", yellow_threshold)
    if best_cat:
        item, score = best_cat
        return _result(ten_ai_raw, item["ten_hang"], score,
                       green_threshold, yellow_threshold,
                       "catalog_fuzzy", item.get("ma_hang"))

    # ── Bước 5: Không khớp → red ───────────────────────────
    return _result(ten_ai_raw, "", 0, green_threshold, yellow_threshold, "none", None)


def _fuzzy_in_list(
    query: str,
    items: list[dict],
    field: str,
    min_score: int,
) -> Optional[tuple[dict, int]]:
    """Helper: fuzzy search trong list, trả về (item, score) hoặc None."""
    if not items:
        return None
    result = find_best_match(query, items, text_field=field, score_threshold=min_score)
    return result


def _result(
    ten_ai_raw: str,
    ten_chuan: str,
    score: int,
    green_threshold: int,
    yellow_threshold: int,
    source: str,
    matched_id,
) -> dict:
    tab = classify_tab(score, green_threshold, yellow_threshold)
    return {
        "ten_ai_raw":  ten_ai_raw,
        "ten_chuan":   ten_chuan,
        "score":       score,
        "tab":         tab,
        "source":      source,
        "matched_id":  matched_id,
    }


# ── Hàm xử lý toàn bộ batch items ───────────────────────────

def process_items_batch(
    items: list[dict],
    cong_trinh_id: int,
    green_threshold: int = DEFAULT_GREEN,
    yellow_threshold: int = DEFAULT_YELLOW,
) -> dict:
    """
    Phân loại toàn bộ danh sách items từ AI đọc PDF.

    Args:
        items: List items từ AI (mỗi item có ít nhất "ten_hang")
        cong_trinh_id: ID công trình
        green_threshold: Ngưỡng 🟢 (mặc định 90)
        yellow_threshold: Ngưỡng 🟡 (mặc định 70)

    Returns:
        {
          "green":  [...],  # items tab 🟢
          "yellow": [...],  # items tab 🟡
          "red":    [...],  # items tab 🔴
          "stats":  { tong, xanh, vang, do }
        }
    """
    t_start = time.monotonic()

    # Load data 1 lần cho toàn batch
    ct_mappings     = get_ct_mappings(cong_trinh_id)
    global_mappings = get_global_mappings()
    catalog         = db.get_all_hang_hoa(cong_trinh_id=cong_trinh_id, limit=5000)

    green_list  = []
    yellow_list = []
    red_list    = []

    for idx, item in enumerate(items):
        ten_ai = item.get("ten_hang") or item.get("ten_ai_raw") or ""
        if not ten_ai:
            continue

        classification = classify_item(
            ten_ai,
            ct_mappings,
            global_mappings,
            catalog,
            green_threshold,
            yellow_threshold,
        )

        # Merge thông tin gốc từ AI vào kết quả
        enriched = {
            **item,                            # Giữ nguyên dữ liệu AI (so_luong, dvt, ...)
            "_idx":       idx,                 # Vị trí gốc để sort sau confirm
            "_match":     classification,      # Thông tin phân loại
        }

        tab = classification["tab"]
        if tab == "green":
            green_list.append(enriched)
        elif tab == "yellow":
            yellow_list.append(enriched)
        else:
            red_list.append(enriched)

    elapsed_ms = int((time.monotonic() - t_start) * 1000)

    return {
        "green":  green_list,
        "yellow": yellow_list,
        "red":    red_list,
        "stats": {
            "tong":              len(items),
            "khop_xanh":         len(green_list),
            "khop_vang":         len(yellow_list),
            "hang_moi":          len(red_list),
            "processing_time_ms": elapsed_ms,
            "green_threshold":    green_threshold,
            "yellow_threshold":   yellow_threshold,
        },
    }
