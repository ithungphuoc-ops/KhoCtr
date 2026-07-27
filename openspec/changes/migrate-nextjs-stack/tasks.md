## 0. Setup

- [x] 0.1 Tạo nhánh riêng `migrate-nextjs` cho toàn bộ công việc (không đụng `main`)
- [x] 0.2 Ghi nhận phạm vi + rủi ro vào OpenSpec (proposal.md, design.md, specs/, tasks.md — file này)
- [ ] 0.3 Xác nhận gói Vercel Hobby/Pro (ảnh hưởng timeout GĐ4/GĐ5)

## 1. GĐ1 — Nền tảng (data layer + auth)

- [x] 1.1 Scaffold Next.js 15 App Router + TypeScript + Tailwind trong `web/` (khớp stack `hpcons-quatang`/`pkd_crm-next`) — build + type-check sạch
- [x] 1.2 Copy pattern SSO từ `hpcons-quatang` (`web/lib/hpcore.ts`, `web/lib/session.ts`) — adapt `HPCORE_APP_ID = "warehouse"`, đọc `app_permissions/{uid}.warehouse`, port nguyên `get_current_user()` (đồng bộ `app_users`, giữ `uid` = id nội bộ)
- [x] 1.3 Viết `web/lib/firestore/client.ts` — port `_try_native_query`, `_native_prefilter`, `_row_matches`, cache TTL riêng theo bảng từ `api/firestore_client.py` (bản đã vá 2026-07-27, KHÔNG port bản gốc chưa vá)
- [ ] 1.4 Port các hàm nghiệp vụ tầng data layer: `getAllCongTrinh`, `getPhieuList`, `getAllHangHoa`, `computeTonKho`, `getActivityLog`, `getGhiChuList`, `getAiConfig` (để dùng dần khi port từng trang ở GĐ2)
- [x] 1.5 `web/vercel.json`: `regions: ["sin1"]` ngay từ đầu (không lặp lại lỗi lệch vùng miền)
- [x] 1.6 Layout/menu chung (AppShell) — port `Sidebar`, `Header` (rút gọn, chưa nối date-range/xuất Excel/số cảnh báo — phụ thuộc data layer GĐ2), `AppLauncher` (port nguyên, tự chứa), design tokens V1.1 (`globals.css`, đúng màu/dark-mode theo `CLAUDE.md`). Phân biệt đúng 2 trường hợp không có phiên (401 redirect / 403 hiện thông báo tại chỗ, không redirect vòng lặp) — khớp `PrivateRoute` cũ. Build + type-check + lint sạch.
- [ ] 1.7 Deploy Preview (project Vercel riêng hoặc nhánh của `khounice-web` — cần quyết định), xác nhận đăng nhập SSO thật + đọc thử 1 collection. **Đang chặn**: cần Sếp cấp `HPCORE_FIREBASE_SERVICE_ACCOUNT`/`KHOCTR_FIREBASE_SERVICE_ACCOUNT` vào `web/.env.local` để test cục bộ trước — chưa test runtime thật với credential thật, mới chỉ verify qua build tĩnh.

## 2. GĐ2 — Trang CRUD thường (thứ tự đề xuất theo tần suất dùng — cần Sếp xác nhận)

- [ ] 2.1 Dashboard
- [ ] 2.2 Công trình (CRUD + cascade delete + stats)
- [ ] 2.3 Danh mục hàng hóa (`DanhMuc.jsx`, `ct/CTDanhMuc.jsx`)
- [ ] 2.4 Phiếu nhập (`PhieuNhap.jsx`, `ct/CTNhapKho.jsx`)
- [ ] 2.5 Phiếu xuất (`PhieuXuat.jsx`, `ct/CTXuatKho.jsx`)
- [ ] 2.6 Tồn kho (`TonKho.jsx`, `ct/CTTonKho.jsx`)
- [ ] 2.7 Báo cáo (`BaoCao.jsx`) — bao gồm biểu đồ (chart.js → giữ nguyên hoặc tương đương React)
- [ ] 2.8 Ghi chú công việc (`GhiChu.jsx`, soft-delete)
- [ ] 2.9 Nhật ký hoạt động (`NhatKy.jsx`)
- [ ] 2.10 Phân quyền (`PhanQuyen.jsx`)
- [ ] 2.11 Lịch sử giao dịch (`LichSuGiaoDich.jsx`)
- [ ] 2.12 Cảnh báo (`CanhBao.jsx`)
- [ ] 2.13 Nhà cung cấp (`NhaCungCap.jsx`)
- [ ] 2.14 Cài đặt (`CaiDat.jsx`)
- [ ] 2.15 Mỗi trang: test qua giao diện thật (click tay) trước khi sang trang kế, không chỉ dựa vào build sạch

## 3. GĐ3 — Import Excel

- [ ] 3.1 Port `import_data.py` (`openpyxl`) → `exceljs`/`xlsx`
- [ ] 3.2 Test với file Excel thật đã dùng trước đó (không phải file mẫu tự tạo)

## 4. GĐ4 — AI đọc phiếu (cấu hình)

- [ ] 4.1 Quyết định cùng Sếp: giữ thuật toán mã hoá tương đương (AES-GCM) hay đổi hẳn — xem Open Question trong design.md
- [ ] 4.2 Port `ai_config.py` (475 dòng) — cấu hình + mã hoá API key theo công trình
- [ ] 4.3 Nếu đổi thuật toán mã hoá: viết script giải mã ciphertext cũ (Python) + mã hoá lại (Node) 1 lần, verify giải mã đúng trước khi xoá bản cũ
- [ ] 4.4 Port `ai_routes.py` (412 dòng) — gọi Gemini/Claude
- [ ] 4.5 Test đọc/ghi config + gọi AI thật theo từng công trình

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
