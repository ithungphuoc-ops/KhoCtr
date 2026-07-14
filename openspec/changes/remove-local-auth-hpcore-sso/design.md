## Context

KhoUNICE Web hiện tại tự quản lý đăng nhập hoàn toàn độc lập:
- `api/routers/auth.py` (301 dòng): JWT tự chế HMAC-SHA256, password PBKDF2, bảng `app_users` (email, password_hash, role admin/user), bảng `user_congtrinh` (user_id ↔ cong_trinh_id) để giới hạn công trình xem được.
- Frontend `AuthContext.jsx`: lưu token trong localStorage/sessionStorage, gắn `Authorization: Bearer` vào mọi request qua axios interceptor.
- `CongTrinhContext.jsx`: đọc `is_admin` từ `/api/auth/my-congtrinh`, dùng để quyết định `effectiveCTId` (admin: `selectedCT?.id`, xem tất cả; user: `congTrinhs[0]?.id`, chỉ CT được gán).
- 66 chỗ trong 16 file frontend dùng `isAdmin`/`isAdminUser` — ẩn/hiện menu, cột, nút. **Change này KHÔNG đụng vào các chỗ đó** — chỉ đổi nguồn giá trị `isAdmin` trả về từ API, hành vi UI giữ nguyên 100%.

**Đã đọc code thật `hpcons-portal` (2026-07-14) để xác nhận cơ chế hpcore:**
- Tên cookie: `session` (hằng số `SESSION_COOKIE_NAME` trong `lib/session-constants.ts`), `Domain=.hpcore.vn` (production), `HttpOnly`, `SameSite=Lax`, hạn 14 ngày.
- Đăng nhập: xảy ra hoàn toàn phía hpcore (`account.hpcore.vn`) — client lấy Firebase idToken, POST `/api/auth/session`, hpcore verify + kiểm tra "closed directory" (`users/{uid}` phải tồn tại — HR/IT phải cấp tài khoản trước) → tạo session cookie bằng `adminAuth.createSessionCookie()`. **KhoUNICE không tự làm bước này** — chỉ redirect người chưa đăng nhập sang `account.hpcore.vn/login?next=...`.
- Đăng xuất: set lại cookie `session` rỗng, `Max-Age=0`, cùng `Domain=.hpcore.vn` — vì cookie dùng chung domain cha, **KhoUNICE tự xóa được, không cần gọi API hpcore**.
- **Phát quyền cho app con (GĐ2) — đã có thật, đang chạy**: collection Firestore `app_permissions` (id = uid hpcore, field = appId → role string). Trang quản trị `GET/PATCH /api/apps/{appId}/permissions` (chỉ admin hpcore). App con tự công bố `GET /api/roles` (JSON `{roles: [{key, label}]}`) — hpcore gọi endpoint này để biết vai trò nào hợp lệ, không hard-code. PKD (`id: 'pkd'`) và ITAsset (`id: 'itasset'`) đã dùng cơ chế này. `dashboardApps.ts` đã có sẵn entry **"HPC Warehouse"** (`launchDate: '2026-07-15'`) chưa gắn `id`/`href`/`rolesEndpoint` — dự kiến dành cho KhoUNICE.

**Điểm mới của change này so với ITAsset/PKD**: KhoUNICE là Python FastAPI — cần dùng thư viện `firebase-admin` cho Python (`verify_session_cookie()`), lần đầu làm trong workspace (2 app trước là Next.js/Node).

## Goals / Non-Goals

**Goals:**
- Đăng nhập KhoUNICE hoàn toàn qua hpcore SSO — không còn form email/mật khẩu riêng.
- Vai trò admin/user lấy từ `app_permissions` của hpcore (đúng cơ chế GĐ2 thật), không tự quản lý role nội bộ nữa.
- Giữ nguyên `/phan-quyen` (gán công trình theo người dùng) — dữ liệu đặc thù KhoUNICE, hpcore không quản được.
- Giữ nguyên 100% hành vi UI ở 66 chỗ `isAdmin`/`isAdminUser` hiện có — không sửa từng chỗ.

**Non-Goals:**
- Không tự dựng lại cơ chế phát quyền — dùng đúng cái hpcore đã có.
- Không xóa bảng `app_users`/`user_congtrinh` trong Supabase ngay.
- Không sửa file `dashboardApps.ts` bên repo `hpcons-portal` trong change này (khác repo, cần xác nhận riêng khi tới lúc).

## Decisions

