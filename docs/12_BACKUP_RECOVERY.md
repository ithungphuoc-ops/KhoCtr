# Backup & Phục hồi — KhoCtr (KhoUNICE Web)

> Cập nhật lần cuối: 08/2026 — viết lại hoàn toàn cho stack hiện tại (Firestore + Cloudflare R2), thay cho bản cũ mô tả Supabase/Render đã ngừng dùng.

---

## 1. Hiện trạng thực tế — đọc kỹ trước khi tin có backup

⚠️ **Tại thời điểm viết tài liệu này, KHÔNG có cơ chế backup/export tự động nào được cấu hình** cho Firestore hay R2 trong dự án. Đây là điểm cần Sếp lưu ý và quyết định có nên thiết lập thêm không (xem mục 4 — gợi ý, chưa làm).

| Dữ liệu | Nơi lưu | Backup tự động? | Mức độ quan trọng |
|---|---|---|---|
| Database (phiếu, tồn kho, công trình, hàng hóa...) | Firestore project `hpcons-khoctr` | ❌ Chưa cấu hình export định kỳ | 🔴 Tối quan trọng |
| Ảnh/PDF chứng từ | Cloudflare R2 bucket | ❌ Chưa bật versioning | 🟠 Quan trọng |
| Toàn bộ source code | GitHub `ithungphuoc-ops/KhoCtr` | ✅ Có (mỗi lần push, có lịch sử commit) | 🟢 An toàn |
| Biến môi trường (`ENCRYPTION_KEY`, R2 keys, `CRON_SECRET`...) | Vercel Environment Variables | ❌ Không tự backup — chỉ tồn tại trên Vercel | 🔴 Tối quan trọng |

---

## 2. `ENCRYPTION_KEY` — vẫn quan trọng như trước

Dùng để mã hoá API Key AI của từng công trình (`lib/crypto/fernet.ts`). Nếu mất key này: toàn bộ API Key AI đã lưu không giải mã được, phải vào **Thiết lập API AI** nhập lại cho từng công trình — không có cách khôi phục tự động.

**Nên làm:** copy giá trị `ENCRYPTION_KEY` hiện tại từ Vercel → lưu vào trình quản lý mật khẩu (Bitwarden/1Password...) hoặc tài liệu nội bộ mã hoá của công ty. Tương tự với `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` và `CRON_SECRET` — mất thì phải tạo lại (R2 key tạo lại trong Cloudflare dashboard; `CRON_SECRET` tự đặt giá trị mới rồi cập nhật cả trên Vercel).

---

## 3. Quy trình phục hồi khi gặp sự cố

### 3.1 Vercel mất biến môi trường
1. Vercel → project khoctr → **Settings → Environment Variables** → thêm lại từ nơi đã backup (mục 2).
2. Redeploy lại (env var không tự trigger deploy).

### 3.2 Mất `ENCRYPTION_KEY` hoàn toàn (không có backup)
> Tình huống nghiêm trọng — không có cách tự động phục hồi.
1. Tạo key mới, set vào Vercel.
2. Vào **Thiết lập API AI** trên web, nhập lại API Key cho từng công trình.
3. Backup ngay key mới.

### 3.3 Firestore mất/hỏng dữ liệu
Firestore là dịch vụ được Google quản lý (độ bền cao), nhưng **không có nghĩa là có point-in-time backup** trừ khi tự cấu hình export. Hiện tại **chưa cấu hình** — nếu dữ liệu bị xóa nhầm ở quy mô lớn (ví dụ xóa cả 1 công trình — xem mục 4), **không có cách khôi phục** ngoài phiếu nằm trong Thùng rác (`/thung-rac`, giữ 30 ngày, chỉ áp dụng cho xóa phiếu lẻ, không áp dụng khi xóa cả công trình).

### 3.4 R2 mất file ảnh/PDF
Chưa bật versioning — file bị xóa/ghi đè thì mất luôn, không có bản cũ để khôi phục.

---

## 4. Gợi ý thiết lập thêm (chưa làm — Sếp cân nhắc)

- **Firestore scheduled export**: Google Cloud hỗ trợ export Firestore định kỳ ra Cloud Storage (cần bật qua Google Cloud Console, có phát sinh chi phí lưu trữ nhỏ). Hiện chưa bật.
- **R2 bucket versioning**: Cloudflare R2 hỗ trợ bật versioning cho bucket để giữ lại phiên bản cũ khi file bị ghi đè/xóa. Hiện chưa bật.
- Cả 2 việc trên đều thực hiện trực tiếp trên dashboard (Google Cloud / Cloudflare), không cần sửa code — nếu Sếp muốn làm, có thể nhờ hướng dẫn từng bước cụ thể khi cần.

---

## 5. Checklist trước khi deploy thay đổi lớn

- [ ] Đã backup các biến môi trường quan trọng ở nơi an toàn (mục 2)
- [ ] `npm run build` local pass trước khi push
- [ ] Sau deploy, `curl` các route chính không trả `500`
- [ ] Test tay các luồng bị ảnh hưởng trực tiếp trên trình duyệt/điện thoại thật
