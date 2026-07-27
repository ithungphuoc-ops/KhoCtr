## 0. Setup

- [x] 0.1 Tạo nhánh riêng `migrate-nextjs` cho toàn bộ công việc (không đụng `main`)
- [x] 0.2 Ghi nhận phạm vi + rủi ro vào OpenSpec (proposal.md, design.md, specs/, tasks.md — file này)
- [ ] 0.3 Xác nhận gói Vercel Hobby/Pro (ảnh hưởng timeout GĐ4/GĐ5)

## 1. GĐ1 — Nền tảng (data layer + auth)

- [x] 1.1 Scaffold Next.js 15 App Router + TypeScript + Tailwind trong `web/` (khớp stack `hpcons-quatang`/`pkd_crm-next`) — build + type-check sạch
- [x] 1.2 Copy pattern SSO từ `hpcons-quatang` (`web/lib/hpcore.ts`, `web/lib/session.ts`) — adapt `HPCORE_APP_ID = "warehouse"`, đọc `app_permissions/{uid}.warehouse`, port nguyên `get_current_user()` (đồng bộ `app_users`, giữ `uid` = id nội bộ)
- [x] 1.3 Viết `web/lib/firestore/client.ts` — port `_try_native_query`, `_native_prefilter`, `_row_matches`, cache TTL riêng theo bảng từ `api/firestore_client.py` (bản đã vá 2026-07-27, KHÔNG port bản gốc chưa vá)
- [x] 1.4 Port các hàm nghiệp vụ tầng data layer: `getAllCongTrinh`, `getPhieuList`, `getAllHangHoa`, `computeTonKho`, `getActivityLog`, `getGhiChuList` (`lib/data/*.ts`) — `getAiConfig` để dành GĐ4
- [x] 1.5 `web/vercel.json`: `regions: ["sin1"]` ngay từ đầu (không lặp lại lỗi lệch vùng miền)
- [x] 1.6 Layout/menu chung (AppShell) — port `Sidebar`, `Header` (nay đã nối đầy đủ date-range picker/xuất Excel/số cảnh báo tồn thấp — xem 1.6b), `AppLauncher` (port nguyên, tự chứa), design tokens V1.1 (`globals.css`, đúng màu/dark-mode theo `CLAUDE.md`). Phân biệt đúng 2 trường hợp không có phiên (401 redirect / 403 hiện thông báo tại chỗ, không redirect vòng lặp) — khớp `PrivateRoute` cũ. Build + type-check + lint sạch.
- [x] 1.6b Nối lại Header đầy đủ: date-range picker (bao gồm preset nhanh), nút xuất Excel (NK/XK/tổng hợp tuỳ trang, gọi `getPhieuList`/`getTonKho` + `lib/export-excel.ts`), chuông cảnh báo tồn thấp (đếm `ton_cuoi <= 20`, badge dùng `localStorage` như bản gốc)
- [ ] 1.7 Deploy Preview (project Vercel riêng hoặc nhánh của `khounice-web` — cần quyết định), xác nhận đăng nhập SSO thật + đọc thử 1 collection. **Đang chặn**: cần Sếp cấp `HPCORE_FIREBASE_SERVICE_ACCOUNT`/`KHOCTR_FIREBASE_SERVICE_ACCOUNT` vào `web/.env.local` để test cục bộ trước — chưa test runtime thật với credential thật, mới chỉ verify qua build tĩnh.

## 2. GĐ2 — Trang CRUD thường (thứ tự đề xuất theo tần suất dùng — cần Sếp xác nhận)

