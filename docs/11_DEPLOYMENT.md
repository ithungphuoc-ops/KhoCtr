# Hướng dẫn Triển khai — KhoCtr (KhoUNICE Web)

> Cập nhật lần cuối: 08/2026 — viết lại hoàn toàn cho stack hiện tại (Next.js/Vercel/Firebase/R2), thay cho bản cũ mô tả stack Python/Supabase/Render đã ngừng dùng.

---

## 1. Kiến trúc hiện tại

| Thành phần | Công nghệ |
|---|---|
| App | Next.js 15 (App Router) + TypeScript, deploy trên **Vercel** |
| Database | **Firebase Firestore** (project `hpcons-khoctr`), truy cập qua lớp giả PostgREST tự viết `lib/firestore/client.ts` |
| Lưu ảnh/PDF chứng từ | **Cloudflare R2** (bucket private), app là cầu nối duy nhất qua `app/api/files/[...path]/route.ts` — không có URL public trực tiếp |
| Đăng nhập (SSO) | `account.hpcore.vn`, verify session cookie qua Firebase project riêng `hpcons-portal` |
| AI đọc phiếu | Gemini / Claude / OpenAI — key theo từng công trình (mã hoá Fernet) hoặc key fallback chung |
| Domain | khoct.hpcore.vn |
| GitHub | `ithungphuoc-ops/KhoCtr`, nhánh `main` |

Không còn Python/FastAPI, Supabase, Render, hay JWT tự chế — đã thay hoàn toàn bằng SSO cookie + Firebase Admin SDK.

---

## 2. Biến môi trường (xem `.env.local.example` — luôn là nguồn chính xác nhất)

| Biến | Dùng cho | Bắt buộc |
|---|---|---|
| `HPCORE_FIREBASE_SERVICE_ACCOUNT` | Verify session SSO (project `hpcons-portal`) | ✅ |
| `KHOCTR_FIREBASE_SERVICE_ACCOUNT` | Firestore nghiệp vụ kho (project `hpcons-khoctr`) | ✅ |
| `ENCRYPTION_KEY` (hoặc `ENCRYPTION_KEYS` nếu cần nhiều key để rotate) | Mã hoá API Key AI theo công trình (`lib/crypto/fernet.ts`) | ✅ |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Upload/xem ảnh chứng từ (`lib/r2.ts`) — không có giá trị mặc định | ✅ |
| `R2_BUCKET`, `R2_ACCOUNT_ID` | Có giá trị mặc định hardcode trong `lib/r2.ts`, chỉ cần set nếu đổi bucket | ➖ |
| `CRON_SECRET` | Xác thực Vercel Cron gọi `app/api/cron/purge-phieu` (tự xóa vĩnh viễn phiếu trong thùng rác sau 30 ngày) | ✅ |
| `CLAUDE_API_KEY` / `GEMINI_API_KEY` / `GEMINI_MODEL` / `OPENAI_API_KEY` / `OPENAI_MODEL` | Fallback AI đọc phiếu khi công trình chưa tự cấu hình | ⚠️ ít nhất 1 provider |

Cấu hình tại: **Vercel → chọn project khoctr → Settings → Environment Variables** (áp dụng cho Production). Sau khi thêm/sửa biến, phải **redeploy lại** (đổi env var không tự trigger redeploy như trước).

---

## 3. Quy trình deploy

1. Push code lên `main` trên GitHub.
2. Vercel **không luôn tự deploy khi push** (đã gặp vài lần không tự chạy) — dùng **Deploy Hook** (Vercel → Settings → Git → Deploy Hooks) để trigger chắc chắn:
   ```
   curl -X POST <URL Deploy Hook>
   ```
3. Kiểm tra deploy xong: `curl` vài route chính, kỳ vọng `307` (redirect đăng nhập) hoặc `401`, KHÔNG phải `500`.
4. Test tay các luồng chính bị ảnh hưởng (Sếp tự làm trên trình duyệt/điện thoại thật — không có cách tự động hoá việc này).

---

## 4. Sự cố thường gặp đã từng xảy ra

- **`require() of ES Module ... jose`**: `firebase-admin` phụ thuộc `jwks-rsa` yêu cầu `jose` bản CommonJS, nhưng npm có thể kéo về `jose` v6 (pure ESM) gây lỗi runtime. Đã khoá bằng `"overrides": {"jose": "^4.15.9"}` trong `package.json` — nếu gặp lại lỗi tương tự, kiểm tra override này còn đúng không sau khi `npm install`/update dependency.
- **Vercel không tự deploy**: xem mục 3, luôn có Deploy Hook làm phương án dự phòng.

---

## 5. Khôi phục / Backup

Xem `docs/12_BACKUP_RECOVERY.md`.
