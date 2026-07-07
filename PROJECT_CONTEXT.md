# PROJECT_CONTEXT.md — Hệ thống Quản lý Kho HPCons (KhoUNICE Web)

> File tóm tắt bối cảnh dự án để AI/dev mới nắm nhanh. Cập nhật lần cuối: 06/07/2026.

## 1. Tổng quan

Web app quản lý kho công trình cho **HP Cons** (người dùng chính: anh Phước — nguyenhuuphuoc@hpcons.com.vn, xưng hô "Sếp", giao tiếp tiếng Việt).

Kiến trúc đã chốt: **1 web app duy nhất trên cloud**, phân quyền theo công trình, KHÔNG làm đồng bộ offline. Gồm 2 khu vực:

- **App Tổng** (`/`): dashboard báo cáo tổng hợp, quản lý phiếu nhập/xuất, tồn kho, danh mục hàng, công trình, người dùng, phân quyền, nhật ký. Admin dùng.
- **Trang công trình** (`/ct/:id`): nhập kho, xuất kho, tồn kho, danh mục — nhân viên thủ kho dùng, khóa theo công trình được phân quyền.

Chỉ 2 vai trò: **admin** (toàn quyền) và **user = NV thủ kho** (chỉ thấy CT của mình qua bảng `user_congtrinh`).

## 2. Tech stack

| Phần | Công nghệ |
|---|---|
| Backend | Python FastAPI (`backend/`), gọi Supabase qua REST (urllib thuần, `supabase_client.py`) |
| Database | Supabase PostgreSQL cloud — bảng: `cong_trinh`, `phieu`, `chi_tiet_phieu`, `hang_hoa`, `app_users`, `user_congtrinh`, `activity_log`, view `v_ton_kho` |
| Frontend | React + Vite + Tailwind (`frontend/`), axios, react-router, chart.js, lucide-react |
| Auth | JWT tự chế (HMAC-SHA256, `routers/auth.py`), password PBKDF2 |
| AI đọc phiếu | **Claude Sonnet 4-6** + **Gemini 1.5 Flash** (cả 2 đã tích hợp), key trong `backend/.env` |
| Chạy local | `CHAY_WEB_APP.bat` — pip/npm install, build frontend, uvicorn port 8000 |
| Deploy | `render.yaml` sẵn cho Render.com; GitHub: `nguyenhuuphuoc-dotcom/Kho-Tong` |

## 3. Điểm kiến trúc quan trọng

- **Tồn kho KHÔNG phải bảng riêng** — là view `v_ton_kho` tính từ phiếu (tổng nhập − tổng xuất). Muốn sửa tồn phải tạo phiếu.
- Mọi dữ liệu gắn `cong_trinh_id`. Sidebar chọn CT → context `CongTrinhContext` (`selectedCT`, `ctLoading`).
- Giá trị logic KHÔNG được đổi: `'NK'`, `'XK'`, `'admin'`, `'user'`, `'manual'`, `'ai'`, modal type `'them'/'sua'/'xoa'`.
- `effectiveCTId` pattern: `isAdmin ? selectedCT?.id : congTrinhs[0]?.id` — dùng ở mọi trang CT.

## 4. Cấu hình AI (`backend/.env` + `backend/config.py`)

```
CLAUDE_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-1.5-flash   ← đọc từ đây, KHÔNG hard-code
JWT_SECRET=[REDACTED-ROTATED]
SETUP_KEY=HPCONS_SETUP_2026
```

- `config.py` dùng `load_dotenv(dotenv_path=explicit_path, override=True)` — bắt buộc để tránh env system override.
- `get_settings()` có `@lru_cache(maxsize=1)` → chỉ load 1 lần, cần **restart backend** khi sửa `.env`.
- Khi khởi động backend sẽ log: `[config] GEMINI_API_KEY: SET (AQ.Ab8...)`, `[config] GEMINI_MODEL: gemini-1.5-flash`.
- Key Gemini dạng `AQ.Ab8...` là hợp lệ (đã xác nhận Google trả về 429 chứ không 401/403).
- `gemini-2.0-flash-lite` quota = 0 trên key này → dùng `gemini-1.5-flash`.

### AI flow (`backend/ai_reader.py` + `backend/routers/ai_routes.py`)

```
Upload file → ai_routes.py → _resolve_api_key() → ai_reader.doc_phieu(provider, model)
                                                        ↓                    ↓
                                                   _claude()           _gemini()
                                              PyMuPDF render 3x PNG   base64 file gốc
                                              → Claude API            → Gemini REST API
```

- PDF → `fitz` render từng trang 3x scale → PNG base64 → gửi Claude (chất lượng cao hơn).
- Gemini: gửi file gốc base64 trực tiếp (không dùng SDK, gọi REST thẳng).
- HTTP 429 → log `HET QUOTA Gemini` + raise message thân thiện cho user.
- Bug đã fix 06/07: `_gemini_multi` thiếu dòng `url = ...` (sẽ crash nếu dùng Gemini multi-phiếu).

### AI endpoints