- [x] 2.1 Dashboard (App Tổng + App Con `ct/[id]`)
- [x] 2.2 Công trình (CRUD + cascade delete + stats)
- [x] 2.3 Danh mục hàng hóa (`DanhMuc.jsx`, `ct/CTDanhMuc.jsx`)
- [x] 2.4 Phiếu nhập (`PhieuNhap.jsx`, `ct/CTNhapKho.jsx` — bản manual-only, AI đọc PDF hàng loạt để GĐ4/GĐ5)
- [x] 2.5 Phiếu xuất (`PhieuXuat.jsx`, `ct/CTXuatKho.jsx` — bản manual-only, cùng lý do trên)
- [x] 2.6 Tồn kho (`TonKho.jsx`, `ct/CTTonKho.jsx`)
- [x] 2.7 Báo cáo (`BaoCao.jsx`) — bao gồm biểu đồ (chart.js/react-chartjs-2)
- [x] 2.8 Ghi chú công việc (`GhiChu.jsx`, soft-delete) — kanban + list, module dùng chung
- [x] 2.9 Nhật ký hoạt động (`NhatKy.jsx`)
- [x] 2.10 Phân quyền (`PhanQuyen.jsx`)
- [x] 2.11 Lịch sử giao dịch (`LichSuGiaoDich.jsx`)
- [x] 2.12 Cảnh báo (`CanhBao.jsx`)
- [x] 2.13 Nhà cung cấp (`NhaCungCap.jsx`)
- [x] 2.14 Cài đặt (`CaiDat.jsx`)
- [ ] 2.15 Mỗi trang: test qua giao diện thật (click tay) trước khi sang trang kế, không chỉ dựa vào build sạch — **chưa làm**, mới verify qua `tsc`/`eslint`/`next build`, chưa có credential thật để chạy runtime (xem 1.7)

## 3. GĐ3 — Import Excel

- [x] 3.1 Port `import_data.py` (`openpyxl`) → gói `xlsx` (SheetJS 0.20.3, cài từ CDN chính thức thay vì bản `0.18.5` có CVE trên npm registry) — cả App Tổng (`input-data`) và App Con (`ct/[id]/import-data`); đã thêm `requireAdmin()` ở 2 Route Handler (`/api/import/preview`, `/api/import/execute`) — bản Python gốc thiếu kiểm tra quyền này
- [ ] 3.2 Test với file Excel thật đã dùng trước đó (không phải file mẫu tự tạo) — **chưa làm**, cần Sếp cấp file mẫu hoặc credential để test runtime

## 4. GĐ4 — AI đọc phiếu (cấu hình)

- [x] 4.1 Quyết định: GIỮ NGUYÊN thuật toán Fernet (AES-128-CBC + HMAC-SHA256), cài lại bằng Node `crypto` thuần (`lib/crypto/fernet.ts`) — dùng chung `ENCRYPTION_KEY`, KHÔNG cần script migrate. Verify round-trip 2 chiều với Python `cryptography` thật (Python encrypt → Node decrypt, và ngược lại) — khớp 100%.
- [x] 4.2 Port `ai_config.py` (475 dòng) — `lib/data/ai-config.ts`, `lib/ai/providers.ts`, `lib/ai/safe-config.ts` + Route Handlers `/api/ai-config/*` (providers, list, get/post/put/delete theo CT, disable, enable, test-connection) + trang `thiet-lap-api`
- [ ] 4.3 (Không cần — quyết định giữ nguyên thuật toán ở 4.1)
- [ ] 4.4 Port `ai_routes.py` (412 dòng) — gọi Gemini/Claude/OpenAI đọc phiếu
- [ ] 4.5 Test đọc/ghi config + gọi AI thật theo từng công trình — cần Sếp cấp API key thật để test runtime (chưa test được, mới verify build tĩnh)

## 5. GĐ5 — Tách PDF bằng AI (rủi ro cao nhất — làm sau cùng)

- [ ] 5.1 Khảo sát `pdf-lib`/`pdfjs-dist` khả năng thay thế `pymupdf`/`pypdf` cho việc tách trang PDF
- [ ] 5.2 Viết lại thuật toán tách phiếu (298 dòng gốc `pdf_splitter.py`) — không dịch cơ học, thiết kế lại cho Node
- [ ] 5.3 Test đối chiếu output (số file tách, ranh giới trang, metadata phiếu nhận diện) với bản Python cũ trên nhiều mẫu PDF thật
- [ ] 5.4 Quyết định cùng Sếp: có giữ song song endpoint Python cũ tạm thời trong lúc kiểm chứng không (xem Open Question)
- [ ] 5.5 Chỉ cutover khi kết quả khớp bản cũ trên toàn bộ mẫu test

## 6. Cutover & Rollback

- [ ] 6.1 Merge `migrate-nextjs` → `main`, deploy production lên cùng project Vercel `khounice-web`
- [ ] 6.2 Copy `KHOCTR_FIREBASE_SERVICE_ACCOUNT` + các biến môi trường khác sang cấu hình Next.js
- [ ] 6.3 Smoke test toàn bộ luồng chính qua giao diện thật sau cutover
- [ ] 6.4 Giữ nhánh/code Python cũ (không xoá) tối thiểu vài tuần sau cutover để rollback nếu cần
