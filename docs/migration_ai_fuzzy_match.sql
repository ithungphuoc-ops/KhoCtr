-- ============================================================
-- MIGRATION: AI Fuzzy Match — ai_name_mapping + ai_match_history
--            + thêm ngưỡng khớp vào project_ai_config
-- Dự án  : KhoUNICE Web — HP Cons
-- Ngày   : 09/07/2026
-- Chạy   : Supabase Dashboard → SQL Editor → New Query → Run
-- Thứ tự : Chạy toàn bộ file 1 lần (3 block theo thứ tự)
-- ============================================================


-- ============================================================
-- BLOCK 1: Thêm ngưỡng khớp vào project_ai_config (bảng đã có)
-- ============================================================

ALTER TABLE project_ai_config
    ADD COLUMN IF NOT EXISTS match_green_threshold  INTEGER NOT NULL DEFAULT 90,
    ADD COLUMN IF NOT EXISTS match_yellow_threshold INTEGER NOT NULL DEFAULT 70;

COMMENT ON COLUMN project_ai_config.match_green_threshold  IS
    'Ngưỡng tự động khớp (>=): mặc định 90. Dòng đạt ngưỡng này vào tab 🟢.';
COMMENT ON COLUMN project_ai_config.match_yellow_threshold IS
    'Ngưỡng cần xác nhận (>=): mặc định 70. Dòng nằm giữa green và yellow vào tab 🟡. Dưới yellow → 🔴.';

-- Kiểm tra constraint: yellow < green
ALTER TABLE project_ai_config
    DROP CONSTRAINT IF EXISTS chk_threshold_order;
ALTER TABLE project_ai_config
    ADD CONSTRAINT chk_threshold_order
    CHECK (match_yellow_threshold < match_green_threshold);


