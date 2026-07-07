"""
routers/bao_cao.py — API endpoints cho Báo cáo & Thống kê
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import date, datetime
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import supabase_client as db

router = APIRouter(prefix="/api/bao-cao", tags=["bao_cao"])


def _parse_date(s: str) -> Optional[date]:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            pass
    return None


@router.get("/tong-hop")
def bao_cao_tong_hop(
    cong_trinh_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None, description="Từ ngày YYYY-MM-DD"),
    date_to:   Optional[str] = Query(None, description="Đến ngày YYYY-MM-DD"),
):
    """
    Thống kê tổng hợp: KPI cards + top vật tư + bảng công trình + cảnh báo tồn kho thấp.

    Logic:
    - KPI counts (so_phieu_nk/xk, tong_tien): lấy TẤT CẢ phiếu của CT, KHÔNG filter date
      → nhất quán với get_thong_ke_tong() cho "Tất cả"
    - Top vật tư: lấy phiếu có filter date → tính trong khoảng thời gian đang chọn
    - Biểu đồ: gọi riêng endpoint /bieu-do
    """
    try:
        print(f"[bao_cao] tong-hop: cong_trinh_id={cong_trinh_id}, date_from={date_from}, date_to={date_to}")

        # ── 1. Phiếu KHÔNG filter date → dùng cho KPI counts ─────────────────
        phieu_all = db.get_phieu_list(
            cong_trinh_id=cong_trinh_id,
            limit=5000
        )
        print(f"[bao_cao] phieu_all (no date): {len(phieu_all)} bản ghi")

        # ── 2. Phiếu CÓ filter date → dùng cho top vật tư ────────────────────
        if date_from or date_to:
            phieu_date = db.get_phieu_list(
                cong_trinh_id=cong_trinh_id,
                limit=5000,
                date_from=date_from,
                date_to=date_to
            )
        else:
            phieu_date = phieu_all
        print(f"[bao_cao] phieu_date (with date): {len(phieu_date)} bản ghi")

        # ── 3. KPI từ phieu_all (không bị ảnh hưởng bởi date filter) ─────────
        if cong_trinh_id:
            nk_all = [p for p in phieu_all if p.get("loai") == "NK"]
            xk_all = [p for p in phieu_all if p.get("loai") == "XK"]
            thong_ke = {
                "so_cong_trinh": 1,
                "so_phieu_nk":   len(nk_all),
                "so_phieu_xk":   len(xk_all),
                "tong_phieu":    len(phieu_all),
                "tong_tien_nk":  sum(float(p.get("tong_tien") or 0) for p in nk_all),
                "tong_tien_xk":  sum(float(p.get("tong_tien") or 0) for p in xk_all),
            }
        else:
            # "Tất cả" — dùng get_thong_ke_tong() như cũ (không filter date)
            thong_ke = db.get_thong_ke_tong()

        print(f"[bao_cao] thong_ke: NK={thong_ke.get('so_phieu_nk')}, XK={thong_ke.get('so_phieu_xk')}")

        # ── 4. Tồn kho + cảnh báo ─────────────────────────────────────────────
        if cong_trinh_id:
            ton_kho = db.get_ton_kho_by_ct(cong_trinh_id=cong_trinh_id)
        else:
            ton_kho = db.get_ton_kho_all()
        # Cảnh báo: tồn <= 20 (nhất quán với trang Cảnh báo)
        canh_bao = [r for r in ton_kho if (r.get("ton_cuoi") or 0) <= 20]

        # ── 5. Đếm mặt hàng ──────────────────────────────────────────────────
        try:
            so_mat_hang = len(db.get_all_hang_hoa(cong_trinh_id=cong_trinh_id))
        except Exception:
            so_mat_hang = len(ton_kho)

        # ── 6. Top vật tư (dùng phieu_date — có filter ngày) ─────────────────
        # Batch fetch chi tiết chỉ từ phieu_ids thuộc phieu_date (không tải cả DB)
        phieu_map = {p["id"]: p for p in phieu_date if p.get("id")}
        phieu_ids = list(phieu_map.keys())
        chi_tiets = []
        for i in range(0, len(phieu_ids), 100):
            chunk   = phieu_ids[i:i + 100]
            ids_str = ",".join(str(x) for x in chunk)
            rows    = db.select("chi_tiet_phieu",
                                query="phieu_id,ten_hang,dvt,so_luong,thanh_tien",
                                filters=f"phieu_id=in.({ids_str})")
            chi_tiets.extend(rows)
        print(f"[bao_cao] chi_tiets batch: {len(chi_tiets)} dòng từ {len(phieu_ids)} phiếu")

        hang_nk: dict = {}
        hang_xk: dict = {}
        for r in chi_tiets:
            pid = r.get("phieu_id")
            p   = phieu_map.get(pid)
            if not p:
                continue
            ten = r.get("ten_hang", "")
            sl  = float(r.get("so_luong") or 0)
            tt  = float(r.get("thanh_tien") or 0)
            if p.get("loai") == "NK":
                if ten not in hang_nk:
                    hang_nk[ten] = {"so_luong": 0, "thanh_tien": 0}
                hang_nk[ten]["so_luong"]   += sl
                hang_nk[ten]["thanh_tien"] += tt
            elif p.get("loai") == "XK":
                if ten not in hang_xk:
                    hang_xk[ten] = {"so_luong": 0, "thanh_tien": 0}
                hang_xk[ten]["so_luong"]   += sl
                hang_xk[ten]["thanh_tien"] += tt

        top_nk = sorted(
            [{"ten_hang": k, **v} for k, v in hang_nk.items()],
            key=lambda x: x["thanh_tien"], reverse=True
        )[:10]
        top_xk = sorted(
            [{"ten_hang": k, **v} for k, v in hang_xk.items()],
            key=lambda x: x["thanh_tien"], reverse=True
        )[:10]

        # ── 7. Bảng tổng hợp theo công trình ─────────────────────────────────
        # Dùng phieu_all để bảng hiện đúng tổng số phiếu (không bị cắt bởi date)
        if cong_trinh_id:
            cts = db.select("cong_trinh", filters=f"id=eq.{cong_trinh_id}")
        else:
            cts = db.get_all_cong_trinh()

        ct_map: dict = {}
        for p in phieu_all:
            cid = p.get("cong_trinh_id")
            if not cid:
                continue
            if cid not in ct_map:
                ct_map[cid] = {"so_phieu_nk": 0, "so_phieu_xk": 0,
                                "tong_tien_nk": 0, "tong_tien_xk": 0}
            loai = p.get("loai")
            tien = float(p.get("tong_tien") or 0)
            if loai == "NK":
                ct_map[cid]["so_phieu_nk"] += 1
                ct_map[cid]["tong_tien_nk"] += tien
            elif loai == "XK":
                ct_map[cid]["so_phieu_xk"] += 1
                ct_map[cid]["tong_tien_xk"] += tien

        bang_ct = []
        for ct in cts:
            cid   = ct.get("id")
            stats = ct_map.get(cid, {"so_phieu_nk": 0, "so_phieu_xk": 0,
                                      "tong_tien_nk": 0, "tong_tien_xk": 0})
            bang_ct.append({**ct, **stats})

        # tong_tien_xk: khi CT cụ thể thì đã có trong thong_ke (line 70); khi tất cả lấy từ get_thong_ke_tong
        tong_tien_xk = thong_ke.get("tong_tien_xk", 0)

        # Thống kê âm kho (ton_cuoi < 0)
        so_am_kho = len([r for r in ton_kho if (r.get("ton_cuoi") or 0) < 0])
        # Tổng nhập - xuất theo số lượng (từ v_ton_kho)
        tong_nhap_sl = sum(float(r.get("tong_nhap") or 0) for r in ton_kho)
        tong_xuat_sl = sum(float(r.get("tong_xuat") or 0) for r in ton_kho)

        return {
            "kpi": {
                **thong_ke,
                "so_mat_hang":        so_mat_hang,
                "so_canh_bao":        len([r for r in ton_kho if (r.get("ton_cuoi") or 0) <= 0]),
                "so_canh_bao_thap":   len(canh_bao),   # tổng thật, không bị cap
                "tong_tien_xk":       tong_tien_xk,
                "so_am_kho":          so_am_kho,
            },
            "top_vat_tu_nk":     top_nk,
            "top_vat_tu_xk":     top_xk,
            "bang_cong_trinh":   bang_ct,
            "canh_bao_ton_thap": canh_bao[:100],   # tăng lên 100
            "ton_kho":           ton_kho[:100],
        }
    except Exception as e:
        import traceback
        print(f"[bao_cao] ERROR tong-hop: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Lỗi báo cáo tổng hợp: {str(e)}")


@router.get("/theo-thang")
def bao_cao_theo_thang(
    year: int  = Query(..., description="Năm, ví dụ: 2026"),
    month: int = Query(..., ge=1, le=12, description="Tháng 1-12"),
    cong_trinh_id: Optional[int] = Query(None),
):
    """Báo cáo chi tiết trong 1 tháng: tổng nhập, xuất, top hàng hóa."""
    try:
        from_date = f"{year}-{month:02d}-01"
        if month == 12:
            to_date = f"{year+1}-01-01"
        else:
            to_date = f"{year}-{month+1:02d}-01"

        all_phieu = db.get_phieu_list(cong_trinh_id=cong_trinh_id, limit=10000)
        phieu_thang = [
            p for p in all_phieu
            if p.get("ngay") and from_date <= p["ngay"] < to_date
        ]

        phieu_nk = [p for p in phieu_thang if p.get("loai") == "NK"]
        phieu_xk = [p for p in phieu_thang if p.get("loai") == "XK"]

        tong_tien_nk = sum(float(p.get("tong_tien") or 0) for p in phieu_nk)
        tong_tien_xk = sum(float(p.get("tong_tien") or 0) for p in phieu_xk)

        phieu_ids_list = [p["id"] for p in phieu_thang if p.get("id")]
        phieu_ids      = set(phieu_ids_list)
        ct_thang: list = []
        for i in range(0, len(phieu_ids_list), 100):
            chunk   = phieu_ids_list[i:i + 100]
            ids_str = ",".join(str(x) for x in chunk)
            rows    = db.select("chi_tiet_phieu", query="*",
                                filters=f"phieu_id=in.({ids_str})")
            ct_thang.extend(rows)

        phieu_map = {p["id"]: p for p in phieu_thang}
        hang_stats: dict = {}
        for r in ct_thang:
            pid  = r.get("phieu_id")
            p    = phieu_map.get(pid, {})
            ten  = r.get("ten_hang", "")
            sl   = float(r.get("so_luong") or 0)
            tt   = float(r.get("thanh_tien") or 0)
            loai = p.get("loai", "")
            if ten not in hang_stats:
                hang_stats[ten] = {"dvt": r.get("dvt",""), "nk": 0, "xk": 0,
                                   "tien_nk": 0, "tien_xk": 0}
            if loai == "NK":
                hang_stats[ten]["nk"] += sl
                hang_stats[ten]["tien_nk"] += tt
            elif loai == "XK":
                hang_stats[ten]["xk"] += sl
                hang_stats[ten]["tien_xk"] += tt

        chi_tiet_hang = sorted(
            [{"ten_hang": k, **v} for k, v in hang_stats.items()],
            key=lambda x: x["tien_nk"] + x["tien_xk"], reverse=True
        )

        return {
            "thang": month, "nam": year, "cong_trinh_id": cong_trinh_id,
            "tong_phieu_nk": len(phieu_nk), "tong_phieu_xk": len(phieu_xk),
            "tong_tien_nk": tong_tien_nk, "tong_tien_xk": tong_tien_xk,
            "phieu_nk": phieu_nk, "phieu_xk": phieu_xk,
            "chi_tiet_hang": chi_tiet_hang,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi báo cáo theo tháng: {str(e)}")


@router.get("/bieu-do")
def bieu_do_nhap_xuat(
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    to_date:   Optional[str] = Query(None, description="YYYY-MM-DD"),
    period:    str            = Query("month", description="day hoặc month"),
    cong_trinh_id: Optional[int] = Query(None),
):
    """
    Data cho biểu đồ nhập-xuất theo ngày hoặc tháng.
    Filter theo cong_trinh_id và khoảng thời gian nếu có.
    """
    try:
        print(f"[bao_cao] bieu-do: cong_trinh_id={cong_trinh_id}, period={period}, from={from_date}, to={to_date}")

        # Lấy phiếu — nếu có date filter thì dùng, không thì lấy tất cả của CT
        all_phieu = db.get_phieu_list(
            cong_trinh_id=cong_trinh_id,
            limit=10000,
            date_from=from_date,
            date_to=to_date
        )

        # Fallback: nếu không có dữ liệu trong khoảng ngày, thử lấy không filter ngày
        if not all_phieu and cong_trinh_id and (from_date or to_date):
            print(f"[bao_cao] bieu-do: không có phiếu trong khoảng ngày, thử lấy tất cả")
            all_phieu = db.get_phieu_list(cong_trinh_id=cong_trinh_id, limit=10000)

        buckets: dict = {}
        for p in all_phieu:
            ngay = p.get("ngay", "")
            if not ngay:
                continue
            if period == "day":
                key = ngay[:10]
            elif period == "week":
                # ISO week: YYYY-Www
                from datetime import date as _date
                try:
                    d = _date.fromisoformat(ngay[:10])
                    iso = d.isocalendar()
                    key = f"{iso[0]}-W{iso[1]:02d}"
                except Exception:
                    key = ngay[:7]
            elif period == "year":
                key = ngay[:4]
            else:
                key = ngay[:7]  # YYYY-MM (month)

            if key not in buckets:
                buckets[key] = {"period": key,
                                 "tong_nk": 0, "tong_xk": 0,
                                 "tong_tien_nk": 0, "tong_tien_xk": 0}
            loai = p.get("loai", "")
            tien = float(p.get("tong_tien") or 0)
            if loai == "NK":
                buckets[key]["tong_nk"]      += 1
                buckets[key]["tong_tien_nk"] += tien
            elif loai == "XK":
                buckets[key]["tong_xk"]      += 1
                buckets[key]["tong_tien_xk"] += tien

        data = sorted(buckets.values(), key=lambda x: x["period"])
        return {"period_type": period, "data": data, "total_points": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy data biểu đồ: {str(e)}")
