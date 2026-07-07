# Backup & Phục hồi — KhoUNICE Web

> Cập nhật lần cuối: 07/2026

---

## 1. Những gì cần backup

| Dữ liệu | Nơi lưu | Tần suất backup | Mức độ quan trọng |
|---|---|---|---|
| Database (phiếu, tồn kho...) | Supabase cloud | Tự động (Supabase) | 🔴 Tối quan trọng |
| `ENCRYPTION_KEY` | Render env + `.env` | **Backup ngay khi tạo** | 🔴 Tối quan trọng |
| `JWT_SECRET` | Render env + `.env` | Khi thay đổi | 🟠 Quan trọng |
| Toàn bộ source code | GitHub | Mỗi lần push | 🟡 Bình thường |
| File `.env` local | Máy Sếp | Khi thay đổi | 🟠 Quan trọng |

---

## 2. ENCRYPTION_KEY — Quy trình backup bắt buộc

### Tại sao quan trọng?
`ENCRYPTION_KEY` dùng để mã hóa API Key của từng công trình. Nếu mất key này:
- ❌ Toàn bộ API Key trong database không giải mã được
- ❌ Phải vào từng công trình nhập lại API Key từ đầu
- ❌ Không có cách khôi phục tự động

### Quy trình backup (làm ngay sau khi cấu hình)

**Bước 1:** Sao chép `ENCRYPTION_KEY` từ file `.env` local hoặc Render dashboard.

**Bước 2:** Lưu vào **ít nhất 2 trong 3** nơi sau:
- Trình quản lý mật khẩu (Bitwarden, 1Password, KeePass...)
- Tài liệu nội bộ mã hóa của công ty HP Cons
- USB/ổ cứng offline được khóa

**Bước 3:** Ghi chú kèm theo:
```
Tên:     ENCRYPTION_KEY KhoUNICE Web
Giá trị: <dán key vào đây>
Ngày:    07/07/2026
Dùng cho: Giải mã API Key các công trình trong Supabase DB
Cảnh báo: KHÔNG xóa - KHÔNG chia sẻ - KHÔNG commit GitHub
```

---

## 3. Quy trình phục hồi khi gặp sự cố

### 3.1 Render bị reset env vars (mất biến môi trường)

1. Vào Render → service Kho-Tong → tab **Environment**
2. Thêm lại các biến từ backup (đặc biệt `ENCRYPTION_KEY`)
3. Render tự redeploy — xong

**Kiểm tra:** Log phải thấy `[config] ENCRYPTION_KEY: SET`

---

### 3.2 Mất file `.env` local

1. Tạo lại file `backend/.env`
2. Lấy giá trị từ Render Environment hoặc backup
3. Đảm bảo `ENCRYPTION_KEY` đúng với giá trị đã lưu trong DB

---

### 3.3 Mất `ENCRYPTION_KEY` hoàn toàn (không backup)

> ⚠️ **Tình huống nghiêm trọng nhất.** Không có cách tự động phục hồi.

**Xử lý:**
1. Sinh `ENCRYPTION_KEY` mới:
   ```python
   from cryptography.fernet import Fernet
   print(Fernet.generate_key().decode())
   ```
2. Cập nhật Render và `.env` local với key mới
3. Vào **Hệ thống → Thiết lập API** trên web app
4. Nhập lại API Key cho **từng công trình** (hệ thống tự mã hóa bằng key mới)
5. Backup key mới ngay lập tức

---

### 3.4 Rotate ENCRYPTION_KEY (đổi key định kỳ)

> Dùng khi nghi ngờ key bị lộ hoặc định kỳ bảo mật (6-12 tháng).

**Bước 1:** Sinh key mới:
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

**Bước 2:** Cập nhật `.env` và Render với key mới.

**Bước 3:** Gọi endpoint re-encrypt (sẽ có trong phiên bản sau):
```
POST /api/ai-config/rotate-key
Header: Authorization: Bearer <admin_token>
Body: { "old_key": "...", "new_key": "..." }
```

> ⚠️ Chưa implement trong phiên bản hiện tại. Tạm thời: nhập lại API Key từng CT nếu cần rotate.

---

### 3.5 Supabase mất dữ liệu

Supabase tự backup hàng ngày (kể cả free tier). Để restore:
1. Vào Supabase Dashboard → **Database → Backups**
2. Chọn điểm restore
3. Xác nhận — Supabase tự phục hồi

---

## 4. Checklist trước khi deploy lên production

- [ ] `ENCRYPTION_KEY` đã được backup ở ít nhất 2 nơi
- [ ] Tất cả env vars đã có trên Render
- [ ] Bảng `project_ai_config` đã tạo trong Supabase
- [ ] Log Render không có `MISSING` hay `ERROR` khi khởi động
- [ ] Test đăng nhập Admin thành công
- [ ] Test đọc phiếu AI ít nhất 1 công trình

---

## 5. Liên hệ hỗ trợ kỹ thuật

Dự án do AI Assistant hỗ trợ phát triển. Để tiếp tục:
- Mở lại hội thoại với context `PROJECT_CONTEXT.md`
- Hoặc đọc `HUONG_DAN.md` trong thư mục gốc dự án
