## 0. Spike — ĐÃ XONG

- [x] 0.1 Deploy 1 Vercel Function Python tối thiểu dùng `fitz`/`pymupdf` render 1 trang PDF thật — đo dung lượng gói build, cold start, thời gian chạy. **KẾT QUẢ (2026-07-14, project spike `pymupdf-spike` trong team `hpcons-ita-sset`, đã xóa sau khi test xong)**: build 3s, function size **40.32MB** (rất xa giới hạn 250MB), cold start **1.2s** (import fitz 0.24s + render 0.15s), warm call **0.7s** (render 0.09s). PyMuPDF 1.24.0 chạy tốt trên Python 3.12 runtime của Vercel (build bằng `uv`, cần khai báo entrypoint qua `pyproject.toml` — convention mới). → Không còn là rủi ro chặn đường.
- [ ] 0.2 Đo thời gian xử lý thật của luồng AI đọc phiếu hiện tại trên Render (1 phiếu ảnh, 1 PDF nhiều trang) để so sánh với hạn mức timeout Vercel — chưa làm, không chặn đường (có thể đo song song lúc test Bước 1)
- [x] 0.3 Quyết định (cùng Sếp): kiến trúc toàn Vercel hay hybrid — **đã chốt: toàn Vercel**
- [ ] 0.4 Xác nhận gói Vercel đang dùng (Hobby/Pro) — Sếp kiểm tra tại vercel.com/teams/hpcons-ita-sset/settings/billing — ảnh hưởng timeout 10s/60s cho luồng AI

## 1. Bước 1 — ĐÃ XONG (2026-07-14)

Gộp frontend+backend vào 1 project Vercel (`khounice-web`, team `hpcons-ita-sset`), domain `khoct.hpcore.vn` đã trỏ vào, backend chạy dưới `api/` (đổi tên từ `backend/`), Supabase không đổi gì lúc đó. Đang chạy production ổn định.

- [x] 1.1–1.11 Toàn bộ việc gộp hosting, đổi entrypoint, bỏ static-serve, trỏ domain — đã xong, xác nhận qua smoke test `khoct.hpcore.vn` trả 200.
- [ ] 1.12 Chưa xác nhận Render cũ đã tắt hẳn chưa — rà lại trước khi dọn dẹp Bước 2 (không chặn đường, chỉ cần biết để không bỏ sót)
- [ ] 1.13 Tắt/tạm dừng service Render cũ nếu còn chạy

## 2. Bước 2 — Firebase Project Setup

- [x] 2.1 Firebase project đã có sẵn: **`hpcons-khoctr`** (Spark plan) — chưa bật Firestore, chưa add app nào
- [x] 2.2 Đã bấm "+Add app" (Web), bật Firestore Database, tạo Service Account key — Sếp gửi file JSON (2026-07-14)
- [x] 2.3 Thêm `api/firestore_client.py` (khởi tạo lazy, Admin SDK) — viết trên nhánh `migrate-firestore` (chưa merge main), port 1:1 chữ ký hàm từ `supabase_client.py` + bộ lọc mini-PostgREST tự viết (eq/gte/lte/in/is.null/ilike/or) + chiến lược doc-ID (counter cho bảng có id số, khóa tự nhiên cho hang_hoa/project_ai_config, auto-id cho bảng còn lại). **ĐÃ TEST THẬT (2026-07-14)**: deploy Vercel Preview + endpoint self-test tạm (đã xoá sau khi test xong) — PASS toàn bộ: connect, insert (counter sinh id tự tăng), select eq, update, insert thứ 2 + filter gte + order, xoá hàng loạt qua `id=gte.0`, và 1 hàm nghiệp vụ thật (`get_all_cong_trinh`) chạy đúng trên collection rỗng.
- [x] 2.4 Thêm `KHOCTR_FIREBASE_SERVICE_ACCOUNT` vào Vercel Environment Variables (cả Production/Preview/Development). **Phát hiện phụ lúc này**: toàn bộ biến môi trường cũ (`SUPABASE_URL`, `SUPABASE_KEY`, `HPCORE_FIREBASE_SERVICE_ACCOUNT`, v.v.) trước giờ chỉ có ở Production, chưa có ở Preview — khiến MỌI bản Preview deploy trước đây đều crash ngay lúc import (không liên quan gì Firestore). Đã copy toàn bộ sang Preview luôn, Production không đổi gì.

## 3. Data Model & Firestore Infrastructure

- [ ] 3.1 Định nghĩa cấu trúc document Firestore cho 9 collection (`cong_trinh`, `phieu`, `chi_tiet_phieu`, `hang_hoa`, `app_users`, `user_congtrinh`, `activity_log`, `project_ai_config`, `ghi_chu`) — giữ nguyên tên field snake_case. `app_users` chỉ cần `email`, `ten`, `role`, `active` — KHÔNG migrate `password_hash` (giờ chỉ là placeholder cố định, không phải mật khẩu thật, không có giá trị gì để giữ)
- [ ] 3.2 Quyết định document ID: giữ nguyên ID cũ (dạng string) làm Firestore doc ID cho mọi collection có foreign key tham chiếu (`phieu.id`, `hang_hoa.ma_hang`, `cong_trinh.id`, `app_users.id`)
- [ ] 3.3 Viết `firestore.rules` — chặn ghi trực tiếp từ client (toàn bộ đi qua Admin SDK phía server), vì đây là backend server-side, không có Firestore client SDK phía frontend
- [ ] 3.4 Viết `firestore.indexes.json` dựa trên toàn bộ query hiện có trong `supabase_client.py` (lọc theo `cong_trinh_id`, `phieu_id in (...)`, `deleted_at is null`, sort theo `ngay`/`created_at`)
- [ ] 3.5 Deploy rules + indexes lên Firebase project