| Endpoint | Mô tả |
|---|---|
| `POST /api/ai/doc-phieu` | Đọc 1 phiếu từ file ảnh/PDF |
| `POST /api/ai/doc-phieu-multi` | Đọc nhiều phiếu từ 1 PDF |
| `GET /api/ai/test-gemini` | Test kết nối Gemini (key hiện tại) |
| `GET /api/ai/models` | Xem model đang cấu hình + trạng thái key |
| `GET /api/ai/health` | Test thực Gemini với model trong `.env`, phân biệt ok/quota_exceeded/error |

### UI provider toggle (frontend)

4 trang đã có toggle chọn Claude hoặc Gemini: `PhieuNhap.jsx`, `PhieuXuat.jsx`, `AIReader.jsx`, `CTAIReader.jsx`.
- Default: **Gemini** (miễn phí).
- FormData field: `provider=gemini|claude`.
- Badge kết quả hiển thị provider đã dùng.

## 5. Xóa công trình — cascade delete (`backend/routers/cong_trinh.py`)

Đã implement đúng thứ tự: `chi_tiet_phieu` → `phieu` → `hang_hoa` → `cong_trinh`.

- `GET /{id}/stats` → trả về counts (phieu, hang_hoa, chi_tiet_phieu) để hiển thị trước khi xóa.
- `DELETE /{id}` → cascade delete đầy đủ (chunk 100 id khi xóa chi_tiet_phieu).
- Frontend `CongTrinh.jsx`: modal xác nhận thay `window.confirm`, hiện số lượng dữ liệu sẽ mất, cảnh báo "không thể khôi phục".

## 6. Tính năng CRUD tồn kho (`backend/routers/ton_kho.py`)

- `POST /api/ton-kho/them-hang` → tạo phiếu NK mã `TD-...`
- `POST /api/ton-kho/dieu-chinh` → phiếu `DC-...` (NK nếu tăng, XK nếu giảm — giữ lịch sử)
- `DELETE /api/ton-kho/xoa-hang` → xóa toàn bộ chi tiết phiếu của hàng trong CT

## 7. Lịch sử theo ngày

| Ngày | Việc đã làm |
|---|---|
| 02-03/07 | Sửa race condition ctLoading, filter hàng hóa theo CT, autocomplete tên hàng, phân trang >1000 rows PostgREST, sessionStorage thay localStorage |
| 03-04/07 | CRUD tồn kho (them-hang, dieu-chinh, xoa-hang) + thêm dấu tiếng Việt toàn bộ UI (một phần) |
| 04/07 | Cascade delete công trình (stats endpoint + modal xác nhận có đếm dữ liệu) |
| 05/07 | Tích hợp Gemini: thêm key vào .env, UI toggle 4 trang, debug key/model, đổi sang gemini-1.5-flash |
| 06/07 | Chuẩn hóa Gemini config: GEMINI_MODEL đọc từ .env, log khởi động, log 429 rõ ràng, endpoints /models + /health, fix bug _gemini_multi thiếu url |

## 8. Việc tiếp theo (thứ tự ưu tiên)

1. **Test AI hoàn chỉnh**: upload phiếu nhập kho thật → thử cả Gemini và Claude → so sánh kết quả.
2. **Hoàn tất thêm dấu tiếng Việt** cho các file còn lại: `CTXuatKho.jsx`, `CTDanhMuc.jsx`, `CTImportData.jsx`, `BaoCao.jsx`, `AIReader.jsx`, `CongTrinh.jsx`, `ImportData.jsx`, `DanhMuc.jsx`, `CanhBao.jsx`, `NhatKy.jsx`, `PhanQuyen.jsx`, `NguoiDung.jsx`, `PhieuNhap.jsx`, `PhieuXuat.jsx`, `NhaCungCap.jsx`, `CaiDat.jsx`, `App.jsx`.
3. **Push GitHub**: chạy `COMMIT_AND_PUSH.bat` trên Windows CMD (KHÔNG dùng sandbox bash).
4. **Deploy Render.com**: New Web Service → connect repo → điền env vars (`SUPABASE_URL`, `SUPABASE_KEY`, `CLAUDE_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `JWT_SECRET`, `SETUP_KEY`).
5. **Test web thật** cùng Sếp.

## 9. Lưu ý kỹ thuật cho AI session sau

- **Git operations**: PHẢI chạy từ Windows CMD qua `.bat`, KHÔNG từ sandbox bash (null bytes làm hỏng file).
- **Mount sandbox không tin được với file vừa sửa**: file sửa qua Write/Edit hiển thị bị cắt cụt trong `/sessions/.../mnt/KhoUNICE_Web`. File gốc đọc qua tool Read luôn đúng. File MỚI tạo thì sync bình thường.
- Sandbox bị chặn kết nối Supabase (403) → không test API với DB thật, chỉ kiểm tra syntax + build.
- `get_settings()` có `@lru_cache` → phải **restart backend** sau khi sửa `.env`.
- Xóa file trên máy Sếp: phải gọi tool `allow_cowork_file_delete` trước.
- `.gitignore` đã chặn `backend/.env` (chứa secrets) — không commit lên GitHub.
- Quy tắc sửa UI: CHỈ sửa chuỗi hiển thị (JSX text, placeholder, label, thông báo lỗi). KHÔNG đổi key logic, tên biến, className, route, API path, giá trị `'NK'/'XK'/'admin'/'user'` v.v.