- **Xác thực**: FastAPI đọc cookie `session` từ request, verify bằng `firebase_admin.auth.verify_session_cookie(cookie, check_revoked=True)` (Firebase app khởi tạo từ `HPCORE_FIREBASE_SERVICE_ACCOUNT`). Lấy `uid` + `email` từ token đã verify.
- **Nguồn vai trò admin/user**: sau khi có `uid`, đọc Firestore hpcore `app_permissions/{uid}` (field theo app id sẽ thống nhất, tạm gọi `warehouse` — cần chốt lại khi Sếp gắn entry trong `dashboardApps.ts`). Không có bản ghi → coi như chưa được cấp quyền, chặn truy cập (trả 403), **không mặc định cho vào**.
- **`GET /api/roles`** (endpoint mới, công khai, không cần đăng nhập — hpcore gọi để lấy danh sách): trả `{"roles": [{"key": "admin", "label": "Admin"}, {"key": "user", "label": "Thủ kho"}]}`.
- **Danh sách người dùng cho `/phan-quyen`**: thay vì tạo tài khoản thủ công qua `NguoiDung.jsx` (xóa trang này), **tự động ghi/cập nhật `app_users`** (email, tên lấy từ token hpcore, role lấy từ `app_permissions`) mỗi lần người dùng đăng nhập thành công (upsert theo email). `/phan-quyen` tiếp tục hoạt động y hệt hiện tại, danh sách người dùng tự xuất hiện sau lần đăng nhập đầu tiên thay vì phải tạo tay.
- **`CongTrinhContext.jsx` / `effectiveCTId`**: KHÔNG đổi — vẫn đúng logic cũ (admin: `selectedCT?.id`; user: `congTrinhs[0]?.id` theo `user_congtrinh`), vì `isAdmin` vẫn tồn tại, chỉ đổi nguồn.
- **Chưa đăng nhập / chưa được cấp quyền**: FastAPI trả 401 (chưa có cookie hợp lệ) hoặc 403 (có cookie nhưng không có `app_permissions` cho app này); frontend bắt 401 → redirect `account.hpcore.vn/login?next=<url hiện tại>`; bắt 403 → hiện thông báo "chưa được cấp quyền truy cập, liên hệ quản trị viên".
- **Đăng xuất**: FastAPI set cookie `session` rỗng (`Max-Age=0`, `Domain=.hpcore.vn`) rồi redirect `account.hpcore.vn` — không cần gọi API hpcore.
- **Domain**: SSO chỉ hoạt động khi KhoUNICE chạy dưới `*.hpcore.vn` — cần trỏ `khoct.hpcore.vn` trước khi bật SSO thật.
- **`app_users`/`user_congtrinh`**: giữ nguyên trong Supabase — `app_users` giờ dùng để lưu email/tên/role đồng bộ từ hpcore (thay vì tự tạo có mật khẩu), `user_congtrinh` giữ nguyên vai trò gán công trình.

## Risks / Trade-offs

- [Risk] SSO Python là lần đầu làm trong workspace. → Mitigation: spike nhỏ verify cookie thật bằng Python trước khi viết lại toàn bộ `auth.py`.
- [Risk] Cookie SSO chỉ hoạt động đúng domain `*.hpcore.vn` — chưa trỏ domain thì không test được đầu-cuối thật. → Mitigation: có thể viết code trước, test bằng cookie giả lập cục bộ; xác nhận cuối cùng khi domain sẵn sàng.
- [Risk] Id app dùng trong `app_permissions`/`rolesEndpoint` (`warehouse`? `kho_unice`?) chưa thống nhất với bên `dashboardApps.ts` — nếu chọn sai tên, admin hpcore gán quyền không khớp app. → Mitigation: chốt tên chính thức TRƯỚC khi code endpoint `/api/roles`, ghi rõ trong tasks.md.
- [Risk] "Closed directory" của hpcore (`users/{uid}` phải tồn tại mới đăng nhập được) nghĩa là người dùng KhoUNICE phải ĐÃ có tài khoản hpcore trước — không tự đăng ký được. → Không phải rủi ro mới, đây là hành vi hpcore đã áp dụng cho mọi app, đúng ý muốn "danh sách đóng".

## Migration Plan

1. **Spike**: verify cookie session hpcore thật bằng Python (`firebase-admin`) — cần `HPCORE_FIREBASE_SERVICE_ACCOUNT` + 1 cookie thật để test.
2. Chốt tên app id (`warehouse` hay tên khác) dùng cho `app_permissions` + `rolesEndpoint` — thống nhất với Sếp trước khi code.
3. Viết `GET /api/roles`, middleware verify cookie + đọc `app_permissions`, upsert `app_users` khi đăng nhập.
4. Frontend: `AuthContext.jsx` bỏ lưu token cục bộ, dựa vào cookie; xử lý 401/403; xóa `Login.jsx`, xóa route `/login`.
5. Xóa `NguoiDung.jsx` (tạo tài khoản/mật khẩu) + route + mục menu. **`PhanQuyen.jsx` giữ nguyên, không sửa.**
6. Xóa endpoint cũ: `/api/auth/login`, `/api/auth/create-user`, `/api/auth/users/{id}/reset-password`, `/api/auth/users` (GET/DELETE nếu chỉ phục vụ NguoiDung.jsx).
7. Test toàn bộ luồng: đăng nhập, phân quyền công trình, nghiệp vụ chính.
8. Khi domain sẵn sàng: Sếp (hoặc em, nếu được giao) cập nhật `dashboardApps.ts` bên `hpcons-portal` gắn `id`/`href`/`rolesEndpoint` cho "HPC Warehouse" — việc này ngoài phạm vi change hiện tại.

## Open Questions

- Tên app id chính thức cho KhoUNICE trong `app_permissions`/`rolesEndpoint` — Sếp chốt hay để em đề xuất `warehouse`?
- `HPCORE_FIREBASE_SERVICE_ACCOUNT` — Sếp lấy lại từ đâu (Vercel env PKD/ITAsset, hay Firebase Console project `hpcons-portal`)?
- Người dùng đầu tiên (Sếp — nguyenhuuphuoc@hpcons.com.vn) cần được admin hpcore gán role "admin" trong `app_permissions` TRƯỚC khi cắt chuyển, nếu không sẽ không ai vào quản trị được KhoUNICE sau khi đổi.
