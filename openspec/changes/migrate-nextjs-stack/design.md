## Context

KhoCtr hiện tại: FastAPI (`api/main.py`, 12 router, ~2.781 dòng router + ~2.987 dòng hỗ trợ = ~5.768 dòng backend) chạy trên Vercel Serverless Function (Python runtime), gọi Firestore qua Admin SDK bằng tầng tự viết `api/firestore_client.py` (851 dòng, mô phỏng cú pháp mini-PostgREST: `select(table, filters="field=eq.val", order=...)`). Frontend React/Vite/Tailwind (`frontend/src/`, ~12.604 dòng JSX, 25 trang, `react-router-dom` cho routing client-side), build tĩnh, Vercel serve qua rewrite.

Auth: SSO `account.hpcore.vn` — verify session cookie qua Firebase Admin SDK (`api/hpcore_auth.py`, 72 dòng), đọc vai trò per-app từ `app_permissions/{uid}.warehouse` (Firestore project `hpcons-portal`). Đã hoạt động ổn định từ 2026-07-14 (change `remove-local-auth-hpcore-sso`).

AI đọc phiếu: `ai_routes.py` (412 dòng) + `ai_config.py` (475 dòng) — gọi Gemini/Claude, cấu hình + mã hoá API key theo công trình (`cryptography` package). Tách PDF: `pdf_splitter.py` (298 dòng) dùng `pymupdf`/`pypdf` để tách 1 file PDF nhiều trang thành từng phiếu riêng, có AI hỗ trợ nhận diện ranh giới trang — đây là phần **compute nặng nhất và phụ thuộc thư viện native**, không có tương đương 1:1 bên Node (PyMuPDF không tồn tại cho JS; `pdf-lib`/`pdfjs-dist` có thể làm được nhưng thuật toán tách trang cần viết lại, không phải dịch).

Database: Firestore project `hpcons-khoctr`, **không đổi** ở change này — đã ổn định từ đợt migrate 2026-07-14, vừa được vá hiệu năng 2026-07-27 (native prefilter cho filter 2+ điều kiện, cache TTL riêng theo bảng cho `hang_hoa`/`cong_trinh`/`project_ai_config`). Toàn bộ logic tối ưu này cần port đúng sang TypeScript, không port lại bản chưa vá.

4 app khác trong workspace (hpcons-portal, ITAsset, pkd_crm-next, hpcons-quatang) đã có sẵn pattern SSO + Firebase Admin SDK bằng TypeScript — dùng làm khuôn mẫu copy-adapt cho phần auth, giảm đáng kể rủi ro/thời gian so với viết mới.

## Goals / Non-Goals

**Goals:**
- Đồng nhất workspace về 1 stack Next.js (App Router) + TypeScript duy nhất.
- Giữ nguyên 100% hành vi nghiệp vụ và UI/UX cho người dùng cuối — không đổi luồng thao tác, không redesign giao diện.
- Không đổi dữ liệu Firestore hiện có (collection/field/doc ID) — chỉ đổi ngôn ngữ tầng code truy cập.
- Port đúng các tối ưu hiệu năng đã vá (2026-07-27: native prefilter, cache TTL riêng theo bảng) — không port lại bản gốc chưa vá.
- Tách rủi ro theo từng giai đoạn nhỏ, làm phần rủi ro cao nhất (tách PDF bằng AI) sau cùng, có thể chạy song song 2 bản trong lúc kiểm chứng.

**Non-Goals:**
- Không đổi UI/UX nhìn thấy được.
- Không thêm tính năng mới.
- Không đổi database hay cấu trúc dữ liệu Firestore.
- Không tối ưu lại thuật toán fuzzy-match/mapping AI ngoài việc port ngôn ngữ (giữ nguyên logic `mapping_service.py`).
- Không bắt buộc giữ nguyên response shape của từng API nội bộ (khác với đợt migrate Firestore trước) — vì Next.js đổi cả frontend lẫn backend cùng lúc, không có consumer bên ngoài nào phụ thuộc vào shape JSON hiện tại (không có mobile app dùng chung API này).

