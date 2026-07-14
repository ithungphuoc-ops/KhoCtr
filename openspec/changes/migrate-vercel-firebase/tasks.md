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
- [ ] 2.2 Bấm "+Add app" (Web app) trong `hpcons-khoctr`, bật Firestore Database (chọn region), tạo Service Account key (Admin SDK) — Sếp thao tác trên Firebase Console
- [ ] 2.3 Thêm `api/firestore_client.py` (khởi tạo lazy, Admin SDK) — theo đúng pattern `api/hpcore_auth.py` đã dùng cho project Firebase khác trong cùng repo
- [ ] 2.4 Thêm biến môi trường Firebase (`KHOCTR_FIREBASE_SERVICE_ACCOUNT` hoặc tên tương tự — đặt tên khác `HPCORE_FIREBASE_SERVICE_ACCOUNT` đang dùng cho SSO để tránh nhầm 2 project Firebase khác nhau) vào Vercel Environment Variables

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

## 6. Data Migration (dữ liệu thật)

- [ ] 6.1 Sếp export/xác nhận số lượng bản ghi hiện tại từng bảng trên Supabase Dashboard (làm mốc đối chiếu)
- [ ] 6.2 Viết `scripts/migrate-from-supabase.py`: đọc từng bảng qua Supabase REST (service-role key), ghi Firestore qua Admin SDK, giữ nguyên ID cũ làm doc ID, có cờ `--dry-run`
- [ ] 6.3 Chạy thử trên Firebase project (Firestore đang trống, an toàn) — đối chiếu số lượng bản ghi khớp 100% từng collection
- [ ] 6.4 Spot-check dữ liệu: vài phiếu + chi tiết phiếu, vài công trình, tính lại tồn kho bằng `compute_ton_kho()` mới và so sánh với `/api/ton-kho` cũ (Supabase) cho cùng công trình

## 7. Cutover & Cleanup

- [ ] 7.1 Chọn khung giờ bảo trì cùng Sếp, thông báo trước cho thủ kho nếu cần
- [ ] 7.2 Đóng ghi dữ liệu trên Supabase (thông báo/tạm khóa), chạy lại script migrate lần cuối để bắt thay đổi phát sinh
- [ ] 7.3 Deploy backend mới (cùng project Vercel đã gộp ở Bước 1, chỉ đổi data layer sang Firestore) — xác nhận biến môi trường production đã đúng
- [ ] 7.4 Gỡ `backend/supabase_client.py`, biến `SUPABASE_URL`/`SUPABASE_KEY` khỏi Vercel Environment Variables sau khi xác nhận ổn định
- [ ] 7.5 Giữ Supabase project ở trạng thái chỉ đọc (không xóa) tối thiểu 2-4 tuần trước khi cân nhắc tắt hẳn

## 8. Verification (sau Bước 2)

- [ ] 8.1 Đăng nhập qua SSO hpcore — cả admin và user (thủ kho), xác nhận vai trò đọc đúng sau khi `app_users` đã ở Firestore
- [ ] 8.2 Luồng chính: tạo công trình → nhập kho (thủ công + AI đọc phiếu) → xuất kho → xem tồn kho → sửa/xóa phiếu
- [ ] 8.3 Cascade delete công trình — xác nhận modal xác nhận hiện đúng số liệu, xóa xong không còn sót `chi_tiet_phieu`/`phieu`/`hang_hoa` mồ côi
- [ ] 8.4 AI đọc phiếu: ảnh đơn, PDF nhiều trang (cả Claude và Gemini) — xác nhận không bị ảnh hưởng bởi việc đổi database
- [ ] 8.5 Phân quyền: user chỉ thấy công trình được gán qua `user_congtrinh`, admin thấy tất cả
- [ ] 8.6 Ghi chú công việc: tạo/sửa/soft-delete/hoàn thành, deadline lọc đúng
- [ ] 8.7 Nhật ký hoạt động (`activity_log`) ghi đúng sau các thao tác chính
- [ ] 8.8 So sánh số liệu báo cáo tổng hợp (`/api/bao-cao/*`) trước và sau migrate để phát hiện lệch dữ liệu
