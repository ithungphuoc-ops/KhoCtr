"""
routers/ton_kho.py — API endpoints cho Tồn kho
(có thêm/sửa/xóa: them-hang, dieu-chinh, xoa-hang)
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import supabase_client as db

router = APIRouter(prefix="/api/ton-kho", tags=["ton_kho"])


class DieuChinhBody(BaseModel):
    cong_trinh_id: int
    ten_hang: str
    dvt: Optional[str] = ""
    ton_hien_tai: float = 0
    ton_moi: float = 0
    ghi_chu: Optional[str] = ""
    user_email: Optional[str] = ""


class ThemHangBody(BaseModel):
    cong_trinh_id: int
    ten_hang: str
    dvt: Optional[str] = "cái"
    so_luong: float = 0
    don_gia: Optional[float] = 0
    ghi_chu: Optional[str] = ""
    user_email: Optional[str] = ""


@router.get("/")
def get_ton_kho(
    cong_trinh_id: Optional[int] = Query(None, description="Lọc theo id công trình"),
    ma_ct: Optional[str] = Query(None, description="Lọc theo mã công trình"),
):
    """Lấy tồn kho tính trực tiếp từ phiếu NK/XK (không dùng view)."""
    try:
        # Resolve ma_ct → cong_trinh_id nếu cần
        if ma_ct and not cong_trinh_id:
            ct = db.get_cong_trinh_by_ma(ma_ct)
            if ct:
                cong_trinh_id = ct["id"]
        rows = db.compute_ton_kho(cong_trinh_id=cong_trinh_id)
        return {"data": rows, "total": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy tồn kho: {str(e)}")


@router.post("/them-hang")
def them_hang_ton_kho(body: ThemHangBody):
    """
    Thêm 1 mặt hàng vào tồn kho.
    Tạo phiếu NK loại 'Tồn đầu / bổ sung' (số phiếu TD-...) để giữ dấu vết.
    """
    try:
        if not body.ten_hang.strip():
            raise HTTPException(status_code=400, detail="Chưa nhập tên hàng")
        if body.so_luong <= 0:
            raise HTTPException(status_code=400, detail="Số lượng phải lớn hơn 0")
        now = datetime.now()
        so_phieu = f"TD-{now:%y%m%d-%H%M%S}"
        thanh_tien = body.so_luong * (body.don_gia or 0)
        phieu = db.create_phieu(
            cong_trinh_id=body.cong_trinh_id,
            loai="NK",
            so_phieu=so_phieu,
            ngay=f"{now:%Y-%m-%d}",
            doi_tac="Them hang vao kho",
            ghi_chu=body.ghi_chu or "Them hang truc tiep tu trang Ton kho",
            tong_tien=thanh_tien,
            nguon="ton_kho",
        )
        if not phieu:
            raise HTTPException(status_code=500, detail="Không tạo được phiếu")
        db.push_chi_tiet(phieu["id"], [{
            "ten_hang": body.ten_hang.strip(),
            "dvt": body.dvt or "cái",
            "so_luong": body.so_luong,
            "don_gia": body.don_gia or 0,
            "thanh_tien": thanh_tien,
            "ghi_chu": body.ghi_chu or "",
        }])
        db.log_activity(
            action="them_hang_ton_kho",
            entity_type="ton_kho",
            entity_id=so_phieu,
            details=f"Them '{body.ten_hang}' SL {body.so_luong} {body.dvt} vao ton kho (phieu {so_phieu})",
            user_email=body.user_email or "",
            cong_trinh_id=body.cong_trinh_id,
        )
        return {"success": True, "so_phieu": so_phieu, "phieu_id": phieu["id"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi thêm hàng: {str(e)}")


@router.post("/dieu-chinh")
def dieu_chinh_ton_kho(body: DieuChinhBody):
    """
    Sửa số tồn của 1 mặt hàng.
    Tự tạo phiếu điều chỉnh (DC-...): NK nếu tăng, XK nếu giảm — giữ nguyên lịch sử.
    """
    try:
        if not body.ten_hang.strip():
            raise HTTPException(status_code=400, detail="Chưa có tên hàng")
        delta = body.ton_moi - body.ton_hien_tai
        if delta == 0:
            return {"success": True, "message": "Tồn không thay đổi", "delta": 0}
        loai = "NK" if delta > 0 else "XK"
        now = datetime.now()
        so_phieu = f"DC-{now:%y%m%d-%H%M%S}"
        ghi_chu = body.ghi_chu or f"Dieu chinh ton: {body.ton_hien_tai:g} -> {body.ton_moi:g}"
        phieu = db.create_phieu(
            cong_trinh_id=body.cong_trinh_id,
            loai=loai,
            so_phieu=so_phieu,
            ngay=f"{now:%Y-%m-%d}",
            doi_tac="Dieu chinh ton kho",
            ghi_chu=ghi_chu,
            tong_tien=0,
            nguon="dieu_chinh",
        )
        if not phieu:
            raise HTTPException(status_code=500, detail="Không tạo được phiếu điều chỉnh")
        db.push_chi_tiet(phieu["id"], [{
            "ten_hang": body.ten_hang.strip(),
            "dvt": body.dvt or "cái",
            "so_luong": abs(delta),
            "don_gia": 0,
            "thanh_tien": 0,
            "ghi_chu": ghi_chu,
        }])
        db.log_activity(
            action="dieu_chinh_ton_kho",
            entity_type="ton_kho",
            entity_id=so_phieu,
            details=f"Dieu chinh '{body.ten_hang}': {body.ton_hien_tai:g} -> {body.ton_moi:g} ({'+' if delta > 0 else ''}{delta:g} {body.dvt})",
            user_email=body.user_email or "",
            cong_trinh_id=body.cong_trinh_id,
        )
        return {"success": True, "so_phieu": so_phieu, "loai": loai, "delta": delta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi điều chỉnh tồn kho: {str(e)}")


@router.delete("/xoa-hang")
def xoa_hang_ton_kho(
    ten_hang: str = Query(..., description="Tên hàng cần xóa khỏi tồn kho"),
    cong_trinh_id: int = Query(..., description="Id công trình"),
    user_email: Optional[str] = Query(None),
):
    """
    Xóa hẳn 1 mặt hàng khỏi tồn kho của 1 công trình.
    CẢNH BÁO: xóa mọi dòng chi tiết nhập/xuất của hàng này trong công trình
    (dùng khi tạo nhầm tên hàng). Không xóa được thì dùng Điều chỉnh về 0.
    """
    try:
        deleted = db.delete_chi_tiet_by_hang(cong_trinh_id, ten_hang)
        db.log_activity(
            action="xoa_hang_ton_kho",
            entity_type="ton_kho",
            entity_id=ten_hang,
            details=f"Xoa hang '{ten_hang}' khoi ton kho CT id={cong_trinh_id} ({deleted} dong chi tiet)",
            user_email=user_email or "",
            cong_trinh_id=cong_trinh_id,
        )
        return {"success": True, "deleted_rows": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xóa hàng: {str(e)}")


@router.get("/lich-su")
def get_lich_su_hang(
    ten_hang: str = Query(..., description="Tên hàng cần xem lịch sử"),
    cong_trinh_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=2000),
):
    """Lấy lịch sử nhập/xuất của 1 mặt hàng."""
    try:
        # Lấy phiếu list (có filter công trình nếu cần)
        phieu_list = db.get_phieu_list(
            cong_trinh_id=cong_trinh_id,
            limit=10000
        )
        # Lấy lịch sử và filter theo tên hàng
        lich_su = db.get_lich_su(phieu_list, limit=50000)
        filtered = [
            r for r in lich_su
            if ten_hang.lower() in r.get("ten_hang", "").lower()
        ][:limit]

        # Tính tổng nhập/xuất
        tong_nk = sum(r["so_luong"] for r in filtered if r.get("loai") == "NK")
        tong_xk = sum(r["so_luong"] for r in filtered if r.get("loai") == "XK")

        return {
            "ten_hang": ten_hang,
            "tong_nhap": tong_nk,
            "tong_xuat": tong_xk,
            "ton_kho": tong_nk - tong_xk,
            "lich_su": filtered,
            "total": len(filtered),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy lịch sử hàng: {str(e)}")