## Decisions

- **Framework đích**: Next.js 15 (App Router) + TypeScript + Tailwind, khớp đúng stack đã ghi trong `README.md`/`CLAUDE.md` của chính repo này và 4 app khác trong workspace.
- **Auth**: copy nguyên pattern session-cookie SSO từ `hpcons-quatang`/`pkd_crm-next` (`lib/session.ts`, `lib/hpcore.ts`) — đọc `HPCORE_FIREBASE_SERVICE_ACCOUNT`, verify cookie, đọc `app_permissions/{uid}.warehouse`. Rủi ro thấp vì đã có 4 lần triển khai thành công trước đó.
- **Data layer**: viết `lib/firestore/client.ts` port từ `firestore_client.py`, giữ nguyên chữ ký hàm nghiệp vụ (`getAllCongTrinh`, `computeTonKho`, `pushPhieu`, ...) và giữ nguyên tên collection/field snake_case (không đổi sang camelCase) — ưu tiên rủi ro thấp nhất, không đổi gì ngoài phạm vi bắt buộc (giống quyết định đã áp dụng ở đợt migrate Firestore).
- **Giai đoạn hoá** (tách theo rủi ro tăng dần, mỗi giai đoạn deploy/kiểm chứng riêng trước khi sang giai đoạn kế):
  1. **GĐ1 — Nền tảng**: scaffold Next.js project, port `lib/firestore/*.ts` (data layer) + auth/SSO + layout/menu chung. Chưa có trang nghiệp vụ nào chạy thật.
  2. **GĐ2 — Trang CRUD thường**: Công trình, Danh mục (hàng hóa), Phiếu nhập/xuất, Tồn kho, Báo cáo, Ghi chú, Nhật ký, Phân quyền. Đây là phần lớn nhất về khối lượng nhưng rủi ro kỹ thuật thấp nhất (không có thư viện native, không compute nặng).
  3. **GĐ3 — Import Excel**: `exceljs`/`xlsx` thay `openpyxl`.
  4. **GĐ4 — AI đọc phiếu (cấu hình + gọi Gemini/Claude)**: port `ai_config.py`/`ai_routes.py`, mã hoá API key dùng Node `crypto` thay `cryptography`.
  5. **GĐ5 — Tách PDF bằng AI (rủi ro cao nhất)**: viết lại bằng `pdf-lib`/`pdfjs-dist`, test song song với bản Python cũ (giữ endpoint Python tạm thời hoặc so sánh output thủ công) trước khi cutover hẳn.
- **Deploy**: giữ cùng project Vercel (`khounice-web`) + domain `khoct.hpcore.vn` — làm trên nhánh riêng (`migrate-nextjs`), build thử qua Preview deployment trước, chỉ merge `main` khi từng giai đoạn đã test xong qua giao diện thật.
- **Rollback**: nhánh `main` (code Python/Vite hiện tại) giữ nguyên, không xoá cho tới khi GĐ5 xong và đã chạy ổn định production tối thiểu vài tuần.

## Risks / Trade-offs

