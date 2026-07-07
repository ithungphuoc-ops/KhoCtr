"""
routers/cong_trinh.py - API endpoints cho Cong trinh
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import supabase_client as db

router = APIRouter(prefix="/api/cong-trinh", tags=["cong_trinh"])


class CongTrinhCreate(BaseModel):
    ma_ct: str
    ten_ct: str
    dia_chi: Optional[str] = ""
    ghi_chu: Optional[str] = ""

class CongTrinhUpdate(BaseModel):
    ten_ct: Optional[str] = None
    dia_chi: Optional[str] = None
    ghi_chu: Optional[str] = None

class UpdateTrangThai(BaseModel):
    trang_thai: str  # 'hoat_dong' | 'hoan_thanh'


@router.get("/")
def list_cong_trinh():
    try:
        rows = db.get_all_cong_trinh()
        return {"data": rows, "total": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Loi: {str(e)}")


@router.get("/{id}")
def get_cong_trinh(id: int):
    try:
        row = db.get_cong_trinh_by_id(id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Khong tim thay id={id}")
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Loi: {str(e)}")


@router.get("/{id}/stats")
def get_cong_trinh_stats(id: int):
    """Đếm số records sẽ bị xóa khi xóa CT này."""
    try:
        existing = db.select("cong_trinh", filters=f"id=eq.{id}")
        if not existing:
            raise HTTPException(status_code=404, detail=f"Khong tim thay id={id}")

        phieu_list = db.get_phieu_list(cong_trinh_id=id, limit=100000)
        phieu_count = len(phieu_list)
        phieu_ids = [p["id"] for p in phieu_list]

        chi_tiet_count = 0
        if phieu_ids:
            for i in range(0, len(phieu_ids), 100):
                chunk = phieu_ids[i:i + 100]
                ids_str = ",".join(str(x) for x in chunk)
                rows = db.select("chi_tiet_phieu", query="id", filters=f"phieu_id=in.({ids_str})")
                chi_tiet_count += len(rows)

        hang_hoa_list = db.get_all_hang_hoa(cong_trinh_id=id, limit=100000)
        hang_hoa_count = len(hang_hoa_list)

        return {
            "phieu_count": phieu_count,
            "hang_hoa_count": hang_hoa_count,
            "chi_tiet_count": chi_tiet_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{id}")
def delete_cong_trinh(id: int):
    try:
        existing = db.select("cong_trinh", filters=f"id=eq.{id}")
        if not existing:
            raise HTTPException(status_code=404, detail=f"Khong tim thay id={id}")

        # 1. Lấy tất cả phiếu của CT này
        phieu_list = db.get_phieu_list(cong_trinh_id=id, limit=100000)
        phieu_ids = [p["id"] for p in phieu_list]

        # 2. Xóa chi_tiet_phieu
        if phieu_ids:
            for i in range(0, len(phieu_ids), 100):
                chunk = phieu_ids[i:i + 100]
                ids_str = ",".join(str(x) for x in chunk)
                db.delete("chi_tiet_phieu", f"phieu_id=in.({ids_str})")

        # 3. Xóa phieu
        db.delete("phieu", f"cong_trinh_id=eq.{id}")

        # 4. Xóa hang_hoa
        db.delete("hang_hoa", f"cong_trinh_id=eq.{id}")

        # 5. Xóa cong_trinh
        db.delete("cong_trinh", f"id=eq.{id}")

        return {"success": True, "id": id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Loi xoa: {str(e)}")


@router.put("/{id}")
def update_cong_trinh(id: int, body: CongTrinhUpdate):
    """Cập nhật thông tin công trình."""
    try:
        data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="Khong co truong nao de cap nhat")
        rows = db.update("cong_trinh", data, f"id=eq.{id}")
        return rows[0] if rows else {"success": True, "id": id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{id}/trang-thai")
def update_trang_thai(id: int, body: UpdateTrangThai):
    """Cập nhật trạng thái công trình: hoat_dong | hoan_thanh"""
    if body.trang_thai not in ("hoat_dong", "hoan_thanh"):
        raise HTTPException(status_code=400, detail="trang_thai phai la 'hoat_dong' hoac 'hoan_thanh'")
    try:
        db.update("cong_trinh", {"trang_thai": body.trang_thai}, f"id=eq.{id}")
        return {"success": True, "id": id, "trang_thai": body.trang_thai}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_cong_trinh(body: CongTrinhCreate):
    try:
        row = db.upsert_cong_trinh(
            ma_ct=body.ma_ct,
            ten_ct=body.ten_ct,
            dia_chi=body.dia_chi or "",
            ghi_chu=body.ghi_chu or ""
        )
        if not row:
            raise HTTPException(status_code=500, detail="Khong the tao")
        # Tự động tạo config AI rỗng cho CT mới (is_active=False, chưa có key)
        try:
            ct_id = row.get("id")
            if ct_id:
                db.ensure_ai_config_exists(ct_id)
        except Exception:
            pass  # Không làm hỏng luồng tạo CT nếu AI config lỗi
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Loi tao: {str(e)}")
