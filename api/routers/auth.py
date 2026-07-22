"""
routers/auth.py — Xác thực qua SSO hpcore.vn (app tổng HP Cons)
Đăng nhập/đăng xuất/vai trò lấy từ hpcore (cookie session + app_permissions).
Phân quyền công trình (user_congtrinh) vẫn quản lý nội bộ — dữ liệu đặc thù KhoUNICE.
"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional
from urllib.parse import quote as _url_quote
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import firestore_client as db
import hpcore_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])

HPCORE_LOGIN_URL = "https://account.hpcore.vn/login"


# ── Xác thực chung — dùng lại ở các router khác (ai_config, ai_routes, ghi_chu) ──

def get_hpcore_session(request: Request) -> Optional[dict]:
    """Chỉ verify cookie session hpcore, CHƯA kiểm tra quyền cho app này."""
    cookie = request.cookies.get(hpcore_auth.HPCORE_SESSION_COOKIE)
    return hpcore_auth.verify_session(cookie)


def get_current_user(request: Request) -> Optional[dict]:
    """
    Verify cookie session hpcore + lấy vai trò từ app_permissions + đồng bộ app_users nội bộ.
    Trả về {"uid": <id nội bộ, int>, "email": str, "ten": str, "role": "admin"|"user",
    "avatar": str|None} hoặc None.
    Giữ đúng shape cũ (uid = id nội bộ) để user_congtrinh/permissions không phải đổi gì.
    """
    session = get_hpcore_session(request)
    if not session:
        return None
    role = hpcore_auth.get_app_role(session["uid"])
    if not role:
        return None  # có đăng nhập hpcore nhưng chưa được cấp quyền cho app này

    # Đọc avatar mới nhất từ app tổng (hpcore) — app tổng chỉ lưu avatar ở Firestore
    # users/{uid}.avatarUrl, KHÔNG có trong session cookie, nên phải đọc live mỗi lần.
    avatar_url = hpcore_auth.get_avatar_url(session["uid"])

    email = session["email"]
    email_enc = _url_quote(email, safe="")
    existing = db.select("app_users", filters=f"email=eq.{email_enc}")
    ten = email.split("@")[0]
    if existing:
        user = existing[0]
        # avatar app tổng luôn thắng khi có; chỉ giữ avatar cũ trong app này nếu
        # app tổng hiện không có avatar nào (tránh xóa mất avatar đã đồng bộ trước đó).
        avatar = avatar_url if avatar_url else user.get("avatar")
        if user.get("role") != role or not user.get("active") or user.get("avatar") != avatar:
            rows = db.update("app_users", {"role": role, "active": True, "avatar": avatar},
                              filters=f"email=eq.{email_enc}")
            user = rows[0] if rows else user
    else:
        avatar = avatar_url
        # password_hash không còn dùng (đăng nhập qua SSO hpcore) nhưng cột DB đang NOT NULL —
        # điền giá trị cố định để tránh lỗi ràng buộc, không phải mật khẩu thật.
        rows = db.insert("app_users", {
            "email": email, "ten": ten, "role": role, "active": True, "avatar": avatar,
            "password_hash": "SSO_HPCORE_NO_PASSWORD",
        })
        user = rows[0] if rows else {"id": None, "email": email, "ten": ten, "role": role, "avatar": avatar}

    return {"uid": user["id"], "email": email, "ten": user.get("ten", ten), "role": role,
            "avatar": user.get("avatar", avatar_url)}


def require_user(request: Request) -> dict:
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Chưa đăng nhập hoặc chưa được cấp quyền")
    return user


def require_admin(request: Request) -> dict:
    user = require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới thực hiện được thao tác này")
    return user


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/me")
def me(request: Request):
    """
    Lấy thông tin user hiện tại từ session hpcore.
    401 = chưa đăng nhập hpcore (frontend redirect sang hpcore login).
    403 = đã đăng nhập hpcore nhưng chưa được cấp quyền app này (frontend hiện thông báo, KHÔNG redirect).
    """
    session = get_hpcore_session(request)
    if not session:
        raise HTTPException(status_code=401, detail="Chua dang nhap")
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=403, detail="Chua duoc cap quyen truy cap KhoUNICE. Lien he quan tri vien.")
    return user


@router.post("/logout")
def logout(response: Response):
    """Xóa cookie session hpcore (dùng chung domain .hpcore.vn)."""
    response.set_cookie(
        key=hpcore_auth.HPCORE_SESSION_COOKIE, value="", max_age=0,
        domain=".hpcore.vn", path="/", httponly=True, secure=True, samesite="lax",
    )
    return {"success": True, "login_url": HPCORE_LOGIN_URL}


# ── Phân quyền công trình (giữ nguyên logic cũ) ────────────────

class PermBody(BaseModel):
    permissions: list  # [{ user_id, cong_trinh_id }]


@router.get("/permissions")
def get_permissions(request: Request):
    """Lấy toàn bộ phân quyền — chỉ admin."""
    require_admin(request)
    try:
        rows = db.select("user_congtrinh")
        return {"permissions": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/permissions")
def save_permissions(body: PermBody, request: Request):
    """Lưu lại toàn bộ phân quyền (xóa cũ, insert mới) — chỉ admin."""
    require_admin(request)
    try:
        db.delete("user_congtrinh", "id=gte.0")
        if body.permissions:
            db.insert("user_congtrinh", body.permissions)
        return {"success": True, "count": len(body.permissions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
def list_users(request: Request):
    """Lấy danh sách tất cả users (đồng bộ từ hpcore khi đăng nhập) — chỉ admin. Dùng cho /phan-quyen."""
    require_admin(request)
    try:
        rows = db.select("app_users", query="id,email,ten,role,active,created_at", order="id.asc")
        return {"users": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-congtrinh")
def my_congtrinh(request: Request):
    """Lay danh sach cong trinh cua user dang dang nhap."""
    user = require_user(request)
    uid, role = user["uid"], user["role"]
    if role == "admin":
        cts = db.select("cong_trinh", order="id.asc")
        return {"congtrinhs": cts, "is_admin": True}
    perms  = db.select("user_congtrinh", filters=f"user_id=eq.{uid}")
    ct_ids = [p["cong_trinh_id"] for p in perms]
    if not ct_ids:
        return {"congtrinhs": [], "is_admin": False}
    ct_list = []
    for ct_id in ct_ids:
        rows = db.select("cong_trinh", filters=f"id=eq.{ct_id}")
        ct_list.extend(rows)
    return {"congtrinhs": ct_list, "is_admin": False}