- [Risk cao] **Tách PDF bằng AI** (`pdf_splitter.py`) — không có thư viện Node tương đương PyMuPDF, phải viết lại thuật toán (không phải dịch cơ học). Sai lệch hành vi ở đây ảnh hưởng trực tiếp việc thủ kho tách phiếu từ file PDF gộp. → Mitigation: làm sau cùng (GĐ5), test đối chiếu output với bản Python cũ trên nhiều mẫu PDF thật trước khi cutover, có thể giữ endpoint Python cũ chạy song song tạm thời qua rewrite riêng nếu cần thêm thời gian kiểm chứng.
- [Risk trung bình] **Khối lượng lớn** (~18.000 dòng qua 2 ngôn ngữ khác nhau, 25 trang) — rủi ro sai sót rải rác ở nhiều trang nhỏ lẻ, khó phát hiện hết bằng test tự động. → Mitigation: chia giai đoạn nhỏ (xem Decisions), mỗi giai đoạn test qua giao diện thật trước khi sang giai đoạn kế, không gộp hết vào 1 lần cutover.
- [Risk trung bình] **Cấu hình AI/mã hoá API key** — đổi thuật toán mã hoá (`cryptography` Python → Node `crypto`) có thể làm ciphertext cũ không giải mã được nếu không cẩn thận migrate đúng cách. → Mitigation: hoặc giữ nguyên thuật toán mã hoá tương đương (AES-GCM cả 2 bên), hoặc viết script giải mã bằng Python + mã hoá lại bằng Node 1 lần khi cutover GĐ4, có bước xác minh giải mã đúng trước khi xoá bản cũ.
- [Risk thấp] **Dữ liệu production** — khác đợt migrate Firestore trước, lần này **không đổi database**, chỉ đổi code đọc/ghi — rủi ro mất/lệch dữ liệu thấp hơn nhiều. Rủi ro chính là sai logic nghiệp vụ khi port, không phải mất dữ liệu.
- [Risk thấp] **Env vars/service account** — cần copy đúng `KHOCTR_FIREBASE_SERVICE_ACCOUNT` và các biến khác sang cấu hình Next.js, tương tự việc đã làm nhiều lần ở các app khác (quy trình đã quen thuộc).
- [Trade-off] Không giữ response shape API nội bộ — chấp nhận vì không có consumer bên ngoài, đổi lại giúp code Next.js idiomatic hơn (Server Components fetch trực tiếp, không cần route JSON trung gian cho mọi thứ).

## Migration Plan

1. **GĐ1 — Nền tảng**: scaffold Next.js 15 App Router trên nhánh `migrate-nextjs`, port data layer (`lib/firestore/*.ts`) + auth/SSO (copy từ `hpcons-quatang`) + layout/menu chung. Deploy Preview, xác nhận đăng nhập SSO hoạt động, xác nhận đọc thử 1 collection thật (chỉ đọc, chưa có trang nghiệp vụ).
2. **GĐ2 — Trang CRUD thường**: port từng trang theo thứ tự rủi ro/độ ưu tiên (Dashboard → Công trình → Danh mục → Phiếu nhập/xuất → Tồn kho → Báo cáo → Ghi chú → Nhật ký → Phân quyền). Mỗi trang test qua giao diện thật (click tay) trước khi sang trang kế.
3. **GĐ3 — Import Excel**: port, test với file Excel thật đã dùng trước đó.
4. **GĐ4 — AI đọc phiếu (cấu hình)**: port `ai_config`, xử lý ciphertext cũ (xem Risk mã hoá ở trên), test đọc/ghi config theo công trình.
5. **GĐ5 — Tách PDF bằng AI**: viết lại bằng `pdf-lib`/`pdfjs-dist`, test đối chiếu nhiều mẫu PDF thật với bản Python cũ, chỉ cutover khi kết quả khớp.
6. **Cutover**: merge `migrate-nextjs` → `main`, deploy production, giữ khả năng rollback (revert commit, code Python cũ vẫn còn trong lịch sử git) tối thiểu vài tuần.

## Open Questions

- Vercel gói Hobby hay Pro — ảnh hưởng timeout cho luồng AI đọc phiếu/tách PDF (cần biết trước GĐ4/GĐ5).
- Giữ nguyên thuật toán mã hoá API key hay đổi hẳn sang chuẩn Node (ảnh hưởng cách xử lý ciphertext cũ ở GĐ4) — cần Sếp quyết định khi tới GĐ4.
- Có cần giữ song song endpoint Python cũ cho riêng tính năng tách-PDF (GĐ5) trong lúc kiểm chứng, hay chấp nhận downtime ngắn cho tính năng này khi cutover?
- Thứ tự ưu tiên cụ thể giữa các trang ở GĐ2 — mặc định đề xuất theo tần suất dùng hàng ngày (Phiếu nhập/xuất, Tồn kho trước; Cài đặt/Nhà cung cấp sau) — cần Sếp xác nhận có đúng thứ tự ưu tiên thực tế không.
