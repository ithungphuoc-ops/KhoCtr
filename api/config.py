"""
config.py — Cấu hình tập trung cho KhoUNICE Backend
Load từ file .env hoặc environment variables
"""
import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Luôn load từ đúng file .env cùng thư mục với config.py
_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)


class Settings:
    def __init__(self):
        self.SUPABASE_URL: str  = os.getenv("SUPABASE_URL", "")
        self.SUPABASE_KEY: str  = os.getenv("SUPABASE_KEY", "")
        self.CLAUDE_API_KEY: str  = os.getenv("CLAUDE_API_KEY", "")
        self.GEMINI_API_KEY: str  = os.getenv("GEMINI_API_KEY", "")
        self.GEMINI_MODEL: str    = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self.OPENAI_API_KEY: str  = os.getenv("OPENAI_API_KEY", "")
        self.OPENAI_MODEL: str    = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.ENCRYPTION_KEY: str  = os.getenv("ENCRYPTION_KEY", "")

        if not self.SUPABASE_URL:
            raise ValueError("Thiếu SUPABASE_URL trong .env")
        if not self.SUPABASE_KEY:
            raise ValueError("Thiếu SUPABASE_KEY trong .env")
        if not self.ENCRYPTION_KEY:
            raise ValueError(
                "[config] ENCRYPTION_KEY chưa được cấu hình!\n"
                "Thêm vào backend/.env (local) hoặc Render Environment Variables.\n"
                "Xem docs/11_DEPLOYMENT.md để biết cách sinh và cấu hình key."
            )

        # Log trạng thái key khi khởi động (không log giá trị thật)
        print(f"[config] .env path: {_env_path} (exists={_env_path.exists()})")
        print(f"[config] ENCRYPTION_KEY: {'SET' if self.ENCRYPTION_KEY else 'MISSING'}")
        print(f"[config] GEMINI_API_KEY: {'SET (' + self.GEMINI_API_KEY[:6] + '...)' if self.GEMINI_API_KEY else 'EMPTY'}")
        print(f"[config] GEMINI_MODEL:   {self.GEMINI_MODEL}")
        print(f"[config] CLAUDE_API_KEY: {'SET (' + self.CLAUDE_API_KEY[:6] + '...)' if self.CLAUDE_API_KEY else 'EMPTY'}")
        print(f"[config] OPENAI_API_KEY: {'SET (' + self.OPENAI_API_KEY[:6] + '...)' if self.OPENAI_API_KEY else 'EMPTY'}")
        print(f"[config] OPENAI_MODEL:   {self.OPENAI_MODEL}")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
