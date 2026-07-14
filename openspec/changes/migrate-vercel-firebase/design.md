## Context

KhoUNICE Web hiện tại: FastAPI (`backend/main.py`, 12 router, ~4700 dòng backend) chạy trên Render.com (`render.yaml`), gọi Supabase Postgres qua REST thuần (`backend/supabase_client.py` — tự viết `_request()` bằng `urllib`, không dùng SDK chính thức `supabase-py`). Frontend React/Vite/Tailwind build tĩnh, hiện được FastAPI tự serve qua `StaticFiles` + catch-all SPA route (`main.py` dòng 76-98) khi chạy chung 1 service trên Render.

9 bảng Postgres:
- `cong_trinh` — công trình (id, ma_ct, ten_ct, dia_chi, ghi_chu, trang_thai)
- `phieu` — phiếu nhập/xuất (`loai`='NK'|'XK', `so_phieu`, `ngay`, `doi_tac`, `tong_tien`, `cong_trinh_id`, `local_id`, `nguon`)
- `chi_tiet_phieu` — dòng chi tiết từng phiếu (`phieu_id`, `ten_hang`, `ma_hang`, `dvt`, `so_luong`, `don_gia`, `thanh_tien`, `ghi_chu`)
- `hang_hoa` — danh mục hàng hóa theo công trình (`ma_hang`, `ten_hang`, `dvt`, `nhom`, `cong_trinh_id`)
- `app_users` — tài khoản (`email`, `password_hash`, `role`='admin'|'user', `active`)
- `user_congtrinh` — phân quyền user↔công trình (`user_id`, `cong_trinh_id`)
- `activity_log` — nhật ký hoạt động
- `project_ai_config` — cấu hình AI (Claude/Gemini) theo công trình, `api_key_enc` mã hóa qua `crypto_utils.py`
- `ghi_chu` — ghi chú công việc (soft-delete qua `deleted_at`, có `trang_thai`, `uu_tien`, `deadline`)

**Phát hiện quan trọng**: view `v_ton_kho` (Postgres view) có vẻ là nguồn tồn kho, nhưng `supabase_client.py` đã có sẵn hàm `compute_ton_kho()` (dòng 257-358) tính tồn kho **trực tiếp trong Python** từ `phieu`+`chi_tiet_phieu`, group theo `(ma_hang hoặc ten_hang, cong_trinh_id)`, enrich từ `hang_hoa`. Nghĩa là phần lớn logic tồn kho vốn đã ở tầng ứng dụng chứ không phải SQL — port sang Firestore dễ hơn dự kiến ban đầu, chỉ cần đổi các lệnh `select()` bên trong hàm này để đọc Firestore.

Auth: JWT tự chế HMAC-SHA256 (`routers/auth.py`), password PBKDF2 100k iterations — hoàn toàn độc lập với Supabase, không dùng Supabase Auth.

AI đọc phiếu (`ai_reader.py` 757 dòng, `pdf_splitter.py`, `mapping_service.py`, `fuzzy_match.py`): dùng `pymupdf` (fitz) render PDF → ảnh PNG gửi Claude, hoặc Gemini Files API cho PDF lớn hơn ngưỡng trang. Không liên quan Supabase, nhưng liên quan trực tiếp quyết định Vercel vì đây là phần compute nặng nhất và phụ thuộc thư viện native.

## Goals / Non-Goals

**Goals:**
- Giữ nguyên 100% hành vi nghiệp vụ hiện có cho người dùng (thủ kho, admin) — không đổi UI, không đổi luồng, không đổi endpoint path hay JSON response shape.
- Domain thật `khoct.hpcore.vn` chạy qua Vercel, theo đúng mô hình `account.hpcore.vn` (hpcons-portal) đã dùng trong công ty.
- Toàn bộ đọc/ghi dữ liệu qua Firebase Admin SDK phía server (Vercel Function) — không client nào gọi Firestore trực tiếp từ browser, giữ đúng nguyên tắc đã áp dụng cho ITAsset/hpcons-portal.
- Di chuyển dữ liệu production thật không mất mát, có bước xác minh số lượng bản ghi khớp trước/sau từng bảng.
- Xác nhận bằng spike thực tế (không chỉ đọc tài liệu Vercel) khả năng chạy `pymupdf` trên Vercel Python serverless trước khi viết lại toàn bộ backend.

