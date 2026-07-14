## Why

Sếp quyết định (2026-07-14) chuyển hạ tầng KhoUNICE Web sang chuẩn công ty: repo GitHub công ty (đã xong — đã push sang `github.com/ithungphuoc-ops/KhoCtr`), domain thật `khoct.hpcore.vn` chạy qua Vercel (giống mô hình `account.hpcore.vn` của hpcons-portal), và Firebase Firestore làm database thay Supabase. Đây là hệ thống production thật đang có dữ liệu vận hành kho công trình (thủ kho dùng hàng ngày) — mục tiêu là giữ nguyên 100% hành vi nghiệp vụ cho người dùng, chỉ đổi hạ tầng lưu trữ và nơi chạy.

**Cập nhật (2026-07-14, cùng ngày)**: 2 việc đã hoàn tất từ trước khi tiếp tục change này, làm phạm vi còn lại hẹp hơn dự tính ban đầu:
1. **Bước 1 (hosting) đã xong** — frontend+backend đã gộp 1 Vercel project (`khounice-web`, team `hpcons-ita-sset`), domain `khoct.hpcore.vn` đã trỏ vào, backend vẫn gọi Supabase y hệt cũ, đang chạy production ổn định.
2. **Auth đã đổi hoàn toàn** — không còn dùng JWT tự chế/`password_hash` nữa (change riêng `remove-local-auth-hpcore-sso` đã xong): đăng nhập giờ qua SSO `account.hpcore.vn`, vai trò đọc từ `app_permissions` của hpcore. Nghĩa là phần "migrate Auth" nêu ở dưới **không còn cần làm** — `app_users`/`user_congtrinh` giờ chỉ còn là bảng cache vai trò + phân quyền công trình nội bộ, không chứa thông tin đăng nhập thật nào cần bảo toàn.
3. Firebase project đích đã được tạo sẵn: **`hpcons-khoctr`** (Spark plan, Firestore chưa bật, chưa add app nào).

Phạm vi change này từ đây trở đi coi như chỉ còn đúng **Bước 2**: đổi Supabase Postgres → Firestore.

## What Changes

- ~~Gộp frontend + backend vào CHUNG 1 Vercel project~~ — **ĐÃ XONG**, xem cập nhật ở trên.
- ~~Bỏ đoạn code FastAPI tự serve frontend qua StaticFiles/catch-all~~ — **ĐÃ XONG** (repo đã đổi `backend/` → `api/`, chạy như Vercel Function).
- 9 bảng Postgres (`cong_trinh`, `phieu`, `chi_tiet_phieu`, `hang_hoa`, `app_users`, `user_congtrinh`, `activity_log`, `project_ai_config`, `ghi_chu`) → collection Firestore tương ứng, giữ nguyên tên field (snake_case) để tối thiểu hóa thay đổi ở router/frontend.
- View tính toán `v_ton_kho` (tổng nhập trừ tổng xuất) → **không cần thiết kế view mới**: `supabase_client.py` đã có sẵn hàm `compute_ton_kho()` tính tồn kho ở tầng Python (đọc `phieu`+`chi_tiet_phieu`, group trong bộ nhớ) — port gần như nguyên vẹn, chỉ đổi nguồn đọc sang Firestore.
- Cascade delete công trình (`chi_tiet_phieu` → `phieu` → `hang_hoa` → `cong_trinh`, `api/routers/cong_trinh.py`) → viết lại bằng Firestore batch delete, giữ đúng thứ tự.
- ~~Auth JWT tự chế → giữ nguyên 100%~~ — **KHÔNG CÒN ÁP DỤNG**: auth đã chuyển sang SSO hpcore từ trước (xem cập nhật ở trên). `app_users`/`user_congtrinh` → Firestore chỉ cần migrate field vai trò (`role`, `active`) + phân quyền công trình, KHÔNG có `password_hash` thật nào cần giữ (giá trị hiện tại chỉ là placeholder cố định).
- Mã hóa API key AI theo công trình (`crypto_utils.py`, bảng `project_ai_config`) → giữ nguyên thuật toán, chỉ đổi nơi lưu ciphertext.
- Khả năng chạy `pymupdf`/`fitz` trên Vercel Python serverless — **ĐÃ SPIKE XONG, KẾT QUẢ TỐT** (xem `tasks.md` mục 0.1): 40.32MB, cold start 1.2s, không phải rủi ro chặn đường nữa.
- **BREAKING (nội bộ, không ảnh hưởng frontend)**: toàn bộ endpoint hiện tại (`/api/cong-trinh/*`, `/api/phieu/*`, `/api/hang-hoa/*`, `/api/ton-kho/*`, `/api/bao-cao/*`, `/api/ai/*`, `/api/files/*`, `/api/import-data/*`, `/api/nhat-ky/*`, `/api/ghi-chu/*`) đổi implementation nội bộ sang Firestore Admin SDK — giữ nguyên path + JSON request/response shape để frontend không phải sửa. (`/api/auth/*` đã đổi từ trước, không nằm trong phạm vi change này.)

## Capabilities

### New Capabilities
- `firestore-data-layer`: Yêu cầu về lưu trữ dữ liệu trên Firestore (thay Supabase Postgres), tính tồn kho runtime thay view SQL, cascade delete công trình, và tính đúng đắn khi migrate dữ liệu thật.
- `vercel-serverless-backend`: Yêu cầu về việc chạy backend Python trên Vercel Serverless Functions — giới hạn thời gian chạy/dung lượng gói, và cách xử lý luồng AI đọc phiếu (PDF) trong ràng buộc đó.

### Modified Capabilities
(không có — KhoUNICE_Web chưa có spec nào trong `openspec/specs/`)

## Impact

- Toàn bộ `api/supabase_client.py` (~720 dòng) và 10/11 router còn lại (`cong_trinh`, `phieu`, `hang_hoa`, `ton_kho`, `bao_cao`, `ai_routes`, `ai_config`, `import_data`, `nhat_ky`, `ghi_chu` — trừ `auth.py` đã đổi từ trước và `files.py` cần rà lại) bị ảnh hưởng.
- ~~Cần Sếp tạo 1 Firebase project riêng~~ — **ĐÃ CÓ**: `hpcons-khoctr` (Spark plan), còn thiếu bước "+Add app" + bật Firestore + lấy service account key.
- ~~Cần Sếp tạo Vercel project, trỏ domain~~ — **ĐÃ XONG**.
- Dữ liệu production thật (phiếu nhập/xuất, tồn kho, công trình, vai trò người dùng, phân quyền công trình, ghi chú, nhật ký) cần export + migrate — có khung giờ bảo trì để tránh lệch dữ liệu giữa 2 hệ thống trong lúc chuyển đổi. Không còn dữ liệu đăng nhập (password) nào cần migrate.
- Supabase project giữ lại tối thiểu 2-4 tuần sau cắt chuyển để có thể rollback.
- Dọn `JWT_SECRET`/`SETUP_KEY` khỏi biến môi trường Vercel — không còn được dùng ở đâu (auth đã đổi sang SSO), không phải "rotate" mà là xoá hẳn.
