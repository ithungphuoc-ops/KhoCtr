-- ============================================================
-- MIGRATION: Tạo bảng project_ai_config
-- Dự án  : KhoUNICE Web — HP Cons
-- Ngày   : 07/07/2026 (cập nhật: 07/07/2026)
-- Chạy   : Supabase Dashboard → SQL Editor → New Query → Run
-- Mô tả  : Lưu cấu hình AI (provider, encrypted key, model...)
--           theo từng công trình. Mỗi CT có đúng 1 config.
--           Bao gồm cột lưu kết quả kiểm tra kết nối gần nhất
--           phục vụ chức năng Test Connection (Nhóm 3).
-- ============================================================

-- ── 1. Tạo bảng ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_ai_config (
    id                SERIAL PRIMARY KEY,
    cong_trinh_id     INT          NOT NULL REFERENCES cong_trinh(id) ON DELETE CASCADE,

    -- Cấu hình AI
    provider          VARCHAR(20)  NOT NULL DEFAULT 'gemini',  -- 'gemini' | 'claude' | 'openai'
    api_key_enc       TEXT,                                     -- Fernet-encrypted; NULL = chưa cấu hình
    model             VARCHAR(100),                             -- NULL = dùng default của provider
    max_tokens        INT          DEFAULT 4096,
    system_prompt     TEXT,
    is_active         BOOLEAN      NOT NULL DEFAULT FALSE,      -- TRUE khi key hợp lệ và đã test OK

    -- Kết quả kiểm tra kết nối gần nhất (dùng cho chức năng Test Connection)
    last_test_at      TIMESTAMPTZ,                              -- Thời điểm test gần nhất
    last_test_status  VARCHAR(20),                              -- 'ok' | 'error' | 'quota_exceeded'
    last_error        TEXT,                                     -- Mô tả lỗi nếu last_test_status != 'ok'

    -- Metadata
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW(),

    UNIQUE(cong_trinh_id)                                       -- Mỗi CT chỉ có 1 config
);

-- Comment mô tả bảng
COMMENT ON TABLE project_ai_config IS
    'Cấu hình AI theo từng công trình: provider, encrypted API key, model, trạng thái kết nối.';

COMMENT ON COLUMN project_ai_config.api_key_enc     IS 'Fernet-encrypted API key — chỉ backend đọc, không bao giờ trả về frontend.';
COMMENT ON COLUMN project_ai_config.is_active       IS 'TRUE khi key đã được cấu hình và test kết nối thành công.';
COMMENT ON COLUMN project_ai_config.last_test_at    