-- ============================================================
-- BLOCK 2: Bảng ai_name_mapping
-- Lưu ánh xạ tên AI nhận diện → tên chuẩn trong danh mục.
-- cong_trinh_id = NULL → ánh xạ chung (global)
-- cong_trinh_id = ID   → ánh xạ riêng công trình đó
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_name_mapping (
    id                  SERIAL       PRIMARY KEY,

    -- Phạm vi: NULL = global, ID = riêng công trình
    cong_trinh_id       INT          REFERENCES cong_trinh(id) ON DELETE CASCADE,

    -- Tên AI nhận diện được (raw = nguyên gốc, normalized = đã chuẩn hóa)
    ten_ai_raw          TEXT         NOT NULL,   -- VD: "Tole kẽm Z275 0.35mm"
    ten_ai_normalized   TEXT         NOT NULL,   -- VD: "tole kem z275 0 35mm"

    -- Tên chuẩn trong danh mục hàng hóa (do người dùng xác nhận)
    ten_chuan           TEXT         NOT NULL,   -- VD: "Tôn mạ kẽm Z275 dày 0.35mm"

    -- Thống kê để ưu tiên các mapping hay dùng
    so_lan_dung         INT          NOT NULL DEFAULT 1,

    -- Metadata
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_name_mapping IS
    'Ánh xạ tên AI nhận diện → tên chuẩn danh mục. NULL cong_trinh_id = ánh xạ chung cho mọi công trình.';
COMMENT ON COLUMN ai_name_mapping.ten_ai_raw        IS 'Tên gốc AI trả về, giữ nguyên ký tự để debug.';
COMMENT ON COLUMN ai_name_mapping.ten_ai_normalized IS 'Tên sau normalize (bỏ dấu, lowercase, chuẩn hóa đơn vị) dùng để fuzzy match.';
COMMENT ON COLUMN ai_name_mapping.ten_chuan         IS 'Tên hàng hóa đã được người dùng xác nhận là đúng.';
COMMENT ON COLUMN ai_name_mapping.so_lan_dung       IS 'Số lần ánh xạ này được dùng — mapping dùng nhiều được ưu tiên trả về trước.';

-- Index lookup chính: tìm theo CT + tên normalized
CREATE INDEX IF NOT EXISTS idx_anm_ct_normalized
    ON ai_name_mapping(cong_trinh_id, ten_ai_normalized);

-- Index riêng cho global mapping (cong_trinh_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_anm_global
    ON ai_name_mapping(ten_ai_normalized)
    WHERE cong_trinh_id IS NULL;

-- Trigger tự cập nhật updated_at
-- Hàm set_updated_at() đã tạo trong migration_project_ai_config.sql — tái sử dụng
CREATE TRIGGER trg_anm_updated_at
    BEFORE UPDATE ON ai_name_mapping
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- BLOCK 3: Bảng ai_match_history
-- Ghi lại lịch sử mỗi lần AI đọc PDF và người dùng xác nhận.
-- Mục đích: audit trail + thống kê độ chính xác theo thời gian.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_match_history (
    id                  SERIAL       PRIMARY KEY,

    -- Ngữ cảnh
    cong_trinh_id       INT          NOT NULL REFERENCES cong_trinh(id) ON DELETE CASCADE,
    loai_phieu          VARCHAR(10)  NOT NULL DEFAULT 'nhap',  -- 'nhap' | 'xuat'
    file_name           TEXT         NOT NULL,   -- Tên file PDF gốc

    -- Kết quả phân loại sau khi AI xử lý
    tong_so_dong        INT          NOT NULL DEFAULT 0,
    khop_xanh           INT          NOT NULL DEFAULT 0,   -- Tab 🟢 (>= green threshold)
    khop_vang           INT          NOT NULL DEFAULT 0,   -- Tab 🟡 (>= yellow threshold)
    hang_moi            INT          NOT NULL DEFAULT 0,   -- Tab 🔴 (< yellow threshold)

    -- Người thực hiện
    user_id             INT          REFERENCES app_users(id) ON DELETE SET NULL,
    user_email          VARCHAR(200),   -- Lưu redundant để không mất khi user bị xóa

    -- Hiệu năng & AI metadata
    processing_time_ms  INT,            -- Thời gian AI xử lý toàn bộ (milliseconds)
    ai_provider         VARCHAR(20),    -- 'gemini' | 'claude' | 'openai'
    ai_model            VARCHAR(100),   -- VD: 'gemini-1.5-flash', 'claude-3-haiku'

    -- Metadata
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_match_history IS
    'Audit trail mỗi lần AI đọc PDF: số dòng, kết quả phân loại, người dùng, provider AI.';
COMMENT ON COLUMN ai_match_history.loai_phieu       IS 'nhap = phiếu nhập kho, xuat = phiếu xuất kho.';
COMMENT ON COLUMN ai_match_history.khop_xanh        IS 'Số dòng tự động khớp (score >= match_green_threshold).';
COMMENT ON COLUMN ai_match_history.khop_vang        IS 'Số dòng cần xác nhận (score >= match_yellow_threshold và < match_green_threshold).';
COMMENT ON COLUMN ai_match_history.hang_moi         IS 'Số dòng không khớp (score < match_yellow_threshold) — cần tạo mới hoặc bỏ qua.';
COMMENT ON COLUMN ai_match_history.processing_time_ms IS 'Thời gian tính từ khi gửi PDF đến khi nhận JSON từ AI (ms).';
COMMENT ON COLUMN ai_match_history.user_email       IS 'Email lưu dư thừa: giữ lại audit trail kể cả khi user bị xóa khỏi app_users.';

-- Index lookup theo CT (xem lịch sử của 1 CT)
CREATE INDEX IF NOT EXISTS idx_amh_cong_trinh
    ON ai_match_history(cong_trinh_id, created_at DESC);

-- Index lookup theo user
CREATE INDEX IF NOT EXISTS idx_amh_user
    ON ai_match_history(user_id);


-- ============================================================
-- KIỂM TRA SAU KHI CHẠY
-- Paste từng lệnh SELECT bên dưới để xác nhận kết quả
-- ============================================================

-- 1. Kiểm tra project_ai_config có đủ 15 cột (13 cũ + 2 mới):
--
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'project_ai_config'
-- ORDER BY ordinal_position;
--
-- Kết quả mong đợi thêm 2 cột cuối:
--   match_green_threshold  | integer | 90
--   match_yellow_threshold | integer | 70

-- 2. Kiểm tra bảng ai_name_mapping (8 cột):
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'ai_name_mapping'
-- ORDER BY ordinal_position;

-- 3. Kiểm tra bảng ai_match_history (14 cột):
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'ai_match_history'
-- ORDER BY ordinal_position;

-- 4. Kiểm tra constraint thứ tự ngưỡng:
--
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'chk_threshold_order';


-- ============================================================
-- ROLLBACK — chỉ chạy nếu cần hoàn tác (KHÔNG chạy production)
-- ============================================================
-- DROP TABLE IF EXISTS ai_match_history;
-- DROP TABLE IF EXISTS ai_name_mapping;
-- ALTER TABLE project_ai_config
--     DROP COLUMN IF EXISTS match_green_threshold,
--     DROP COLUMN IF EXISTS match_yellow_threshold;
-- ============================================================