## 4. Data Access Layer (Firestore)

- [ ] 4.1 Viết `backend/firestore_client.py` thay `supabase_client.py` — giữ nguyên chữ ký từng hàm (`select`, `insert`, `update`, `delete`, và toàn bộ hàm nghiệp vụ như `get_all_cong_trinh`, `push_phieu`, `compute_ton_kho`, `log_activity`...) để router không phải sửa nhiều
- [ ] 4.2 Port `compute_ton_kho()` sang đọc Firestore — giữ nguyên logic group theo `(ma_hang hoặc ten_hang, cong_trinh_id)`, tính `tong_nhap`/`tong_xuat`/`ton_cuoi`
- [ ] 4.3 Viết cascade delete công trình bằng `WriteBatch` (giới hạn 500 op/batch) — đúng thứ tự `chi_tiet_phieu → phieu → hang_hoa → cong_trinh`
- [ ] 4.4 Port `get_cong_trinh_stats` (đếm phieu/hang_hoa/chi_tiet_phieu trước khi xóa) sang Firestore
- [ ] 4.5 Port pagination (`_fetch_all`, giới hạn 1000 rows/lần trên PostgREST) — Firestore không có giới hạn tương tự nhưng cần giữ hành vi phân trang nếu dữ liệu lớn (dùng cursor Firestore)
- [ ] 4.6 Port soft-delete `ghi_chu` (`deleted_at is null` filter) sang Firestore query

## 5. Routers — đổi từng router sang gọi `firestore_client`

- [ ] 5.1 `routers/cong_trinh.py` — CRUD + stats + cascade delete
- [ ] 5.2 `routers/phieu.py`
- [ ] 5.3 `routers/hang_hoa.py`
- [ ] 5.4 `routers/ton_kho.py` (them-hang, dieu-chinh, xoa-hang)
- [ ] 5.5 `routers/bao_cao.py` (pagination, thống kê)
- [ ] 5.6 `routers/auth.py` — auth đã là SSO hpcore (không đổi ở change này), chỉ đổi phần đọc/ghi `app_users` (đồng bộ role/active) và `user_congtrinh`/`permissions` (phân quyền công trình) sang Firestore
- [ ] 5.7 `routers/import_data.py`
- [ ] 5.8 `routers/nhat_ky.py` (activity_log)
- [ ] 5.9 `routers/ghi_chu.py` (soft-delete)
- [ ] 5.10 `routers/ai_config.py` — đổi phần đọc/ghi `project_ai_config`, giữ nguyên `crypto_utils.py`
- [ ] 5.11 `routers/ai_routes.py` — chỉ đổi phần liên quan Supabase nếu có (chủ yếu là AI, ít/không liên quan DB)
- [ ] 5.12 `routers/files.py` — rà lại có gọi Supabase không (chưa audit)

## 6. Data Migration (dữ liệu thật) — ĐÃ XONG (2026-07-14)

- [x] 6.1 Đếm trực tiếp qua Supabase REST trước khi migrate (không cần Sếp export tay): cong_trinh=2, hang_hoa=1144, phieu=1491, chi_tiet_phieu=3991, app_users=4, user_congtrinh=1, activity_log=77, project_ai_config=1, ghi_chu=0
- [x] 6.2 Viết script migrate bằng Node (`migrate.mjs`, không dùng Python vì máy này không có Python cục bộ) — đọc Supabase REST, ghi Firestore Admin SDK, có `--dry-run`. **Phát hiện lỗi lúc chạy 2 lần**: nhánh auto-id (chi_tiet_phieu/activity_log/user_congtrinh) không idempotent — sinh ID mới mỗi lần chạy thay vì ghi đè → lần chạy "đồng bộ lại" thứ 2 tạo trùng lặp 2x dữ liệu. Đã viết script `dedupe.mjs` dọn sạch (dựa vào field `id` gốc từ Supabase còn giữ trong document — bản ghi không có field này là dữ liệu thật tạo sau cutover, không đụng vào) — xác nhận 0 dữ liệu thật bị mất.
- [x] 6.3 Đối chiếu số lượng: khớp 100% cả 9 collection sau khi dedupe.
- [x] 6.4 Spot-check: 3 phiếu ngẫu nhiên khớp field-by-field, tính lại tồn kho CT=3 qua Firestore (1118 dòng, tổng 309,621.41) khớp tuyệt đối với `/api/ton-kho` cũ trên Supabase production.

## 7. Cutover & Cleanup — ĐÃ XONG (2026-07-14)

