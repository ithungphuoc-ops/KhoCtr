"""
routers/ghi_chu.py — CRUD Ghi chú công việc
Dùng chung cho App Tổng (xem tất cả CT) và App Công trình (chỉ CT đó).

Endpoints:
  GET    /api/ghi-chu/           → list + filter
  POST   /api/ghi-chu/           → tạo mới
  GET    /api/ghi-chu/{id}       → chi tiết
  PUT    /api/ghi-chu/{id}       → cập nhật
  DELETE /api/ghi-chu/{id}       → soft delete
  POST   /api/ghi-chu/{id}/complete → hoàn thành
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime, timezone

import supabase_client as db
from routers.auth import verify_token

router = APIRouter(prefix="/api/ghi-chu", tags=["ghi_chu"])

# ── Giá trị hợp lệ ───────────────────────────────────────────
VALID_MAU        = {"warning", "success", "danger", "info", "primary"}
VALID_UU_TIEN    = {"thap", "binh_thuong", "cao", "khan"}
VALID_TRANG_THAI = {"mo", "dang_lam", "tam_dung", "hoan_thanh", "huy"}


# ── Auth helper ───────────────────────────────────────────────

def _get_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Cần đăng nhập.")
    token = authorization.removeprefix("Bearer ").strip()
    user = verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc hết hạn.")
    return user


def _require_admin(authorization: Optional[str]) -> dict:
    user = _get_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chỉ Admin mới được thực hiện thao tác này.")
    return user


def _check_ct_access(user: dict, cong_trinh_id: int):
    """
    Admin: xem mọi CT.
    User : chỉ xem CT được phân quyền (dùng uid khớp với user_congtrinh.user_id).
    """
    if user.get("role") == "admin":
        return
    uid = user.get("uid", "")
    try:
        rows = db.select(
            "user_congtrinh",
            query="id",
            filters=f"user_id=eq.{uid}&cong_trinh_id=eq.{cong_trinh_id}"
        )
        if not rows:
            raise HTTPException(
                status_code=403,
                detail="Bạn không có quyền truy cập công trình này."
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=403, detail="Không thể xác minh quyền truy cập.")


# ── Pydantic models ───────────────────────────────────────────

class GhiChuCreate(BaseModel):
    cong_trinh_id: int
    tieu_de:       str
    noi_dung:      Optional[str] = ""
    mau:           str = "warning"
    uu_tien:       str = "binh_thuong"
    trang_thai:    str = "mo"
    deadline:      Optional[str] = None   # "YYYY-MM-DD"

    @validator("tieu_de")
    def tieu_de_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Tiêu đề không được để trống.")
        return v.strip()

    @validator("mau")
    def validate_mau(cls, v):
        if v not in VALID_MAU:
            raise ValueError(f"Màu không hợp lệ. Chọn: {sorted(VALID_MAU)}")
        return v

    @validator("uu_tien")
    def validate_uu_tien(cls, v):
        if v not in VALID_UU_TIEN:
            raise ValueError(f"Ưu tiên không hợp lệ. Chọn: {sorted(VALID_UU_TIEN)}")
        return v

    @validator("trang_thai")
    def validate_trang_thai(cls, v):
        if v not in VALID_TRANG_THAI:
            raise ValueError(f"Trạng thái không hợp lệ. Chọn: {sorted(VALID_TRANG_THAI)}")
        return v


class GhiChuUpdate(BaseModel):
    tieu_de:    Optional[str] = None
    noi_dung:   Optional[str] = None
    mau:        Optional[str] = None
    uu_tien:    Optional[str] = None
    trang_thai: Optional[str] = None
    deadline:   Optional[str] = None   # "" để xóa deadline

    @validator("mau")
    def validate_mau(cls, v):
        if v is not None and v not in VALID_MAU:
            raise ValueError(f"Màu không hợp lệ. Chọn: {sorted(VALID_MAU)}")
        return v

    @validator("uu_tien")
    def validate_uu_tien(cls, v):
        if v is not None and v not in VALID_UU_TIEN:
            raise ValueError(f"Ưu tiên không hợp lệ. Chọn: {sorted(VALID_UU_TIEN)}")
        return v

    @validator("trang_thai")
    def validate_trang_thai(cls, v):
        if v is not None and v not in VALID_TRANG_THAI:
            raise ValueError(f"Trạng thái không hợp lệ. Chọn: {sorted(VALID_TRANG_THAI)}")
        return v


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/")
def list_ghi_chu(
    cong_trinh_id:  Optional[int] = Query(None),
    trang_thai:     Optional[str] = Query(None),
    uu_tien:        Optional[str] = Query(None),
    search:         Optional[str] = Query(None),
    deadline_from:  Optional[str] = Query(None),
    deadline_to:    Optional[str] = Query(None),
    page:           int = Query(1, ge=1),
    limit:          int = Query(50, ge=1, le=200),
    authorization:  Optional[str] = Header(None),
):
    """
    Lấy danh sách ghi chú với filter đầy đủ.
    Admin: xem mọi CT (cong_trinh_id tùy chọn).
    User : phải truyền cong_trinh_id và phải có quyền trên CT đó.
    """
    user = _get_user(authorization)
    if user.get("role") != "admin":
        if not cong_trinh_id:
            raise HTTPException(status_code=400,
                                detail="User phải chỉ định cong_trinh_id.")
        _check_ct_access(user, cong_trinh_id)

    offset = (page - 1) * limit
    try:
        rows = db.get_ghi_chu_list(
            cong_trinh_id=cong_trinh_id,
            trang_thai=trang_thai,
            uu_tien=uu_tien,
            search=search,
            deadline_from=deadline_from,
            deadline_to=deadline_to,
            limit=limit,
            offset=offset,
        )
        return {"data": rows, "total": len(rows), "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_ghi_chu(body: GhiChuCreate, authorization: Optional[str] = Header(None)):
    """Tạo ghi chú mới. User chỉ được tạo cho CT mình có quyền."""
    user = _get_user(authorization)
    _check_ct_access(user, body.cong_trinh_id)
    try:
        row = db.create_ghi_chu(
            cong_trinh_id=body.cong_trinh_id,
            tieu_de=body.tieu_de,
            noi_dung=body.noi_dung or "",
            mau=body.mau,
            uu_tien=body.uu_tien,
            trang_thai=body.trang_thai,
            deadline=body.deadline or None,
            created_by=user.get("email", ""),
        )
        if not row:
            raise HTTPException(status_code=500, detail="Không thể tạo ghi chú.")
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ghi_chu_id}")
def get_ghi_chu(ghi_chu_id: int, authorization: Optional[str] = Header(None)):
    """Chi tiết 1 ghi chú."""
    user = _get_user(authorization)
    try:
        row = db.get_ghi_chu_by_id(ghi_chu_id)
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy ghi chú.")
        _check_ct_access(user, row["cong_trinh_id"])
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{ghi_chu_id}")
def update_ghi_chu(
    ghi_chu_id: int,
    body: GhiChuUpdate,
    authorization: Optional[str] = Header(None),
):
    """Cập nhật ghi chú. Chỉ cập nhật field được truyền."""
    user = _get_user(authorization)
    try:
        existing = db.get_ghi_chu_by_id(ghi_chu_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Không tìm thấy ghi chú.")
        _check_ct_access(user, existing["cong_trinh_id"])

        update_data: dict = {"updated_by": user.get("email", "")}
        if body.tieu_de   is not None: update_data["tieu_de"]    = body.tieu_de.strip()
        if body.noi_dung  is not None: update_data["noi_dung"]   = body.noi_dung
        if body.mau       is not None: update_data["mau"]        = body.mau
        if body.uu_tien   is not None: update_data["uu_tien"]    = body.uu_tien
        if body.trang_thai is not None:
            update_data["trang_thai"] = body.trang_thai
            # Tự động set completed_at nếu chuyển sang hoan_thanh
            if body.trang_thai == "hoan_thanh" and not existing.get("completed_at"):
                update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            elif body.trang_thai != "hoan_thanh":
                update_data["completed_at"] = None
        if body.deadline is not None:
            update_data["deadline"] = body.deadline if body.deadline else None

        row = db.update_ghi_chu(ghi_chu_id, update_data)
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{ghi_chu_id}")
def delete_ghi_chu(ghi_chu_id: int, authorization: Optional[str] = Header(None)):
    """
    Soft delete — chỉ set deleted_at, không xóa row.
    Dữ liệu vẫn còn trong DB để audit.
    """
    user = _get_user(authorization)
    try:
        existing = db.get_ghi_chu_by_id(ghi_chu_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Không tìm thấy ghi chú.")
        _check_ct_access(user, existing["cong_trinh_id"])
        ok = db.soft_delete_ghi_chu(ghi_chu_id, deleted_by=user.get("email", ""))
        if not ok:
            raise HTTPException(status_code=500, detail="Xóa thất bại.")
        return {"success": True, "message": "Đã xóa ghi chú (soft delete)."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{ghi_chu_id}/complete")
def complete_ghi_chu(ghi_chu_id: int, authorization: Optional[str] = Header(None)):
    """Đánh dấu hoàn thành — tự động ghi completed_at."""
    user = _get_user(authorization)
    try:
        existing = db.get_ghi_chu_by_id(ghi_chu_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Không tìm thấy ghi chú.")
        _check_ct_access(user, existing["cong_trinh_id"])
        if existing.get("trang_thai") == "hoan_thanh":
            return {"success": True, "message": "Ghi chú đã hoàn thành rồi.",
                    "data": existing}
        row = db.complete_ghi_chu(ghi_chu_id, updated_by=user.get("email", ""))
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