**Non-Goals:**
- Không đổi UI/UX.
- Không đổi luồng nghiệp vụ hiện có (nhập kho, xuất kho, AI đọc phiếu, cascade delete công trình, phân quyền theo công trình...).
- Không đổi cơ chế Auth (giữ JWT tự chế HMAC-SHA256).
- Không tối ưu lại thuật toán fuzzy-match/mapping AI hiện có — port nguyên vẹn logic.
- Không đổi tên field từ snake_case sang camelCase (khác với cách đã làm ở ITAsset) — ưu tiên rủi ro thấp nhất cho hệ thống đang chạy production thật, không đổi gì ngoài phạm vi bắt buộc.

## Decisions

- **Data model Firestore**: mỗi bảng Postgres → 1 collection cùng tên, giữ nguyên tên field snake_case như hiện tại.
  - ID: `phieu.id`, `hang_hoa.ma_hang`, v.v. hiện là số/chuỗi tăng dần trên Postgres → giữ nguyên giá trị cũ làm Firestore document ID dạng string (theo đúng pattern đã thành công ở ITAsset: giữ UUID Supabase làm Firestore doc ID) — để mọi foreign key hiện có (`chi_tiet_phieu.phieu_id`, `user_congtrinh.cong_trinh_id`, v.v.) vẫn đúng mà không cần bảng ánh xạ ID cũ↔mới.
  - `v_ton_kho` → **không tạo view/collection riêng**, port thẳng hàm `compute_ton_kho()` hiện có sang đọc Firestore.
- **Cascade delete công trình**: Firestore không có `DELETE WHERE` hàng loạt hay cascade tự động — viết lại bằng `WriteBatch` (giới hạn 500 thao tác/batch của Firestore), giữ đúng thứ tự hiện tại: `chi_tiet_phieu` → `phieu` → `hang_hoa` → `cong_trinh` (`routers/cong_trinh.py` dòng 92-110).
- **Backend hosting**: Vercel Serverless Functions, Python runtime. FastAPI có thể chạy trên Vercel qua ASGI adapter — **cần xác nhận qua spike** (xem Risks) trước khi cam kết toàn bộ, vì đây là thay đổi runtime lớn nhất so với Render (dịch vụ chạy dài hạn, có state) sang serverless (mỗi request có thể là 1 cold start riêng).
- **AI đọc phiếu (pymupdf) — quyết định treo chờ spike**: nếu spike cho kết quả xấu (vượt dung lượng/timeout), phương án dự phòng là kiến trúc lai — giữ riêng các endpoint AI (`/api/ai/*`) chạy trên Render như hiện tại, chuyển các endpoint còn lại (CRUD thuần) sang Vercel. Đây là lựa chọn kiến trúc cần Sếp duyệt nếu xảy ra.
- **Auth**: giữ nguyên JWT tự chế; `JWT_SECRET` chuyển thành Vercel Environment Variable (đã biết secret này từng bị lộ trong lịch sử git repo cũ — xem Open Questions về việc rotate).
- **Mã hóa API key AI**: giữ nguyên thuật toán `crypto_utils.py`, chỉ đổi nơi đọc/ghi ciphertext (Firestore field thay Postgres column).
- **Thứ tự cutover — 2 trục độc lập, không phải 2 "giai đoạn" đổi từng phần hệ thống** (chốt lại 2026-07-14, sau khi nhận ra hosting và database là 2 rủi ro khác bản chất):
  - **Trục 1 — nơi chạy (hosting)**: gộp frontend + backend vào 1 Vercel project ngay từ đầu (Bước 1), khớp đúng cấu trúc hpcons-portal/ITAsset/pkd-crm. Rủi ro THẤP vì backend vẫn gọi y hệt Supabase như cũ — chỉ đổi máy chạy code, không đổi câu query hay nơi lưu dữ liệu.
  - **Trục 2 — nơi lưu dữ liệu (database)**: đổi Supabase → Firestore là Bước 2, làm RIÊNG sau khi Bước 1 đã ổn định, giữ nguyên toàn bộ sự thận trọng (dry-run, đối chiếu số liệu, khung giờ bảo trì, giữ Supabase read-only) như kế hoạch ban đầu.
  - Lý do tách theo trục này thay vì theo "frontend trước, backend sau": tránh phải dựng cầu nối tạm (Vercel Rewrites/proxy) giữa 2 origin rồi tháo bỏ ngay sau đó — tốn công 2 lần và không khớp cấu trúc công ty.

