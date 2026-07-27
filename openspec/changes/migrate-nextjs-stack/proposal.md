## Why

KhoCtr (`khoct.hpcore.vn`) hiện là **app cuối cùng trong workspace HP Cons còn chạy Python FastAPI + React/Vite** — mọi app khác (hpcons-portal, ITAsset, pkd_crm-next, hpcons-quatang, HPcons-booking) đã ở Next.js (App Router) + TypeScript. Bản thân tài liệu quy chuẩn của chính repo này (`README.md`, `CLAUDE.md` — HPCons Design System) đã ghi rõ "Công nghệ ưu tiên: Next.js, React, TypeScript..." từ trước — nghĩa là code thực tế đang lệch với chuẩn công ty đã định, không phải một ý tưởng mới.

Lý do đổi là **đồng nhất hạ tầng** (giống lý do Sếp từng quyết định đổi Supabase→Firebase cho toàn workspace, xem `[[project_supabase_to_firebase_migration]]`), không phải vì lỗi kỹ thuật hay hiệu năng — app đang chạy ổn định trên Python/Vite sau đợt vá hiệu năng 2026-07-27 (xem `openspec/changes/migrate-vercel-firebase`).

Đây là **hệ thống production thật**, có thủ kho dùng hàng ngày (nhập/xuất phiếu, tra tồn kho). Database (Firestore, project `hpcons-khoctr`) đã ổn định từ đợt migrate 2026-07-14 và **không đổi lại lần nữa** ở change này — chỉ đổi ngôn ngữ/framework của tầng code (Python→TypeScript, FastAPI→Next.js API/Server Actions, React Router/Vite→Next.js App Router).

## What Changes

- **Backend**: 12 router FastAPI (`api/routers/*.py`, ~2.781 dòng) + `firestore_client.py` (851 dòng, tầng data-access) + `mapping_service.py`, `pdf_splitter.py`, `hpcore_auth.py`, `ai_routes.py`/`ai_config.py` → viết lại bằng TypeScript, chạy như Next.js Route Handlers / Server Actions trên cùng 1 Vercel project.
- **Frontend**: 25 trang React/Vite (`frontend/src/pages/**`, ~12.604 dòng JSX, dùng `react-router-dom`) → Next.js App Router, giữ nguyên UI/UX nhìn thấy được (không redesign).
- **Auth**: port nguyên pattern SSO `account.hpcore.vn` (session cookie + Firebase Admin `verifySessionCookie`) đã có sẵn ở 4 app khác trong workspace — **không viết mới từ đầu**, copy-adapt.
- **Data layer**: viết `lib/firestore/*.ts` port từ `firestore_client.py` (bao gồm fix hiệu năng vừa vá 2026-07-27: prefilter native query + Python/JS filter phần còn lại, cache TTL riêng theo bảng) — giữ nguyên tên collection/field snake_case, **không** đổi cấu trúc dữ liệu Firestore đang có.
- **Tách PDF phiếu bằng AI** (`pdf_splitter.py`, dùng `pymupdf`/`pypdf`): viết lại bằng `pdf-lib`/`pdfjs-dist` (Node không có PyMuPDF) — đây là phần **rủi ro cao nhất**, làm sau cùng, sau khi các phần còn lại đã ổn định.
- **Import Excel** (`openpyxl`) → `exceljs`/`xlsx` (Node).
- **Deploy**: giữ cùng 1 Vercel project (`khounice-web`) và domain `khoct.hpcore.vn` — chỉ đổi build/runtime từ Python+Vite sang Next.js, giống cách Bước 1 của đợt migrate Firestore trước đã gộp hosting.

## Capabilities

### New Capabilities
- `nextjs-data-layer`: Yêu cầu về tầng truy cập Firestore bằng TypeScript trên Next.js (Route Handlers/Server Actions), thay thế `firestore_client.py` — giữ đúng hành vi (bao gồm tối ưu hiệu năng đã vá) và không đổi cấu trúc dữ liệu.
- `nextjs-app-frontend`: Yêu cầu về việc chuyển 25 trang React Router/Vite sang Next.js App Router — giữ nguyên UI/UX và luồng thao tác cho người dùng cuối.

### Modified Capabilities
- `vercel-serverless-backend` (từ `migrate-vercel-firebase`): runtime đổi từ Python sang Node.js/TypeScript trên cùng Vercel project — các yêu cầu về giới hạn timeout/dung lượng vẫn áp dụng nhưng tính toán lại theo runtime Node.

## Impact

- Toàn bộ `api/` (Python, ~5.768 dòng) và `frontend/` (React/Vite, ~12.604 dòng) bị thay thế.
- Không đổi dữ liệu Firestore (project `hpcons-khoctr`) — chỉ đổi code đọc/ghi.
- Cần copy `KHOCTR_FIREBASE_SERVICE_ACCOUNT` và các biến môi trường khác sang cấu hình Next.js (giữ nguyên giá trị, đổi cách đọc nếu cần).
- Giữ code Python/Vite cũ trên nhánh riêng (`main` hiện tại) tối thiểu vài tuần sau cutover để rollback — tương tự cách giữ Supabase read-only ở đợt migrate trước.
- Người dùng cuối (thủ kho, admin) không thấy thay đổi UI/UX — chỉ đổi hạ tầng chạy phía sau.
