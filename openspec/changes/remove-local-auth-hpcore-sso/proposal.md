## Why

Sếp quyết định (2026-07-14) KhoUNICE Web sẽ trở thành 1 app con của **hpcore.vn** (app tổng), giống HPC PKD và HPC ITAsset — đăng nhập dùng chung (SSO) qua hpcore, không tự quản lý tài khoản/mật khẩu riêng nữa.

**Cập nhật quan trọng cùng ngày**: ban đầu định xóa sạch toàn bộ phân quyền nội bộ (chấp nhận rủi ro mọi nhân viên công ty đều xem được hết dữ liệu kho), vì tưởng hpcore chưa có cơ chế phát quyền cho app con (GĐ2). Sau khi đọc code thật `hpcons-portal`, phát hiện **GĐ2 đã có sẵn và đang chạy thật** cho PKD/ITAsset: collection `app_permissions` (Firestore hpcore, key = uid, field = appId → role), trang quản trị `GET/PATCH /api/apps/{appId}/permissions`, cơ chế app con tự công bố `GET /api/roles` để hpcore biết vai trò nào hợp lệ. hpcore cũng đã có sẵn 1 ô chờ **"HPC Warehouse"** trong `dashboardApps.ts` với `launchDate: '2026-07-15'` — rõ ràng dành cho KhoUNICE.

→ **Đổi hướng**: dùng đúng cơ chế phát quyền thật này thay vì xóa sạch. Không còn rủi ro mất kiểm soát truy cập.

## What Changes

- **Xóa đăng nhập nội bộ**: bỏ `Login.jsx` (form email/mật khẩu), bỏ toàn bộ JWT tự chế (HMAC-SHA256, PBKDF2) trong `api/routers/auth.py` và `AuthContext.jsx`. Thay bằng xác thực qua session cookie hpcore (`domain: .hpcore.vn`, tên cookie `session`), verify bằng `firebase-admin` (Python) — lần đầu làm SSO Python trong hệ sinh thái hpcore (PKD/ITAsset đều Next.js).
- **Vai trò admin/user: đổi NGUỒN, không xóa khái niệm**:
  - KhoUNICE công bố `GET /api/roles` → trả `[{key: "admin", label: "Admin"}, {key: "user", label: "Thủ kho"}]`.
  - Backend đọc `app_permissions/{uid}.warehouse` (hoặc id chính thức sẽ thống nhất) từ Firestore hpcore để biết vai trò của người dùng hiện tại — thay vì đọc `app_users.role` nội bộ.
  - Toàn bộ logic hiện có dựa trên `isAdmin`/`isAdminUser` ở 66 chỗ (16 file frontend) **giữ nguyên hành vi**, chỉ đổi nơi giá trị này đến từ (API `/api/auth/me` trả role lấy từ hpcore thay vì JWT nội bộ) — không cần sửa từng chỗ trong UI.
- **`/phan-quyen` (gán công trình theo người dùng): GIỮ NGUYÊN** — đây là dữ liệu đặc thù của KhoUNICE (công trình nào NV thủ kho được xem) mà hpcore không quản lý được, không nằm trong phạm vi role chung admin/user của hpcore.
- **`/nguoi-dung`: đơn giản hóa** — bỏ tạo tài khoản + đặt/reset mật khẩu (không còn ý nghĩa vì không còn mật khẩu nội bộ). Danh sách người dùng để gán công trình ở `/phan-quyen` giờ lấy từ đâu cần quyết định (xem `design.md`).
- **Sếp cần thêm việc bên `hpcons-portal`** (repo khác, ngoài phạm vi KhoUNICE): gắn `id`, `href: https://khoct.hpcore.vn`, `rolesEndpoint: https://khoct.hpcore.vn/api/roles` vào entry "HPC Warehouse" trong `dashboardApps.ts` — việc này cần domain `khoct.hpcore.vn` trỏ xong trước, và là thay đổi trên 1 app khác nên cần xác nhận riêng khi tới lúc.
- **KHÔNG đổi**: logic nghiệp vụ kho, cấu trúc bảng Supabase hiện có.

## Capabilities

### New Capabilities
- `hpcore-sso`: Yêu cầu xác thực người dùng qua session cookie hpcore, và lấy vai trò admin/user từ `app_permissions` của hpcore thay vì quản lý nội bộ.

### Modified Capabilities
(không có — KhoUNICE_Web chưa có spec nào trong `openspec/specs/`)

## Impact

- Backend: `api/routers/auth.py` (301 dòng) — thay phần xác thực + nguồn vai trò, GIỮ phần liên quan `user_congtrinh`.
- Frontend: `AuthContext.jsx`, `Login.jsx` (xóa), `NguoiDung.jsx` (đơn giản hóa) — các trang còn lại (66 chỗ `isAdmin`) không cần sửa vì API vẫn trả đúng hình dạng dữ liệu như cũ.
- Cần Sếp cung cấp `HPCORE_FIREBASE_SERVICE_ACCOUNT`.
- Cần thêm dependency Python: `firebase-admin`.
- Domain: SSO chỉ hoạt động khi KhoUNICE chạy dưới `*.hpcore.vn` — cần trỏ `khoct.hpcore.vn` trước khi bật SSO thật (dù đang tạm hoãn phần trỏ domain, việc này cần làm gần nhau).
- Việc gắn "HPC Warehouse" vào `dashboardApps.ts` nằm ở repo `hpcons-portal`, ngoài phạm vi thay đổi này — cần xác nhận riêng.