## Risks / Trade-offs

- [Risk] ~~`pymupdf` trên Vercel Python serverless chưa được xác minh khả thi~~ **ĐÃ XÁC MINH (2026-07-14)**: spike thực tế cho kết quả tốt — function size 40.32MB (xa giới hạn 250MB), cold start 1.2s, render 1 trang 0.09-0.15s. Không cần kiến trúc lai, có thể giữ toàn bộ backend (kể cả AI) trên Vercel.
- [Risk] Vercel Serverless timeout ngắn hơn Render nhiều (mặc định 10s gói Hobby / 60s gói Pro, so với Render chạy dịch vụ dài hạn không giới hạn theo request) — luồng AI đọc PDF nhiều trang gọi Claude/Gemini nhiều lần có thể vượt timeout. → Mitigation: đo thời gian xử lý thật của luồng AI hiện tại trên Render trước, đối chiếu với hạn mức gói Vercel Sếp dự định dùng.
- [Risk] Firestore không có transaction xóa hàng loạt theo filter như SQL — cascade delete công trình phải tự viết vòng lặp `WriteBatch`, dễ sai thứ tự hoặc bỏ sót bản ghi nếu code sai. → Mitigation: viết test riêng cho cascade delete, đối chiếu số liệu với endpoint `/stats` hiện có (đã có sẵn, dùng để hiển thị modal xác nhận xóa) trước và sau khi xóa thật.
- [Risk] ~~Đổi cùng lúc cả 3 lớp hạ tầng...~~ **Đã xử lý bằng cách tách theo đúng trục rủi ro (2026-07-14)**: Bước 1 gộp hosting (frontend+backend chung 1 Vercel project) nhưng KHÔNG đổi database — rủi ro thấp vì Supabase không đổi gì. Bước 2 mới thực sự đổi database (Firestore), làm riêng, có rollback độc lập. Xem Decisions.
- [Risk] Serverless cold start / không còn state trong bộ nhớ giữa các request (khác Render — chạy dịch vụ dài hạn, có thể giữ state) → cần rà lại `backend/` xem có chỗ nào dựa vào biến toàn cục/cache trong bộ nhớ giữa các request không trước khi chuyển. Sơ bộ: `supabase_client.py` không thấy cache nào, mọi lệnh gọi đều là REST request độc lập — rủi ro thấp nhưng cần xác nhận lại khi rà toàn bộ router ở Bước 1.
- [Risk] Dữ liệu production thật đang được thủ kho dùng hàng ngày — downtime hoặc lệch dữ liệu lúc cắt chuyển ảnh hưởng trực tiếp vận hành kho thật (nhập/xuất hàng thật). → Mitigation: khung giờ bảo trì ngắn do Sếp chọn, giữ Supabase read-only tối thiểu 2-4 tuần sau cắt chuyển để rollback nếu cần.

## Migration Plan

1. **Spike — ĐÃ XONG (2026-07-14)**: `pymupdf` chạy tốt trên Vercel Python (40.32MB, cold start 1.2s). Không cần kiến trúc hybrid.

