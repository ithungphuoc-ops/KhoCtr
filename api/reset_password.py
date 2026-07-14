"""
Chạy 1 lần để reset mật khẩu: python reset_password.py
"""
import hashlib, secrets, sys, os
from dotenv import load_dotenv
load_dotenv()

import supabase_client as db

EMAIL    = "nguyenhuuphuoc@hpcons.com.vn"
NEW_PASS = "hpcons2026"

def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100_000)
    return f"{salt}:{dk.hex()}"

try:
    from urllib.parse import quote as _url_quote
    email_enc = _url_quote(EMAIL, safe='')
    rows = db.select("app_users", filters=f"email=eq.{email_enc}")
    if not rows:
        print(f"[!] Không tìm thấy user: {EMAIL}")
        print("    Danh sách email có trong DB:")
        all_users = db.select("app_users", query="id,email,role,active")
        for u in all_users:
            print(f"    - {u['email']} | role={u['role']} | active={u['active']}")
        sys.exit(1)

    user = rows[0]
    new_hash = hash_password(NEW_PASS)
    db.update("app_users", {"password_hash": new_hash, "active": True}, filters=f"id=eq.{user['id']}")
    print(f"[✓] Đã reset mật khẩu cho: {EMAIL}")
    print(f"    Mật khẩu mới: {NEW_PASS}")
    print(f"    Role: {user.get('role')}")

except Exception as e:
    print(f"[✗] Lỗi: {e}")
