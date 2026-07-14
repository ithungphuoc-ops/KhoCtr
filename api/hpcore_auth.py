"""
hpcore_auth.py — Xác thực qua SSO hpcore.vn (app tổng HP Cons)
Verify session cookie Firebase (domain .hpcore.vn) + đọc vai trò từ app_permissions.
"""
import os
import json
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials, firestore

HPCORE_SESSION_COOKIE = "session"
HPCORE_APP_ID = "warehouse"  # id app này trong app_permissions / rolesEndpoint của hpcore

_hpcore_app = None


def _get_hpcore_app():
    global _hpcore_app
    if _hpcore_app is None:
        sa_json = os.getenv("HPCORE_FIREBASE_SERVICE_ACCOUNT", "")
        if not sa_json:
            raise RuntimeError("Thiếu HPCORE_FIREBASE_SERVICE_ACCOUNT trong environment")
        cred = credentials.Certificate(json.loads(sa_json))
        try:
            _hpcore_app = firebase_admin.get_app("hpcore")
        except ValueError:
            _hpcore_app = firebase_admin.initialize_app(cred, name="hpcore")
    return _hpcore_app


def verify_session(cookie: str) -> dict | None:
    """Verify session cookie hpcore, trả về {uid, email} hoặc None nếu không hợp lệ."""
    if not cookie:
        return None
    try:
        app = _get_hpcore_app()
        decoded = firebase_auth.verify_session_cookie(cookie, check_revoked=True, app=app)
        return {"uid": decoded["uid"], "email": decoded.get("email", "")}
    except Exception:
        return None


def get_app_role(uid: str) -> str | None:
    """Đọc vai trò của user cho app này từ app_permissions/{uid}.{HPCORE_APP_ID}."""
    app = _get_hpcore_app()
    db = firestore.client(app=app)
    doc = db.collection("app_permissions").document(uid).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    role = data.get(HPCORE_APP_ID)
    return role if isinstance(role, str) else None
