## Why

Sếp quyết định (2026-07-14) chuyển hạ tầng KhoUNICE Web sang chuẩn công ty: repo GitHub công ty (đã xong — đã push sang `github.com/ithungphuoc-ops/KhoCtr`), domain thật `khoct.hpcore.vn` chạy qua Vercel (giống mô hình `account.hpcore.vn` của hpcons-portal), và Firebase Firestore làm database thay Supabase. Đây là hệ thống production thật đang có dữ liệu vận hành kho công trình (thủ kho dùng hàng ngày) — mục tiêu là giữ nguyên 100% hành vi nghiệp vụ cho người dùng, chỉ đổi hạ tầng lưu trữ và nơi chạy.

## What Changes

- **Gộp frontend + backend vào CHUNG 1 Vercel project** (không tách 2 hosting riêng) — đúng theo cấu trúc mọi app khác của công ty đang dùng (hpcons-portal, ITAsset, pkd-crm: 1 project Vercel, 1 domain, không có "cầu nối" giữa 2 hệ thống). Frontend (Vite build) làm static output, backend Python chạy dưới thư mục `/api` như Vercel Function — theo đúng pattern đã spike thành công (`pymupdf-spike`).
- Bỏ đoạn code FastAPI tự serve frontend qua `StaticFiles`/catch-all (`main.py` dòng 76-98) — không cần nữa vì Vercel tự serve frontend build tĩnh.
- Backend FastAPI (hiện chạy Render.com, gọi Supabase Postgres qua REST thuần bằng `urllib`, không dùng SDK) → chuyển chạy trên Vercel Serverless Functions (Python runtime) **theo 2 bước tách rời rủi ro**:
  - **Bước 1 (rủi ro thấp)**: chỉ đổi *nơi chạy* — backend vẫn gọi y hệt `supabase_client.py`/Supabase như hiện tại, KHÔNG đổi 1 dòng logic đọc/ghi dữ liệu nào. Domain `khoct.hpcore.vn` trỏ thẳng vào project Vercel gộp này ngay từ bước này.
  - **Bước 2 (rủi ro cao, làm riêng sau khi Bước 1 ổn định)**: đổi *nơi lưu trữ* — gọi Firebase Admin SDK (Firestore) thay `supabase_client.py`.
- 9 bảng Postgres (`cong_trinh`, `phieu`, `chi_tiet_phieu`, `hang_hoa`, `app_users`, `user_congtrinh`, `activity_log`, `project_ai_config`, `ghi_chu`) → collection Firestore tương ứng, giữ nguyên tên field (snake_case) để tối thiểu hóa thay đổi ở router/frontend.
- View tính toán `v_ton_kho` (tổng nhập trừ tổng xuất) → **không cần thiết kế view mới**: `supabase_client.py` đã có sẵn hàm `compute_ton_kho()` tính tồn kho ở tầng Python (đọc `phieu`+`chi_tiet_phieu`, group trong bộ nhớ) — port gần như nguyên vẹn, chỉ đổi nguồn đọc sang Firestore.
- Cascade delete công trình (`chi_tiet_phieu` → `phieu` → `hang_hoa` → `cong_trinh`, `routers/cong_trinh.py`) → viết lại bằng Firestore batch delete, giữ đúng thứ tự.
- Auth JWT tự chế (HMAC-SHA256, PBKDF2, `routers/auth.py`) → **giữ nguyên 100%**, không dùng Supabase Auth nên không có gì phải migrate ở tầng đăng nhập.
- Mã hóa API key AI theo công trình (`crypto_utils.py`, bảng `project_ai_config`) → giữ nguyên thuật toán, chỉ đổi nơi lưu ciphertext.
- **Cần đánh giá riêng (spike) trước khi cam kết toàn bộ kiến trúc**: khả năng chạy `pymupdf`/`fitz` (render PDF → ảnh cho AI đọc phiếu, `ai_reader.py`) trên Vercel Python serverless — rủi ro dung lượng gói + timeout ngắn hơn Render. Xem `design.md`.
- **BREAKING (nội bộ, không ảnh hưởng frontend)**: toàn bộ endpoint hiện tại (`/api/cong-trinh/*`, `/api/phieu/*`, `/api/hang-hoa/*`, `/api/ton-kho/*`, `/api/bao-cao/*`, `/api/ai/*`, `/api/auth/*`, `/api/files/*`, `/api/import-data/*`, `/api/nhat-ky/*`, `/api/ghi-chu/*`) đổi implementation nội bộ sang Firestore Admin SDK — giữ nguyên path + JSON request/response shape để frontend không phải sửa.

## Capabilities

### New Capabilities
- `firestore-data-layer`: Yêu cầu về lưu trữ dữ liệu trên Firestore (thay Supabase Postgres), tính tồn kho runtime thay view SQL, cascade delete công trình, và tính đúng đắn khi migrate dữ liệu thật.
- `vercel-serverless-backend`: Yêu cầu về việc chạy backend Python trên Vercel Serverless Functions — giới hạn thời gian chạy/dung lượng gói, và cách xử lý luồng AI đọc phiếu (PDF) trong ràng buộc đó.

### Modified Capabilities
(không có — KhoUNICE_Web chưa có spec nào trong `openspec/specs/`)

## Impact

- Toàn bộ `backend/supabase_client.py` (~720 dòng) và 11/12 router (`cong_trinh`, `phieu`, `hang_hoa`, `ton_kho`, `bao_cao`, `ai_routes`, `ai_config`, `auth`, `import_data`, `nhat_ky`, `ghi_chu` — trừ `files.py` cần rà lại) bị ảnh hưởng — gần như toàn bộ backend.
- Cần Sếp tạo 1 Firebase project riêng cho KhoUNICE Web (Firestore + service account key), tương tự các lần đã làm cho ITAsset/hpcons-portal.
- Cần Sếp tạo Vercel project, trỏ domain `khoct.hpcore.vn`.
- Dữ liệu production thật (phiếu nhập/xuất, tồn kho, công trình, người dùng, phân quyền, ghi chú, nhật ký) cần export + migrate — có khung giờ bảo trì để tránh lệch dữ liệu giữa 2 hệ thống trong lúc chuyển đổi.
- Supabase project giữ lại tối thiểu 2-4 tuần sau cắt chuyển để có thể rollback.
