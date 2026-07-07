"""
routers/ai_config.py — Quản lý cấu hình AI theo từng công trình
Admin-only (trừ GET /providers và GET /{id} cho user xem trạng thái)

Bảo mật bắt buộc:
- api_key_enc KHÔNG BAO GIỜ trả về frontend
- Admin chỉ thấy dạng masked: ************abcd
- Chỉ backend decrypt để gọi AI (endpoint /test-connection)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import urllib.request, urllib.error, json as _json
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, validator
from typing import Optional

import supabase_client as db
from crypto_utils import encrypt_api_key, decrypt_api_key, mask_api_key, log_safe_key
from ai_providers import (
    validate_api_key_format, list_providers_info,
    get_provider, is_valid_provider, list_providers,
)
from routers.auth import verify_token

router = APIRouter(prefix="/api/ai-config", tags=["ai_config"])


# ── Auth helpers ──────────────────────────────────────────────

def _require_admin(authorization: Optional[str]) -> dict:
    """Kiểm tra token hợp lệ + role=admin. Raise 401/403 nếu không đủ quyền."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Cần đăng nhập.")
    token = authorization.removeprefix("Bearer ").strip()
    user = verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn.")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Chỉ Admin mới được thao tác cấu hình AI.")
    return user


def _require_auth(authorization: Optional[str]) -> dict:
    """Kiểm tra token hợp lệ (mọi role)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Cần đăng nhập.")
    token = authorization.removeprefix("Bearer ").strip()
    user = verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn.")
    return user


# ── Safe response helper ──────────────────────────────────────

def _safe_config(row: dict) -> dict:
    """
    Loại bỏ api_key_enc khỏi response, thay bằng api_key_masked.
    KHÔNG BAO GIỜ trả api_key_enc hoặc plaintext về frontend.
    """
    if not row:
        return {}
    result = {k: v for k, v in row.items() if k != "api_key_enc"}
    enc = row.get("api_key_enc", "")
    if enc:
        try:
            plain = decrypt_api_key(enc)
            result["api_key_masked"] = mask_api_key(plain)
            result["api_key_set"] = True
        except Exception:
            result["api_key_masked"] = "****[lỗi giải mã]"
            result["api_key_set"] = False
    else:
        result["api_key_masked"] = ""
        result["api_key_set"] = False
    return result


# ── Pydantic models ───────────────────────────────────────────

class AIConfigCreate(BaseModel):
    provider: str = "gemini"
    api_key: str = ""          # plaintext từ admin — backend sẽ encrypt trước khi lưu
    model: Optional[str] = None
    max_tokens: int = 4096
    system_prompt: Optional[str] = None

    @validator("provider")
    def validate_provider(cls, v):
        if not is_valid_provider(v):
            raise ValueError(f"Provider không hợp lệ. Chọn: {list_providers()}")
        return v


class AIConfigUpdate(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None   # plaintext — backend encrypt trước khi lưu
    model: Optional[str] = None
    max_tokens: Optional[int] = None
    system_prompt: Optional[str] = None

    @validator("provider")
    def validate_provider(cls, v):
        if v is not None and not is_valid_provider(v):
            raise ValueError(f"Provider không hợp lệ. Chọn: {list_providers()}")
        return v


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/providers")
def get_providers():
    """Danh sách provider AI được hỗ trợ (public — không cần auth)."""
    return {"providers": list_providers_info()}


@router.get("/")
def list_all_configs(authorization: Optional[str] = Header(None)):
    """[Admin] Xem cấu hình AI của tất cả công trình."""
    _require_admin(authorization)
    try:
        rows = db.get_all_ai_configs()
        return {"data": [_safe_config(r) for r in rows], "total": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{cong_trinh_id}")
def get_config(cong_trinh_id: int, authorization: Optional[str] = Header(None)):
    """
    Lấy cấu hình AI của 1 công trình.
    Admin: thấy api_key_masked + đầy đủ thông tin.
    User : chỉ thấy trạng thái (configured, provider, is_active).
    """
    user = _require_auth(authorization)
    try:
        row = db.get_ai_config_by_ct(cong_trinh_id)
        if not row:
            return {
                "configured": False,
                "cong_trinh_id": cong_trinh_id,
                "message": "Công trình này chưa được cấu hình API AI. Liên hệ Admin để thêm vào.",
            }
        safe = _safe_config(row)
        if user.get("role") != "admin":
            # User chỉ thấy trạng thái, không thấy key dù masked
            return {
                "configured": safe.get("api_key_set", False),
                "cong_trinh_id": cong_trinh_id,
                "provider": safe.get("provider"),
                "model": safe.get("model"),
                "is_active": safe.get("is_active"),
                "last_test_status": safe.get("last_test_status"),
                "last_test_at": safe.get("last_test_at"),
            }
        return {"configured": safe.get("api_key_set", False), **safe}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{cong_trinh_id}")
def create_or_update_config(
    cong_trinh_id: int,
    body: AIConfigCreate,
    authorization: Optional[str] = Header(None),
):
    """
    [Admin] Tạo hoặc cập nhật cấu hình AI cho 1 công trình.
    api_key nhận plaintext → validate format → encrypt → lưu DB.
    Khi đổi key → is_active reset về False (cần test lại).
    """
    _require_admin(authorization)

    # Validate format key trước khi lưu (nhanh, offline)
    if body.api_key:
        ok, msg = validate_api_key_format(body.provider, body.api_key)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)

    try:
        api_key_enc = encrypt_api_key(body.api_key) if body.api_key else ""

        existing = db.get_ai_config_by_ct(cong_trinh_id)
        if existing:
            update_data: dict = {
                "provider":   body.provider,
                "max_tokens": body.max_tokens,
            }
            if api_key_enc:
                # Key mới → reset trạng thái test
                update_data["api_key_enc"]      = api_key_enc
                update_data["is_active"]        = False
                update_data["last_test_status"] = None
                update_data["last_test_at"]     = None
                update_data["last_error"]       = None
            if body.model is not None:
                update_data["model"] = body.model
            if body.system_prompt is not None:
                update_data["system_prompt"] = body.system_prompt
            row = db.update_ai_config(cong_trinh_id, update_data)
        else:
            row = db.create_ai_config(
                cong_trinh_id=cong_trinh_id,
                provider=body.provider,
                api_key_enc=api_key_enc,
                model=body.model or "",
                max_tokens=body.max_tokens,
                system_prompt=body.system_prompt or "",
                is_active=False,
            )

        print(f"[ai_config] Lưu config CT={cong_trinh_id} provider={body.provider} "
              f"key={log_safe_key(body.api_key) if body.api_key else 'EMPTY'}")
        return {"success": True, "data": _safe_config(row)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{cong_trinh_id}")
def update_config(
    cong_trinh_id: int,
    body: AIConfigUpdate,
    authorization: Optional[str] = Header(None),
):
    """[Admin] Cập nhật một phần cấu hình (PATCH-style)."""
    _require_admin(authorization)

    if body.api_key and body.provider:
        ok, msg = validate_api_key_format(body.provider, body.api_key)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)

    try:
        if not db.get_ai_config_by_ct(cong_trinh_id):
            raise HTTPException(status_code=404, detail="Chưa có cấu hình AI cho công trình này.")

        update_data: dict = {}
        if body.provider is not None:      update_data["provider"]       = body.provider
        if body.max_tokens is not None:    update_data["max_tokens"]     = body.max_tokens
        if body.model is not None:         update_data["model"]          = body.model
        if body.system_prompt is not None: update_data["system_prompt"]  = body.system_prompt
        if body.api_key:
            update_data["api_key_enc"]      = encrypt_api_key(body.api_key)
            update_data["is_active"]        = False
            update_data["last_test_status"] = None
            update_data["last_test_at"]     = None
            update_data["last_error"]       = None

        if not update_data:
            raise HTTPException(status_code=400, detail="Không có trường nào để cập nhật.")

        row = db.update_ai_config(cong_trinh_id, update_data)
        return {"success": True, "data": _safe_config(row)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{cong_trinh_id}")
def delete_config(cong_trinh_id: int, authorization: Optional[str] = Header(None)):
    """
    [Admin] Xóa cấu hình API Key của công trình.

    Hành vi: XÓA api_key_enc (sensitive), đặt is_active=False.
    GIỮ LẠI: bản ghi, provider, model, last_test_at, last_test_status, last_error.

    Lý do: API Key là thông tin nhạy cảm — Admin đã chủ động "xóa cấu hình"
    thì không nên giữ key mã hóa lại. Nhưng lịch sử test vẫn có giá trị
    để audit sau này.

    Khác với /disable: /disable chỉ tạm ngưng, vẫn giữ key để bật lại nhanh.
    """
    _require_admin(authorization)
    try:
        if not db.get_ai_config_by_ct(cong_trinh_id):
            raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình.")
        db.update_ai_config(cong_trinh_id, {
            "api_key_enc": None,   # Xóa key — không thể khôi phục
            "is_active":   False,
        })
        return {
            "success": True,
            "cong_trinh_id": cong_trinh_id,
            "message": "Đã xóa API Key. Lịch sử test được giữ lại. Thêm key mới để kích hoạt lại.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{cong_trinh_id}/disable")
def disable_config(cong_trinh_id: int, authorization: Optional[str] = Header(None)):
    """
    [Admin] Tạm ngưng AI cho công trình này.

    Hành vi: is_active=False, GIỮ NGUYÊN api_key_enc.
    Dùng khi muốn tắt tạm thời — bật lại nhanh bằng /enable mà không cần nhập key lại.
    """
    _require_admin(authorization)
    try:
        cfg = db.get_ai_config_by_ct(cong_trinh_id)
        if not cfg:
            raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình.")
        if not cfg.get("is_active"):
            return {"success": True, "cong_trinh_id": cong_trinh_id,
                    "message": "AI đã ở trạng thái tắt rồi."}
        db.update_ai_config(cong_trinh_id, {"is_active": False})
        return {
            "success": True,
            "cong_trinh_id": cong_trinh_id,
            "message": "Đã tạm ngưng AI. Key vẫn được giữ — dùng /enable để bật lại.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{cong_trinh_id}/enable")
def enable_config(cong_trinh_id: int, authorization: Optional[str] = Header(None)):
    """
    [Admin] Bật lại AI cho công trình (sau khi đã /disable).

    Yêu cầu: phải còn api_key_enc trong DB.
    Khuyến nghị: chạy /test-connection sau khi enable để xác nhận key vẫn hợp lệ.
    """
    _require_admin(authorization)
    try:
        cfg = db.get_ai_config_by_ct(cong_trinh_id)
        if not cfg:
            raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình.")
        if not cfg.get("api_key_enc"):
            raise HTTPException(
                status_code=400,
                detail="Không có API Key để bật lại. Thêm key mới qua POST /{id}.",
            )
        if cfg.get("is_active"):
            return {"success": True, "cong_trinh_id": cong_trinh_id,
                    "message": "AI đã đang hoạt động rồi."}
        db.update_ai_config(cong_trinh_id, {"is_active": True})
        return {
            "success": True,
            "cong_trinh_id": cong_trinh_id,
            "message": "Đã bật lại AI. Khuyến nghị chạy /test-connection để xác nhận key còn hợp lệ.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{cong_trinh_id}/test-connection")
def test_connection(cong_trinh_id: int, authorization: Optional[str] = Header(None)):
    """
    [Admin] Kiểm tra kết nối API thật của CT này.
    - Decrypt key từ DB (không bao giờ gửi ra ngoài)
    - Gọi API nhẹ nhất của provider
    - Lưu kết quả: last_test_at / last_test_status / last_error
    - Nếu OK → tự động set is_active=True
    """
    _require_admin(authorization)

    try:
        cfg = db.get_ai_config_by_ct(cong_trinh_id)
        if not cfg:
            raise HTTPException(status_code=404, detail="Chưa có cấu hình AI cho công trình này.")
        if not cfg.get("api_key_enc"):
            raise HTTPException(status_code=400,
                                detail="Chưa có API Key. Thêm key trước khi kiểm tra kết nối.")

        # Decrypt — chỉ dùng nội bộ backend
        try:
            plain_key = decrypt_api_key(cfg["api_key_enc"])
        except RuntimeError as e:
            db.update_ai_config_test_result(cong_trinh_id, "error", str(e))
            raise HTTPException(status_code=500, detail=f"Lỗi giải mã key: {e}")

        provider = cfg.get("provider", "gemini")
        meta = get_provider(provider)
        model = cfg.get("model") or (meta.default_model if meta else "gemini-1.5-flash")

        test_prompt = "Trả lời đúng 1 từ: OK"
        status = "error"
        error_msg = ""

        # ── Gemini ────────────────────────────────────────────
        if provider == "gemini":
            url = (f"https://generativelanguage.googleapis.com/v1/models/"
                   f"{model}:generateContent?key={plain_key}")
            body_data = _json.dumps({
                "contents": [{"parts": [{"text": test_prompt}]}],
                "generationConfig": {"maxOutputTokens": 10},
            }).encode()
            req = urllib.request.Request(
                url, data=body_data,
                headers={"Content-Type": "application/json"}, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    _json.loads(r.read(