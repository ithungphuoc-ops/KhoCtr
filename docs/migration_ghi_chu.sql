-- ============================================================
-- Migration: Tạo bảng ghi_chu
-- Dự án: KhoUNICE Web — HP Cons Việt Nam
-- Ngày: 07/07/2026
-- Mô tả: Module Ghi chú công việc dùng chung cho App Tổng và App Công trình
--
-- Thiết kế:
--   - cong_trinh_id NOT NULL: mỗi ghi chú luôn thuộc 1 công trình
--   - Soft delete (deleted_at): không bao giờ hard delete
--   - Trạng thái đầy đủ: mo, dang_lam, tam_dung, hoan_thanh, huy
--   - Màu semantic: warning, success, danger, info, primary
--   - Ưu tiên: thap, binh_thuong, cao, khan
-- ============================================================

-- ── Tạo bảng ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ghi_chu (
    id             SERIAL PRIMARY KEY,

    -- Công trình (bắt buộc, NOT NULL)
    cong_trinh_id  INT NOT NULL
                   REFERENCES cong_trinh(id) ON DELETE CASCADE,

    -- Nội dung
    tieu_de        VARCHAR(200) NOT NULL,
    noi_dung       TEXT,

    -- Phân loại
    mau            VARCHAR(20)  NOT NULL DEFAULT 'warning',
                   -- warning | success | danger | info | primary

    uu_tien        VARCHAR(20)  NOT NULL DEFAULT 'binh_thuong',
                   -- thap | binh_thuong | cao | khan

    trang_thai     VARCHAR(20)  NOT NULL DEFAULT 'mo',
                   -- mo | dang_lam | tam_dung | hoan_thanh | huy

    -- Thời gian
    deadline       DATE,
    completed_at   TIMESTAMPTZ,         -- set khi trang_thai = hoan_thanh

    -- Audit
    created_by     VARCHAR(100),        -- email người tạo
    updated_by     VARCHAR(100),        -- email người sửa cuối

    -- Soft delete
    deleted_at     TIMESTAMPTZ,         -- NULL = chưa xóa; NOT NULL = đã xóa mềm

    -- Timestamps
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_mau      CHECK (mau      IN ('warning','success','danger','info','primary')),
    CONSTRAINT chk_uu_tien  CHECK (uu_tien  IN ('thap','binh_thuong','cao','khan')),
    CONSTRAINT chk_trang_thai CHECK (trang_thai IN ('mo','dang_lam','tam_dung','hoan_thanh','huy'))
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ghi_chu_cong_trinh
    ON ghi_chu(cong_trinh_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ghi_chu_trang_thai
    ON ghi_chu(trang_thai)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ghi_chu_deadline
    ON ghi_chu(deadline)
    WHERE deleted_at IS NULL AND deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ghi_chu_uu_tien
    ON ghi_chu(uu_tien)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ghi_chu_deleted_at
    ON ghi_chu(deleted_at);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_ghi_chu_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ghi_chu_updated_at
    BEFORE UPDATE ON ghi_chu
    FOR EACH ROW
    EXECUTE FUNCTION set_ghi_chu_updated_at();

-- ── Comments ──────────────────────────────────────────────────
COMMENT ON TABLE  ghi_chu                IS 'Ghi chú công việc theo từng công trình — dùng chung App Tổng và App Công trình';
COMMENT ON COLUMN ghi_chu.cong_trinh_id  IS 'Bắt buộc NOT NULL — mỗi ghi chú luôn thuộc 1 công trình';
COMMENT ON COLUMN ghi_chu.tieu_de        IS 'Tiêu đề ngắn gọn, bắt buộc';
COMMENT ON COLUMN ghi_chu.noi_dung       IS 'Nội dung chi tiết, tùy chọn';
COMMENT ON COLUMN ghi_chu.mau            IS 'Màu semantic: warning|success|danger|info|primary — frontend tự map sang màu thật';
COMMENT ON COLUMN ghi_chu.uu_tien        IS 'Mức ưu tiên: thap|binh_thuong|cao|khan';
COMMENT ON COLUMN ghi_chu.trang_thai     IS 'Trạng thái: mo|dang_lam|tam_dung|hoan_thanh|huy';
COMMENT ON COLUMN ghi_chu.deadline       IS 'Hạn hoàn thành (DATE), tùy chọn';
COMMENT ON COLUMN ghi_chu.completed_at   IS 'Thời điểm hoàn thành thực tế — dùng để thống kê đúng hạn/trễ hạn';
COMMENT ON COLUMN ghi_chu.created_by     IS 'Email người tạo';
COMMENT ON COLUMN ghi_chu.updated_by     IS 'Email người sửa cuối';
COMMENT ON COLUMN ghi_chu.deleted_at     IS 'Soft delete — NULL = chưa xóa; NOT NULL = đã xóa mềm';

-- ── Kiểm tra sau khi tạo ─────────────────────────────────────
-- Chạy lệnh này để xác nhận bảng đã được tạo đúng:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ghi_chu'
ORDER BY ordinal_position;

-- ============================================================
-- ROLLBACK (chạy nếu cần hủy migration này)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_ghi_chu_updated_at ON ghi_chu;
-- DROP FUNCTION IF EXISTS set_ghi_chu_updated_at();
-- DROP TABLE IF EXISTS ghi_chu CASCADE;
-- ============================================================
