"""
routers/nhat_ky.py — Nhật ký hoạt động (Audit Log)
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import supabase_client as db

router = APIRouter(prefix="/api/nhat-ky", tags=["nhat_ky"])


class LogEntry(BaseModel):
    action: str
    entity_type: Optional[str] = "manual"
    entity_id: Optional[str] = ""
    details: Optional[str] = ""
    user_email: Optional[str] = ""
    cong_trinh_id: Optional[int] = None


@router.get("/")
def get_nhat_ky(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None),
    cong_trinh_id: Optional[int] = Query(None),
):
    """Lấy danh sách nhật ký hoạt động, mới nhất trước."""
    try:
        rows = db.get_activity_log(
            limit=limit,
            offset=offset,
            action=action,
            cong_trinh_id=cong_trinh_id,
        )
        return {"data": rows, "total": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy nhật ký: {str(e)}")


@router.post("/log")
def create_log(body: LogEntry):
    """Ghi một nhật ký thủ công từ frontend."""
    try:
        db.log_activity(
            action=body.action,
            entity_type=body.entity_type or "manual",
            entity_id=body.entity_id or "",
            details=body.details or "",
            user_email=body.user_email or "",
            cong_trinh_id=body.cong_trinh_id,
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi ghi log: {str(e)}")
