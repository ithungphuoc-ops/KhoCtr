# Hướng dẫn Triển khai — KhoUNICE Web

> Cập nhật lần cuối: 07/2026

---

## 1. Yêu cầu môi trường

| Thành phần | Yêu cầu |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| Supabase | PostgreSQL cloud |
| Render.com | Free tier (hoặc Starter) |

---

## 2. Biến môi trường bắt buộc

Tất cả biến dưới đây phải được cấu hình trên **Render → Environment** và trong file `backend/.env` (local). Thiếu bất kỳ biến nào backend sẽ báo lỗi và không khởi động.

| Biến | Mô tả | Bắt buộc |
|---|---|---|
| `SUPABASE_URL` | URL project Supabase | ✅ |
| `SUPABASE_KEY` | Anon key Supabase | ✅ |
| `JWT_SECRET` | Secret ký JWT token | ✅ |
| `SETUP_KEY` | Key tạo tài khoản admin lần đầu | ✅ |
| `ENCRYPTION_KEY` | **Fernet key mã hóa API Key của công trình** | ✅ |
| `CLAUDE_API_KEY` | API key Claude (fallback nếu CT chưa cấu hình) | ⚠️ |
| `GEMINI_API_KEY` | API key Gemini (fallback) | ⚠️ |
| `GEMINI_MODEL` | Model Gemini (vd: `gemini-1.5-flash`) | ✅ |
| `OPENAI_API_KEY` | API key OpenAI (tùy chọn) | ➖ |
| `OPENAI_MODEL` | Model OpenAI (vd: `gpt-4o-mini`) | ➖ |

---

## 3. ENCRYPTION_KEY — Quan trọng

### 3.1 Vai trò
`ENCRYPTION_KEY` dùng để **mã hóa API Key của từng công trình** trước khi lưu vào database. Nếu mất key này, toàn bộ API Key trong database sẽ không thể giải mã và phải nhập lại.

### 3.2 Quy tắc bắt buộc
- ✅ **CHỈ có 1 ENCRYPTION_KEY duy nhất** cho toàn hệ thống.
- ✅ Lưu trong Render Environment Variables và file `.env` local.
- ✅ **Backup ngay** vào nơi an toàn (trình quản lý mật khẩu, két thông tin công ty).
- ❌ **KHÔNG** commit vào GitHub hay bất kỳ source code nào.
- ❌ **KHÔNG** để backend tự sinh key mới — nếu tự sinh mỗi lần restart thì mất dữ liệu mã hóa.

### 3.3 Sinh key lần đầu (đã làm, không cần làm lại)
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```
Key được sinh ra là một chuỗi base64 dài ~44 ký tự. **Lưu ngay, không tái tạo.**

### 3.4 Backup key (bắt buộc)
Sao chép `ENCRYPTION_KEY` từ Render → lưu vào:
- Trình quản lý mật khẩu (Bitwarden, 1Password...)
- Hoặc tài liệu nội bộ được mã hóa của công ty

---

## 4. Cấu hình trên Render

### Bước 1: Vào Dashboard Render
1. Mở https://dashboard.render.com
2. Chọn service **Kho-Tong**
3. Vào tab **Environment**

### Bước 2: Thêm biến môi trường
Click **Add Environment Variable** và thêm từng biến:

```
SUPABASE_URL        = <lấy từ Supabase project settings>
SUPABASE_KEY        = <anon key từ Supabase>
JWT_SECRET          = [REDACTED-ROTATED]
SETUP_KEY           = HPCONS_SETUP_2026
ENCRYPTION_KEY      = <lấy từ file .env local hoặc backup>
CLAUDE_API_KEY      = <key Claude của công ty>
GEMINI_API_KEY      = <key Gemini>
GEMINI_MODEL        = gemini-1.5-flash
OPENAI_API_KEY      = (để trống nếu không dùng)
OPENAI_MODEL        = gpt-4o-mini
```

> ⚠️ **Lưu ý:** Sau khi thêm/sửa env vars, Render sẽ **tự động redeploy**. Không cần push code.

### Bước 3: Kiểm tra sau deploy
Mở log Render, chắc chắn thấy dòng:
```
[config] ENCRYPTION_KEY: SET
[config] GEMINI_API_KEY: SET (AQ.Ab8...)
```
Nếu thấy `ENCRYPTION_KEY: MISSING` → backend sẽ từ chối khởi động.

---

## 5. Cấu hình local (.env)

File `backend/.env` (không commit GitHub):
```env
SUPABASE_URL=https://...supabase.co
SUPABASE_KEY=eyJ...
CLAUDE_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=AQ.Ab8...
GEMINI_MODEL=gemini-1.5-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
JWT_SECRET=[REDACTED-ROTATED]
SETUP_KEY=HPCONS_SETUP_2026
ENCRYPTION_KEY=<cùng giá trị với Render>
```

> Chạy local: `CHAY_WEB_APP.bat` — tự load `.env` qua python-dotenv.

---

## 6. Database — Supabase

### Bảng cần có (chạy SQL trong Supabase SQL Editor)

#### project_ai_config
```sql
CREATE TABLE IF NOT EXISTS project_ai_config (
  id              SERIAL PRIMARY KEY,
  project_id      INT REFERENCES cong_trinh(id) ON DELETE CASCADE,
  provider        TEXT DEFAULT 'gemini',
  api_key_enc     TEXT,
  model           TEXT,
  max_token       INT DEFAULT 2000,
  system_prompt   TEXT,
  status          TEXT DEFAULT 'active',
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);
```

---

## 7. Triển khai lại từ đầu (Disaster Recovery)

Xem chi tiết tại `docs/12_BACKUP_RECOVERY.md`.

---

## 8. Lịch sử deploy

| Ngày | Commit | Nội dung |
|---|---|---|
| 07/07/2026 | ab23913 | Fix Dashboard CT filter |
| 07/07/2026 | 054c3dd | Fix backend v_ton_kho, thêm Ghi chú menu |
