"""
routers/auth.py — Đăng nhập / Auth cho HPCons AppTong
Dùng Python built-ins (hashlib, hmac, base64) — không cần cài thêm thư viện
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import hashlib, hmac as hmac_lib, base64, json, time, secrets, os
from urllib.parse import quote as _url_quote
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import supabase_client as db

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET:
    raise RuntimeError("Thiếu JWT_SECRET trong .env")


# ── Password ──────────────────────────────────────────────────

def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100_000)
    return f"{salt}:{dk.hex()}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt = stored.split(":")[0]
        return hmac_lib.compare_digest(hash_password(password, salt), stored)
    except Exception:
        return False


# ── Token ─────────────────────────────────────────────────────

def create_token(user: dict) -> str:
    payload = json.dumps({
        "uid":   user["id"],
        "email": user["email"],
        "ten":   user.get("ten", ""),
        "role":  user.get("role", "user"),
        "exp":   time.time() + 86400 * 7,   # 7 ngày
    }, ensure_ascii=False)
    sig = hmac_lib.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=") + "." + sig
    return token

def verify_token(token: str) -> Optional[dict]:
    try:
        parts = token.rsplit(".", 1)
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        # Thêm padding nếu thiếu
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload = base64.urlsafe_b64decode(payload_b64).decode()
        expected = hmac_lib.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac_lib.compare_digest(sig, expected):
            return None
        data = json.loads(payload)
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None


# ── Endpoints ─────────────────────────────────────────────────

class LoginBody(BaseModel):
    email: str
    password: str

class CreateUserBody(BaseModel):
    email: str
    ten: str
    password: str
    role: Optional[str] = "user"
    setup_key: Optional[str] = None  # cần khi tạo admin đầu tiên


@router.post("/login")
def login(body: LoginBody):
    """Đăng nhập — trả về access_token."""
    try:
        email_enc = _url_quote(body.email, safe='')
        rows = db.select("app_users", filters=f"email=eq.{email_enc}&active=eq.true")
        if not rows:
            raise HTTPException(status_code=401, detail="Email hoac mat khau khong dung")
        user = rows[0]
        if not verify_password(body.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Email hoac mat khau khong dung")
        token = create_token(user)
        db.log_activity(
            action="login",
            entity_type="user",
            entity_id=str(user["id"]),
            details=f"Dang nhap: {user['email']} | Role: {user.get('role', 'user')}",
            user_email=user["email"],
        )
        return {
            "access_token": token,
            "token_type":   "bearer",
            "user": {
                "id":    user["id"],
                "email": user["email"],
                "ten":   user.get("ten", ""),
                "role":  user.get("role", "user"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
def me(authorization: Optional[str] = Header(None)):
    """Lấy thông tin user hiện tại từ token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap")
    token = authorization.split(" ", 1)[1]
    data = verify_token(token)
    if not data:
        raise HTTPException(status_code=401, detail="Token het han hoac khong hop le")
    return data


@router.post("/logout")
def logout():
    return {"success": True}


# ── Phân quyền công trình ─────────────────────────────────────

class PermBody(BaseModel):
    permissions: list  # [{ user_id, cong_trinh_id }]


@router.get("/permissions")
def get_permissions(authorization: Optional[str] = Header(None)):
    """Lấy toàn bộ phân quyền — chỉ admin."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap")
    token_data = verify_token(authorization.split(" ", 1)[1])
    if not token_data or token_data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chi admin")
    try:
        rows = db.select("user_congtrinh")
        return {"permissions": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/permissions")
def save_permissions(body: PermBody, authorization: Optional[str] = Header(None)):
    """Lưu lại toàn bộ phân quyền (xóa cũ, insert mới) — chỉ admin."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap")
    token_data = verify_token(authorization.split(" ", 1)[1])
    if not token_data or token_data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chi admin")
    try:
        # Xóa toàn bộ cũ
        db.delete("user_congtrinh", "id=gte.0")
        # Insert mới
        if body.permissions:
            db.insert("user_congtrinh", body.permissions)
        return {"success": True, "count": len(body.permissions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
def list_users(authorization: Optional[str] = Header(None)):
    """Lấy danh sách tất cả users — chỉ admin."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap")
    token_data = verify_token(authorization.split(" ", 1)[1])
    if not token_data or token_data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chi admin moi xem duoc")
    try:
        rows = db.select("app_users", query="id,email,ten,role,active,created_at", order="id.asc")
        return {"users": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ResetPasswordBody(BaseModel):
    new_password: str

@router.put("/users/{user_id}/reset-password")
def reset_password(user_id: int, body: ResetPasswordBody, authorization: Optional[str] = Header(None)):
    """Admin reset mật khẩu cho user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap")
    token_data = verify_token(authorization.split(" ", 1)[1])
    if not token_data or token_data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chi admin moi reset duoc")
    if not body.new_password or len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mat khau phai tu 6 ky tu tro len")
    try:
        new_hash = hash_password(body.new_password)
        rows = db.update("app_users", {"password_hash": new_hash}, filters=f"id=eq.{user_id}")
        if not rows:
            raise HTTPException(status_code=404, detail="Khong tim thay user")
        return {"success": True, "message": "Da reset mat khau thanh cong"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{user_id}")
def delete_user(user_id: int, authorization: Optional[str] = Header(None)):
    """Xóa user — chỉ admin."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap")
    token_data = verify_token(authorization.split(" ", 1)[1])
    if not token_data or token_data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chi admin moi xoa duoc")
    if token_data.get("uid") == user_id:
        raise HTTPException(status_code=400, detail="Khong the xoa chinh minh")
    try:
        db.delete("app_users", f"id=eq.{user_id}")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-congtrinh")
def my_congtrinh(authorization: Optional[str] = Header(None)):
    """Lay danh sach cong trinh cua user dang dang nhap."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Chua dang nhap")
    token_data = verify_token(authorization.split(" ", 1)[1])
    if not token_data:
        raise HTTPException(status_code=401, detail="Token het han")
    uid  = token_data.get("uid")
    role = token_data.get("role")
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


@router.post("/create-user")
def create_user(body: CreateUserBody, authorization: Optional[str] = Header(None)):
    """
    Tạo user mới.
    - Lần đầu (chưa có user nào): dùng setup_key = 'HPCONS_SETUP_2026'
    - Sau đó: chỉ admin mới tạo được
    """
    SETUP_KEY = os.getenv("SETUP_KEY", "")

    # Kiểm tra quyền
    existing = db.select("app_users")
    if not existing:
        # Chưa có user nào — cho phép tạo admin đầu tiên với setup_key
        if not SETUP_KEY:
            raise HTTPException(
                status_code=503,
                detail="Server chưa cấu hình SETUP_KEY. Liên hệ quản trị viên để thiết lập."
            )
        if body.setup_key != SETUP_KEY:
            raise HTTPException(status_code=403, detail="Cần setup_key để tạo admin đầu tiên")
        body.role = "admin"
    else:
        # Đã có user — chỉ admin mới tạo được
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Chua dang nhap")
        token_data = verify_token(authorization.split(" ", 1)[1])
        if not token_data or token_data.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Chi admin moi tao duoc tai khoan")

    try:
        pw_hash = hash_password(body.password)
        result = db.insert("app_users", {
            "email":         body.email,
            "ten":           body.ten,
            "password_hash": pw_hash,
            "role":          body.role,
            "active":        True,
        })
        user = result[0] if result else {}
        return {"success": True, "id": user.get("id"), "email": body.email}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Loi tao user: {str(e)}")
