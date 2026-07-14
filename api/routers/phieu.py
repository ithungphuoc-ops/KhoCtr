"""
routers/phieu.py — API endpoints cho Phiếu NK/XK
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import supabase_client as db

router = APIRouter(prefix="/api/phieu", tags=["phieu"])


class PhieuItem(BaseModel):
    ma_hang: Optional[str] = ""
    ten_hang: str
    dvt: Optional[str] = "cái"
    so_luong: Optional[float] = 0
    don_gia: Optional[float] = 0
    thanh_tien: Optional[float] = 0
    ghi_chu: Optional[str] = ""


class PhieuCreate(BaseModel):
    cong_trinh_id: int
    loai: str                        # NK hoặc XK
    so_phieu: str
    ngay: str                        # YYYY-MM-DD
    doi_tac: Optional[str] = ""
    ghi_chu: Optional[str] = ""
    tong_tien: Optional[float] = 0
    items: Optional[List[PhieuItem]] = []
    user_email: Optional[str] = ""   # Ghi nhật ký


@router.get("/")
def list_phieu(
    cong_trinh_id: Optional[int] = Query(None, description="Lọc theo công trình"),
    loai: Optional[str] = Query(None, description="NK hoặc XK"),
    search: Optional[str] = Query(None, description="Tìm theo số phiếu hoặc đối tác"),
    date_from: Optional[str] = Query(None, description="Từ ngày YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="Đến ngày YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Lấy danh sách phiếu với filter và pagination."""
    try:
        rows = db.get_phieu_list(
            cong_trinh_id=cong_trinh_id,
            loai=loai,
            search=search,
            limit=limit,
            offset=offset,
            date_from=date_from,
            date_to=date_to,
        )
        return {"data": rows, "total": len(rows), "limit": limit, "offset": offset}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy danh sách phiếu: {str(e)}")


@router.get("/{id}/chi-tiet")
def get_chi_tiet_phieu(id: int):
    """Lấy chi tiết hàng hóa của 1 phiếu."""
    try:
        items = db.get_chi_tiet_phieu(id)
        return {"phieu_id": id, "items": items, "total": len(items)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy chi tiết phiếu: {str(e)}")


@router.post("/")
def create_phieu(body: PhieuCreate):
    """Tạo phiếu mới kèm chi tiết hàng hóa."""
    try:
        # Kiểm tra trùng số phiếu trong cùng công trình
        existing = db.select("phieu", filters=f"cong_trinh_id=eq.{body.cong_trinh_id}&so_phieu=eq.{body.so_phieu}")
        if existing:
            raise HTTPException(status_code=409, detail=f"Số phiếu '{body.so_phieu}' đã tồn tại trong công trình này")

        # Tính tổng tiền nếu chưa có
        tong_tien = body.tong_tien or 0
        if not tong_tien and body.items:
            tong_tien = sum(
                (it.thanh_tien or it.so_luong * it.don_gia)
                for it in body.items
            )

        phieu = db.create_phieu(
            cong_trinh_id=body.cong_trinh_id,
            loai=body.loai,
            so_phieu=body.so_phieu,
            ngay=body.ngay,
            doi_tac=body.doi_tac or "",
            ghi_chu=body.ghi_chu or "",
            tong_tien=tong_tien,
            nguon="web"
        )
        if not phieu:
            raise HTTPException(status_code=500, detail="Không thể tạo phiếu")

        phieu_id = phieu["id"]

        # Push chi tiết
        if body.items:
            items_data = [it.model_dump() for it in body.items]
            for it in items_data:
                if not it.get("thanh_tien"):
                    it["thanh_tien"] = it["so_luong"] * it["don_gia"]
            db.push_chi_tiet(phieu_id, items_data)

        # Ghi nhật ký
        db.log_activity(
            action=f"create_{body.loai.lower()}",
            entity_type="phieu",
            entity_id=str(phieu_id),
            details=f"{body.loai} {body.so_phieu} | {body.ngay} | {body.doi_tac or ''} | {body.tong_tien or 0:,.0f} VND",
            user_email=body.user_email or "",
            cong_trinh_id=body.cong_trinh_id,
        )

        return {
            "success": True,
            "phieu_id": phieu_id,
            "phieu": phieu,
            "so_items": len(body.items) if body.items else 0
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tạo phiếu: {str(e)}")


class PhieuUpdate(BaseModel):
    ngay: str
    doi_tac: Optional[str] = ""
    ghi_chu: Optional[str] = ""
    tong_tien: Optional[float] = 0
    items: Optional[List[PhieuItem]] = []
    user_email: Optional[str] = ""
    loai: Optional[str] = "NK"
    so_phieu: Optional[str] = ""
    cong_trinh_id: Optional[int] = None


@router.get("/lich-su")
def get_lich_su_giao_dich(
    cong_trinh_id: Optional[int] = Query(None),
    loai: Optional[str] = Query(None, description="NK hoặc XK"),
    ten_hang: Optional[str] = Query(None, description="Tìm theo tên hàng"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    """Lịch sử giao dịch chi tiết — toàn bộ nhập/xuất theo thời gian."""
    try:
        phieu_list = db.get_phieu_list(
            cong_trinh_id=cong_trinh_id,
            loai=loai,
            date_from=date_from,
            date_to=date_to,
            limit=10000,
        )
        lich_su = db.get_lich_su(phieu_list, limit=50000)
        if ten_hang:
            lich_su = [r for r in lich_su if ten_hang.lower() in r.get("ten_hang", "").lower()]
        lich_su.sort(key=lambda x: x.get("ngay", ""), reverse=True)
        total = len(lich_su)
        return {"data": lich_su[offset: offset + limit], "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy lịch sử: {str(e)}")


@router.put("/{id}")
def update_phieu(id: int, body: PhieuUpdate):
    """Cập nhật phiếu + chi tiết hàng hóa."""
    try:
        tong_tien = body.tong_tien or 0
        if not tong_tien and body.items:
            tong_tien = sum(
                (it.thanh_tien or it.so_luong * it.don_gia)
                for it in body.items
            )

        db.update_phieu(id, {
            "ngay": body.ngay,
            "doi_tac": body.doi_tac or "",
            "ghi_chu": body.ghi_chu or "",
            "tong_tien": tong_tien,
        })

        # Xóa chi tiết cũ, thêm mới
        db.delete("chi_tiet_phieu", filters=f"phieu_id=eq.{id}")
        if body.items:
            items_data = [it.model_dump() for it in body.items]
            for it in items_data:
                if not it.get("thanh_tien"):
                    it["thanh_tien"] = it["so_luong"] * it["don_gia"]
            db.push_chi_tiet(id, items_data)

        db.log_activity(
            action=f"update_{(body.loai or 'nk').lower()}",
            entity_type="phieu",
            entity_id=str(id),
            details=f"Cập nhật {body.loai or 'NK'} {body.so_phieu or ''} | {body.ngay} | {body.doi_tac or ''} | {tong_tien:,.0f} VND",
            user_email=body.user_email or "",
            cong_trinh_id=body.cong_trinh_id,
        )

        return {"success": True, "phieu_id": id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật phiếu: {str(e)}")


@router.delete("/{id}")
def delete_phieu(id: int, user_email: Optional[str] = Query(None)):
    """Xóa phiếu và toàn bộ chi tiết phiếu."""
    try:
        db.delete_phieu(id)
        db.log_activity(
            action="delete_phieu",
            entity_type="phieu",
            entity_id=str(id),
            details=f"Xoa phieu id={id}",
            user_email=user_email or "",
        )
        return {"success": True, "deleted_id": id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xóa phiếu: {str(e)}")