- [x] 7.1 Sếp chỉ đạo bỏ qua bước chọn khung giờ bảo trì ("không cần chọn khung giờ, cứ làm cho xong") — chấp nhận rủi ro race-condition ngắn, đã giảm thiểu bằng cách chạy đồng bộ lần cuối ngay trước khi merge/deploy.
- [x] 7.2 Chạy lại migrate lần cuối trước khi deploy (xem 6.2 — chính lần này gây ra lỗi trùng lặp, đã dọn ở 6.2).
- [x] 7.3 Merge nhánh `migrate-firestore` → `main`, deploy production (commit `f724127` → sau đó 3 hotfix hiệu năng `9da7e2f`/`b956f06`/`f4e7cb2`). Domain `khoct.hpcore.vn` xác nhận hoạt động.
- [ ] 7.4 CHƯA gỡ `api/supabase_client.py`/biến `SUPABASE_URL`/`SUPABASE_KEY` — cố tình giữ lại 1 thời gian để có đường lùi (rollback) nếu phát sinh vấn đề, dù code hiện tại không còn gọi tới nữa. Cũng chưa gỡ `JWT_SECRET`/`SETUP_KEY` (đã xác nhận không còn dùng từ khi chuyển sang SSO — xem `remove-local-auth-hpcore-sso/tasks.md` 5.1).
- [ ] 7.5 Supabase hiện KHÔNG bị khoá ghi (app đã không còn gọi tới nên tự nhiên là "đóng băng", nhưng chưa chủ động set read-only phía Supabase Dashboard) — giữ nguyên tối thiểu 2-4 tuần trước khi tắt hẳn, theo đúng kế hoạch gốc.

**Sự cố phát sinh + đã xử lý trong lúc cutover (đều đã khắc phục xong, ghi lại làm bài học):**
- **Lộ secret**: file JSON service account thật bị tự động tải vào thư mục repo lúc Sếp gửi qua chat, vô tình bị `git add -A` gom vào 1 commit và push lên GitHub. Xử lý: xoá file, amend + force-push xoá khỏi lịch sử nhánh `migrate-firestore`, thêm rule `.gitignore`/`.vercelignore` chặn tái diễn, Sếp đã tạo key mới thay hẳn key cũ (không chỉ xoá khỏi git mà còn revoke luôn).
- **Hiệu năng**: `select()` của `firestore_client.py` luôn quét toàn bộ collection rồi lọc trong Python (khác PostgREST). Nhiều hàm (`compute_ton_kho`, `get_lich_su`, `bao_cao_tong_hop`, cascade delete công trình) port nguyên logic chia batch 100 ID từ Supabase — với Firestore, mỗi lần gọi lại là 1 lần quét lại TOÀN BỘ collection, gây timeout thật trên production (`/api/ton-kho` mất >12s trên gói Hobby giới hạn 10s). Đã sửa: gộp thành 1 lần gọi/collection thay vì chia batch, thêm cache TTL 8s cho việc đọc toàn bộ collection (tự invalidate khi ghi) — `/api/bao-cao/tong-hop` từ 13.4s xuống 7.8s (cold) / 0.78s (warm).
- **Migrate không idempotent**: xem 6.2 ở trên.

## 8. Verification (sau Bước 2)

- [x] 8.1 Auth: `/api/auth/me` trả 401 khi chưa đăng nhập (đúng hành vi) — chưa test login thật bằng tài khoản SSO sau cutover.
- [x] 8.2 Smoke test qua API thật: `/api/cong-trinh/`, `/api/phieu/`, `/api/hang-hoa/`, `/api/ton-kho/`, `/api/nhat-ky/`, `/api/bao-cao/tong-hop` đều 200 và đúng số liệu. Chưa test qua giao diện thật (click tay từng luồng).
- [ ] 8.3 Cascade delete công trình — logic đã test qua self-test tích hợp (dữ liệu giả), CHƯA test qua giao diện thật với dữ liệu thật.
- [ ] 8.4 AI đọc phiếu — chưa test lại sau cutover (không phụ thuộc DB nên rủi ro thấp, nhưng chưa xác nhận thực tế).
- [ ] 8.5 Phân quyền theo công trình — chưa test qua giao diện với tài khoản user (thủ kho) thật.
- [x] 8.6 Ghi chú công việc — endpoint yêu cầu đăng nhập đúng như thiết kế (401 khi chưa login), chưa test CRUD thật qua UI.
- [x] 8.7 Nhật ký hoạt động — `/api/nhat-ky/` trả 200, có dữ liệu (77 bản ghi migrate + không lẫn rác selftest).
- [x] 8.8 Báo cáo tổng hợp — KPI khớp kỳ vọng (2 công trình, 1491 phiếu, 1144 mặt hàng); lưu ý `tong_tien_nk`/`tong_tien_xk` = 0 nhưng đã xác nhận đây là đặc điểm dữ liệu gốc trên Supabase (không phải lỗi migrate) — cột `tong_tien` ở bảng `phieu` vốn không được ghi nhất quán, tiền thật nằm ở `chi_tiet_phieu.thanh_tien`.
