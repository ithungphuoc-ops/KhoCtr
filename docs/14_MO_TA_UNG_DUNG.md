# Mô tả ứng dụng — KhoCtr (KhoUNICE Web)

## Ứng dụng là gì

**KhoCtr** là hệ thống quản lý kho vật liệu xây dựng của **HP Cons Việt Nam**, dùng để theo dõi nhập/xuất/tồn kho vật tư theo từng công trình xây dựng. Truy cập tại **`https://khoct.hpcore.vn`**, đăng nhập chung bằng tài khoản HPCore (SSO) — không có tài khoản/mật khẩu riêng.

Ứng dụng chạy như 1 "app con" trong hệ sinh thái phần mềm nội bộ HPCons (cùng nhóm với ITAsset, PKD, hpcons-quatang...), và có thể cài ra màn hình chính điện thoại để dùng như 1 app thật (PWA).

## Hạ tầng công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện + Backend | Next.js 15 (App Router) + TypeScript, chạy trên Vercel |
| Cơ sở dữ liệu | Firebase Firestore (project `hpcons-khoctr`) |
| Lưu ảnh chứng từ | Cloudflare R2 (bucket `hpcons-khoctr`), tự nén ảnh khi upload |
| Đăng nhập | SSO qua `account.hpcore.vn` (Firebase Auth của HPCore, project `hpcons-portal`) |
| AI đọc phiếu | Gemini / Claude / ChatGPT (chọn được theo công trình) |
| Mã nguồn | GitHub — `ithungphuoc-ops/KhoCtr` |

## Vai trò người dùng

- **Admin**: thấy và thao tác được trên **toàn bộ công trình** của công ty, quản lý phân quyền, cấu hình AI, xem nhật ký hoạt động toàn hệ thống.
- **User (thủ kho)**: chỉ thấy và thao tác trên **công trình được admin gán** (qua trang Phân quyền) — không thấy dữ liệu công trình khác.

Vai trò được đồng bộ tự động từ hệ thống phân quyền chung của HPCore (`app_permissions`) khi đăng nhập lần đầu, không cấu hình riêng trong KhoCtr.

## Các module chính

| Module | Mô tả |
|---|---|
| **Dashboard** | Tổng quan số liệu — tổng phiếu, tổng giá trị nhập/xuất, biểu đồ theo tháng |
| **Công trình** | Tạo/sửa/xoá công trình xây dựng, xem thống kê số phiếu/hàng hoá từng công trình |
| **Danh mục hàng hóa** | Danh sách vật tư quản lý theo từng công trình (mã hàng, tên hàng, đơn vị tính) |
| **Phiếu nhập kho / Phiếu xuất kho** | Tạo phiếu thủ công hoặc **AI tự đọc** ảnh/PDF phiếu giấy để điền tự động; upload nhiều **ảnh chứng từ** đính kèm mỗi phiếu (tự nén, lưu Cloudflare R2, gom theo từng công trình) |
| **Tồn kho** | Tồn kho tính tự động (tổng nhập trừ tổng xuất) theo từng mặt hàng/công trình |
| **Báo cáo** | Báo cáo tổng hợp, biểu đồ theo tháng, xuất Excel |
| **Lịch sử giao dịch** | Tra cứu toàn bộ lịch sử nhập/xuất theo mặt hàng |
| **Cảnh báo** | Cảnh báo tồn kho thấp (dưới ngưỡng) |
| **Ghi chú công việc** | Quản lý công việc dạng Kanban/danh sách, có deadline, mức ưu tiên |
| **Nhật ký hoạt động** *(chỉ Admin)* | Log toàn bộ thao tác tạo/sửa/xoá trong hệ thống |
| **Phân quyền** | Gán công trình cho từng user (thủ kho) |
| **Thiết lập API AI** *(chỉ Admin)* | Cấu hình API key AI (Gemini/Claude/ChatGPT) riêng theo từng công trình |
| **Import dữ liệu** | Nhập dữ liệu hàng loạt từ file Excel |

## 2 giao diện

- **App Tổng** (`khoct.hpcore.vn/...`): giao diện chính, hiển thị dữ liệu theo công trình đang chọn (admin chọn được mọi công trình qua bộ lọc, user tự động khoá theo công trình được gán).
- **App theo Công trình** (`khoct.hpcore.vn/ct/[id]/...`): giao diện gọn hơn, tập trung thao tác nhanh cho 1 công trình cụ thể — vào bằng cách chọn 1 công trình từ Dashboard/trang Công trình.
