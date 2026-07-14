"""
ai_providers.py — Registry/Factory cho các nhà cung cấp AI
Pattern: Registry để dễ mở rộng mà không phải sửa nhiều nơi

Cách thêm provider mới:
    1. Thêm 1 entry vào PROVIDER_REGISTRY bên dưới
    2. Thêm handler trong ai_reader.py (hàm _<provider>())
    3. Không cần sửa: Database, Pydantic model, API router, validation

Quy tắc bảo mật:
    - validate_api_key_format() chỉ check định dạng, KHÔNG gọi API thật
    - Không log plaintext key ở bất kỳ đâu trong module này
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class ProviderMeta:
    """Metadata đầy đủ cho một nhà cung cấp AI."""
    name: str           # key trong registry — dùng trong DB (không đổi)
    label: str          # tên hiển thị trên UI
    default_model: str  # model mặc định khi tạo config mới
    models: list        # danh sách model phổ biến (gợi ý cho UI dropdown)
    key_prefixes: list  # prefix hợp lệ của API key để validate format
    key_min_length: int # độ dài tối thiểu của key
    description: str = ""  # mô tả ngắn hiển thị trên UI


# ──────────────────────────────────────────────────────────────
# PROVIDER REGISTRY — chỉ cần thêm entry ở đây khi có provider mới
# ──────────────────────────────────────────────────────────────
PROVIDER_REGISTRY: dict[str, ProviderMeta] = {
    "gemini": ProviderMeta(
        name="gemini",
        label="Google Gemini",
        default_model="gemini-1.5-flash",
        models=[
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ],
        key_prefixes=["AIza", "AQ."],
        key_min_length=20,
        description="Google AI — miễn phí quota, đọc phiếu nhanh",
    ),
    "claude": ProviderMeta(
        name="claude",
        label="Anthropic Claude",
        default_model="claude-sonnet-4-6",
        models=[
            "claude-haiku-4-5-20251001",
            "claude-sonnet-4-6",
            "claude-opus-4-8",
        ],
        key_prefixes=["sk-ant-"],
        key_min_length=40,
        description="Anthropic — chất lượng cao, hỗ trợ tiếng Việt tốt",
    ),
    "openai": ProviderMeta(
        name="openai",
        label="OpenAI GPT",
        default_model="gpt-4o-mini",
        models=[
            "gpt-4o-mini",
            "gpt-4o",
            "gpt-4-turbo",
        ],
        key_prefixes=["sk-"],
        key_min_length=40,
        description="OpenAI GPT — đa năng, hỗ trợ nhiều ngôn ngữ",
    ),
    # ── Thêm provider mới ở đây ────────────────────────────────
    # "mistral": ProviderMeta(
    #     name="mistral",
    #     label="Mistral AI",
    #     default_model="mistral-large-latest",
    #     models=["mistral-large-latest", "mistral-small-latest"],
    #     key_prefixes=[""],   # Mistral key không có prefix cố định
    #     key_min_length=32,
    #     description="Mistral AI — mã nguồn mở, nhanh",
    # ),
}


# ──────────────────────────────────────────────────────────────
# Registry API — các module khác import và gọi các hàm này
# ──────────────────────────────────────────────────────────────

def get_provider(name: str) -> Optional[ProviderMeta]:
    """Lấy metadata của provider. Trả None nếu không tồn tại."""
    return PROVIDER_REGISTRY.get(name)


def list_providers() -> list[str]:
    """Danh sách tên provider được hỗ trợ (dùng cho Pydantic validator)."""
    return list(PROVIDER_REGISTRY.keys())


def list_providers_info() -> list[dict]:
    """
    Danh sách provider kèm metadata đầy đủ.
    Dùng cho endpoint GET /api/ai-config/providers trả về frontend.
    """
    return [
        {
            "name": p.name,
            "label": p.label,
            "default_model": p.default_model,
            "models": p.models,
            "description": p.description,
        }
        for p in PROVIDER_REGISTRY.values()
    ]


def is_valid_provider(name: str) -> bool:
    """Kiểm tra nhanh provider có được hỗ trợ không."""
    return name in PROVIDER_REGISTRY


def validate_api_key_format(provider: str, api_key: str) -> tuple[bool, str]:
    """
    Kiểm tra định dạng API Key trước khi encrypt + lưu vào DB.
    Trả về (is_valid, message).

    is_valid=True  → format OK, an toàn để encrypt và lưu
    is_valid=False → block, trả thông báo lỗi rõ ràng cho user

    LƯU Ý:
    - Chỉ kiểm tra FORMAT (prefix + độ dài) — nhanh, offline
    - Không gọi API thật ở đây (tránh chậm + lộ key qua network log)
    - Để xác minh key thật sự hoạt động → dùng endpoint /test-connection
      sau khi đã lưu config
    """
    if not provider:
        return False, "Provider không được để trống."
    if not api_key:
        return False, "API Key không được để trống."

    meta = PROVIDER_REGISTRY.get(provider)
    if not meta:
        supported = ", ".join(f'"{p}"' for p in PROVIDER_REGISTRY)
        return False, f"Provider '{provider}' không được hỗ trợ. Chọn: {supported}."

    key = api_key.strip()

    # Kiểm tra độ dài tối thiểu
    if len(key) < meta.key_min_length:
        return False, (
            f"API Key của {meta.label} quá ngắn "
            f"(tối thiểu {meta.key_min_length} ký tự, đang có {len(key)} ký tự)."
        )

    # Kiểm tra prefix — chỉ khi provider có prefix cố định
    if meta.key_prefixes and any(p for p in meta.key_prefixes):
        if not any(key.startswith(p) for p in meta.key_prefixes if p):
            prefixes_display = " hoặc ".join(
                f'"{p}..."' for p in meta.key_prefixes if p
            )
            return False, (
                f"API Key của {meta.label} phải bắt đầu bằng {prefixes_display}."
            )

    return True, "OK"
