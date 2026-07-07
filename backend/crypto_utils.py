"""
crypto_utils.py — Mã hóa/giải mã API Key an toàn
Dùng Fernet (AES-128-CBC + HMAC) từ thư viện cryptography

Quy tắc bắt buộc:
- Chỉ backend gọi decrypt_api_key()
- Không bao giờ trả plaintext về frontend hoặc log
- Admin chỉ thấy dạng masked: ************abcd
"""
import os
from cryptography.fernet import Fernet, MultiFernet, InvalidToken


def _get_fernet() -> MultiFernet:
    """
    Lấy MultiFernet instance từ ENCRYPTION_KEY trong environment.
    Hỗ trợ nhiều key (ENCRYPTION_KEYS=newkey,oldkey) để rotation tương lai.
    Raise RuntimeError ngay nếu chưa cấu hình.
    """
    # Hỗ trợ rotation: ENCRYPTION_KEYS=newkey,oldkey (key đầu dùng để encrypt)
    multi_raw = os.getenv("ENCRYPTION_KEYS", "").strip()
    single_raw = os.getenv("ENCRYPTION_KEY", "").strip()

    raw = multi_raw or single_raw
    if not raw:
        raise RuntimeError(
            "ENCRYPTION_KEY chưa được cấu hình. "
            "Thêm vào .env (local) hoặc Render Environment Variables. "
            "Xem docs/11_DEPLOYMENT.md để biết cách cấu hình."
        )

    key_list = [k.strip() for k in raw.split(",") if k.strip()]
    try:
        fernets = [Fernet(k.encode() if isinstance(k, str) else k) for k in key_list]
    except Exception as e:
        raise RuntimeError(f"ENCRYPTION_KEY không hợp lệ: {e}")

    return MultiFernet(fernets)


def encrypt_api_key(plaintext: str) -> str:
    """
    Mã hóa API Key trước khi lưu vào Database.
    Trả về ciphertext dạng string (base64 URL-safe).
    """
    if not plaintext or not plaintext.strip():
        return ""
    f = _get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_api_key(ciphertext: str) -> str:
    """
    Giải mã API Key để gọi AI.
    CHỈ backend gọi hàm này — không bao giờ trả kết quả về frontend.
    """
    if not ciphertext or not ciphertext.strip():
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise RuntimeError(
            "Không thể giải mã API Key: ENCRYPTION_KEY không khớp hoặc dữ liệu bị hỏng. "
            "Kiểm tra ENCRYPTION_KEY trong environment và docs/12_BACKUP_RECOVERY.md."
        )
    except Exception as e:
        raise RuntimeError(f"Lỗi giải mã API Key: {e}")


def mask_api_key(plaintext: str) -> str:
    """
    Trả về dạng masked để hiển thị cho Admin: ************abcd
    Không bao giờ trả về plaintext ra ngoài.
    """
    if not plaintext:
        return ""
    if len(plaintext) <= 4:
        return "****"
    visible = plaintext[-4:]
    hidden  = "*" * max(8, len(plaintext) - 4)
    return hidden + visible


def log_safe_key(plaintext: str) -> str:
    """
    Dạng an toàn để ghi log: sk-ant-... (chỉ 6 ký tự đầu + dấu ...).
    Dùng thay cho việc log plaintext.
    """
    if not plaintext:
        return "EMPTY"
    return plaintext[:6] + "..."
