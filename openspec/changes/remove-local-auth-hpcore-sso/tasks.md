## 0. Chốt trước khi code

- [ ] 0.1 Chốt tên app id chính thức cho KhoUNICE (`warehouse`?) — dùng thống nhất cho `app_permissions` field + `rolesEndpoint`
- [ ] 0.2 Sếp cung cấp `HPCORE_FIREBASE_SERVICE_ACCOUNT`
- [ ] 0.3 Sếp (hoặc admin hpcore) gán role "admin" cho `nguyenhuuphuoc@hpcons.com.vn` trong `app_permissions` — để có người quản trị được ngay sau khi cắt chuyển
- [x] 0.4 Spike: `firebase-admin` (Python) khởi tạo + đọc Firestore hpcore. **KẾT QUẢ (2026-07-14)**: deploy `api/hpcore_auth.py` + endpoint `GET /api/health/hpcore` lên Vercel, gọi thật: `{"hpcore":"ok","firebase_project":"hpcons-portal"}` — kết nối đúng project, đọc được collection `app_permissions`. Chưa test được `verify_session_cookie()` với cookie thật (cần domain `*.hpcore.vn` sống + đăng nhập thật) — sẽ test ở bước 6.

## 1. Backend — endpoint mới

- [x] 1.1 Thêm dependency `firebase-admin==6.5.0` vào `api/pyproject.toml` + `api/requirements.txt` — build lên Vercel OK (bundle 256.86MB, Vercel tự tối ưu, cần theo dõi nếu thêm dependency sau này)
- [x] 1.2 Viết `api/hpcore_auth.py`: khởi tạo Firebase app từ `HPCORE_FIREBASE_SERVICE_ACCOUNT`, `verify_session(cookie) -> {uid, email} | None`, `get_app_role(uid) -> "admin"|"user"|None` — đã deploy + test kết nối OK
- [x] 1.3 Thêm `GET /api/roles` — đã deploy, test thật: `{"roles":[{"key":"admin","label":"Admin"},{"key":"user","label":"Thủ kho"}]}`
- [ ] 1.4 Viết dependency FastAPI mới thay `verify_token()`: verify cookie → lấy uid/email → lấy role từ `app_permissions` → upsert `app_users` (email, ten, role) → trả về context user cho router dùng (giữ đúng shape `{uid, email, ten, role}` như JWT cũ để router khác không phải sửa)
- [ ] 1.5 Không có `app_permissions` cho uid này → trả 403 kèm thông báo "Chưa được cấp quyền truy cập KhoUNICE, liên hệ quản trị viên"

## 2. Backend — xóa auth cũ

- [x] 2.1 Xóa `POST /api/auth/login` (JWT nội bộ)
- [x] 2.2 Xóa `POST /api/auth/create-user`, `PUT /api/auth/users/{id}/reset-password`
- [x] 2.3 Sửa `POST /api/auth/logout`: set cookie `session` rỗng (`Max-Age=0`, `Domain=.hpcore.vn`)
- [x] 2.4 **GIỮ NGUYÊN** `GET/POST /api/auth/permissions`, `GET /api/auth/my-congtrinh`, `GET /api/auth/users` — đã đổi cách xác thực, giữ nguyên logic bên trong
- [x] 2.5 Sửa `GET /api/auth/me`: trả `{uid, email, ten, role}` từ session hpcore + `app_permissions`
- [x] 2.6 Sửa 3 router phụ thuộc `verify_token` cũ (`ai_config.py`, `ai_routes.py`, `ghi_chu.py`) sang `get_current_user(request)` — **KẾT QUẢ (2026-07-14)**: deploy thật, test `/api/auth/me`, `/api/auth/my-congtrinh`, `/api/ai-config/1` đều trả đúng 401 khi chưa đăng nhập; `/api/roles`, `/api/cong-trinh/` vẫn 200 — không có lỗi 500 nào (code sạch)

## 3. Frontend — đổi cơ chế xác thực

- [x] 3.1 Sửa `AuthContext.jsx`: bỏ lưu token localStorage/sessionStorage, bỏ Bearer header, dùng `withCredentials: true` (cookie tự gửi kèm)
- [x] 3.2 `PrivateRoute` (App.jsx): 401 → redirect `account.hpcore.vn/login?next=<url hiện tại>`; 403 → hiện thông báo chưa được cấp quyền (không redirect vòng lặp) — **test thật (2026-07-14)**: vào `khoct.hpcore.vn` chưa đăng nhập → tự động chuyển đúng `account.hpcore.vn/login?next=...`, xác nhận qua screenshot thật (trang đăng nhập HP CONS Portal)
- [x] 3.3 Xóa `pages/Login.jsx`, bỏ route `/login` trong `App.jsx`
- [x] 3.4 Nút đăng xuất: gọi `POST /api/auth/logout` rồi redirect `account.hpcore.vn` (sửa luôn `Header.jsx` — bỏ `navigate('/login')` cũ đã hỏng)

## 4. Frontend — xóa NguoiDung.jsx (GIỮ NGUYÊN PhanQuyen.jsx)

- [x] 4.1 Xóa `pages/NguoiDung.jsx`, route `/nguoi-dung`, mục menu + icon `Users` trong `Sidebar.jsx`
- [x] 4.2 Xác nhận `PhanQuyen.jsx` không gọi API tạo user/reset password — không cần sửa
- [x] 4.3 KHÔNG đụng vào 66 chỗ `isAdmin`/`isAdminUser` còn lại — build sạch (1660 module), không lỗi

## 5. Dọn dẹp

- [ ] 5.1 Xóa biến môi trường `JWT_SECRET`, `SETUP_KEY` khỏi `.env`/Vercel — SAU KHI xác nhận không còn tham chiếu
- [ ] 5.2 Thêm `HPCORE_FIREBASE_SERVICE_ACCOUNT` vào Vercel env
- [ ] 5.3 (Ngoài phạm vi, repo khác) Nhờ Sếp hoặc làm riêng: cập nhật `dashboardApps.ts` bên `hpcons-portal` gắn `id`/`href`/`rolesEndpoint` cho "HPC Warehouse"

## 6. Verification

- [ ] 6.1 Đăng nhập qua hpcore SSO — vào được KhoUNICE đúng theo role đã gán trong `app_permissions`
- [ ] 6.2 Tài khoản chưa được gán quyền → bị chặn (403), không vào được
- [ ] 6.3 Chưa đăng nhập → redirect đúng về hpcore login, quay lại đúng URL sau khi đăng nhập
- [ ] 6.4 `/phan-quyen` vẫn gán công trình đúng cho user, `effectiveCTId` hoạt động như cũ (user chỉ thấy CT được gán, admin thấy tất cả)
- [ ] 6.5 Luồng nghiệp vụ chính không đổi: nhập/xuất/tồn kho, AI đọc phiếu, báo cáo, cascade delete công trình
- [ ] 6.6 Đăng xuất hoạt động đúng, quay lại vẫn phải đăng nhập lại
- [ ] 6.7 `GET /api/roles` trả đúng JSON, hpcore gọi được (test bằng curl trực tiếp trước)