2. **Bước 1 — Gộp frontend + backend vào 1 Vercel project, Supabase giữ nguyên** (rủi ro thấp — chỉ đổi nơi chạy, không đổi nơi lưu dữ liệu):
   - Sếp tạo Vercel project mới cho KhoUNICE Web.
   - Cấu hình project: frontend `frontend/` (Vite build) làm static output; backend `backend/` chạy dưới `/api` như Vercel Function (Python runtime, theo đúng cấu hình `pyproject.toml` đã xác nhận qua spike).
   - Backend **giữ nguyên 100%** `supabase_client.py` và toàn bộ router — chỉ đổi entrypoint để chạy được trên Vercel (ASGI adapter) và bỏ đoạn code serve frontend qua `StaticFiles`/catch-all trong `main.py` (Vercel tự serve frontend tĩnh).
   - Copy nguyên giá trị biến môi trường từ Render sang Vercel (`SUPABASE_URL`, `SUPABASE_KEY`, `CLAUDE_API_KEY`, `GEMINI_API_KEY`, `JWT_SECRET`, `SETUP_KEY`) — không đổi giá trị.
   - Deploy preview, test toàn bộ luồng chính bằng **dữ liệu Supabase thật** (an toàn vì database không đổi gì, chỉ là code chạy trên máy khác gọi vào cùng 1 DB như cũ).
   - Trỏ domain `khoct.hpcore.vn` vào project Vercel này.
   - Theo dõi ổn định, rồi tắt service cũ trên Render (giữ lại vài ngày phòng hờ trước khi tắt hẳn).
   - **Rollback nếu cần**: trỏ domain lại Render — Render service + Supabase không hề bị đụng vào trong suốt Bước 1.

3. **Bước 2 — Đổi Supabase → Firestore** (rủi ro cao, làm riêng sau khi Bước 1 ổn định, trong CHÍNH project Vercel đã gộp ở Bước 1):
   - Sếp tạo Firebase project riêng cho KhoUNICE Web (Firestore + service account key), tương tự ITAsset/hpcons-portal trước đây.
   - Viết tầng data-access mới (`backend/firestore_client.py` thay `supabase_client.py`), **giữ nguyên chữ ký hàm** để tối thiểu hóa thay đổi trong từng router.
   - Build song song, test bằng dữ liệu giả trên Firebase project vừa tạo — CHƯA đấu dữ liệu production thật.
   - Viết script migrate dữ liệu thật 1 lần (đọc Supabase qua REST bằng service-role key, ghi Firestore qua Admin SDK, giữ nguyên ID cũ làm doc ID), có cờ `--dry-run`, in số lượng bản ghi từng bảng/collection để đối chiếu.
   - Chọn khung giờ bảo trì cùng Sếp: đóng ghi dữ liệu trên Supabase → chạy script migrate lần cuối (bắt thay đổi phát sinh) → deploy backend (cùng project Vercel, chỉ đổi data layer) trỏ Firestore → smoke test toàn bộ luồng chính → mở lại cho người dùng.
   - Giữ Supabase project ở trạng thái chỉ đọc (không xóa) tối thiểu 2-4 tuần sau cắt chuyển.
   - **Rollback nếu cần**: deploy lại bản code Bước 1 (vẫn gọi Supabase) lên cùng project Vercel — domain/hosting không đổi gì, chỉ revert data layer.

## Open Questions

- ~~Kết quả spike `pymupdf` trên Vercel~~ **Đã chốt (2026-07-14)**: kiến trúc toàn Vercel, không cần hybrid — xem Risks.
- Vercel gói đang/sẽ dùng là Hobby hay Pro? (ảnh hưởng trực tiếp giới hạn timeout 10s vs 60s cho luồng AI đọc phiếu — riêng bước render đo được rất nhanh (~0.1s/trang), nhưng còn cần cộng thêm thời gian gọi API Claude/Gemini thật, chưa đo).
- Khung giờ bảo trì cắt chuyển Giai đoạn B — Sếp chọn thời điểm nào ít ảnh hưởng thủ kho nhất?
- Rotate `JWT_SECRET`/`GEMINI_API_KEY` (đã phát hiện bị lộ trong lịch sử git repo cũ ngày 2026-07-14, Sếp đã chọn hoãn) — làm trước, trong, hay sau migration này? Nên làm trước khi migrate xong vì `JWT_SECRET` sẽ tiếp tục được dùng nguyên trên Vercel nếu không đổi.
