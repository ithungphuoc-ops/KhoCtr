"""
routers/hang_hoa.py — API endpoints cho Danh mục hàng hóa
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import supabase_client as db

router = APIRouter(prefix="/api/hang-hoa", tags=["hang_hoa"])


class HangHoaCreate(BaseModel):
    ma_hang: Optional[str] = None   # tự gen nếu để trống
    ten_hang: str
    dvt: Optional[str] = "cái"
    nhom: Optional[str] = ""
    cong_trinh_id: Optional[int] = None


class HangHoaUpdate(BaseModel):
    ten_hang: Optional[str] = None
    dvt: Optional[str] = None
    nhom: Optional[str] = None
    cong_trinh_id: Optional[int] = None


@router.get("/")
def list_hang_hoa(
    cong_trinh_id: Optional[int] = Query(None, description="Lọc theo công trình"),
    search: Optional[str] = Query(None, description="Tìm theo tên hoặc mã hàng"),
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    """Lấy danh mục hàng hóa."""
    try:
        rows = db.get_all_hang_hoa(
            cong_trinh_id=cong_trinh_id,
            search=search,
            limit=limit,
            offset=offset
        )
        return {"data": rows, "total": len(rows), "limit": limit, "offset": offset}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy danh mục hàng hóa: {str(e)}")


@router.post("/")
def create_hang_hoa(body: HangHoaCreate):
    """Tạo mặt hàng mới."""
    try:
        import re, time
        data = body.model_dump()
        # Tự gen ma_hang nếu không có
        if not data.get("ma_hang"):
            slug = re.sub(r"[^A-Za-z0-9]", "-", (data["ten_hang"] or "HH"))[:20].upper().strip("-")
            data["ma_hang"] = f"{slug}-{int(time.time()) % 100000}"
        row = db.create_hang_hoa(data)
        if not row:
            raise HTTPException(status_code=500, detail="Không thể tạo mặt hàng")
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tạo mặt hàng: {str(e)}")


@router.put("/{ma_hang}")
def update_hang_hoa(ma_hang: str, body: HangHoaUpdate):
    """Cập nhật mặt hàng theo mã hàng."""
    try:
        # Chỉ update các trường được cung cấp (không None)
        data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="Không có trường nào để cập nhật")
        row = db.update_hang_hoa(ma_hang, data)
        if not row:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy mã hàng: {ma_hang}")
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật mặt hàng: {str(e)}")


@router.delete("/{ma_hang}")
def delete_hang_hoa(ma_hang: str):
    """Xóa mặt hàng theo mã hàng."""
    try:
        db.delete_hang_hoa(ma_hang)
        return {"success": True, "deleted_ma_hang": ma_hang}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xóa mặt hàng: {str(e)}")
