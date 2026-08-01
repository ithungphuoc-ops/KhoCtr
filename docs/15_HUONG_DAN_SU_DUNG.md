# Hướng dẫn sử dụng — KhoCtr

## 1. Đăng nhập

1. Truy cập **`khoct.hpcore.vn`** trên trình duyệt máy tính hoặc điện thoại.
2. Nếu chưa đăng nhập, hệ thống tự chuyển sang trang đăng nhập chung **`account.hpcore.vn`** — đăng nhập bằng tài khoản HPCore đang dùng cho các app khác của công ty (không có tài khoản riêng cho KhoCtr).
3. Đăng nhập xong, hệ thống tự đưa về lại `khoct.hpcore.vn`.
4. Nếu báo **"chưa được cấp quyền truy cập"** — liên hệ Admin để được gán quyền (xem mục 8 — Phân quyền).

**Cài ra màn hình chính điện thoại (không bắt buộc)**:
- Android (Chrome): menu `⋮` → "Cài đặt ứng dụng" / "Thêm vào Màn hình chính".
- iPhone (Safari): nút Share → "Thêm vào MH chính".

## 2. Giao diện chung

- **Sidebar bên trái**: menu điều hướng, chia 3 nhóm — Tổng quan, Quản lý dữ liệu, Hệ thống.
- **Thanh trên cùng**: bộ lọc ngày (áp dụng cho Báo cáo/Phiếu nhập-xuất), nút xuất Excel theo trang đang xem, chuông cảnh báo tồn kho thấp, nút chuyển Dark/Light mode, thông tin tài khoản.
- **Chọn công trình**: Admin thấy khung chọn công trình (lọc dữ liệu theo công trình đang chọn, hoặc để trống để xem tất cả); User chỉ thấy đúng công trình mình được gán, không cần chọn.

## 3. Quản lý Công trình *(chủ yếu Admin)*

Menu **Công trình**:
- **Tạo công trình mới**: bấm "Thêm công trình", nhập mã công trình, tên, địa chỉ.
- **Sửa/xoá**: bấm icon tương ứng trên từng dòng.
- ⚠️ **Xoá công trình sẽ xoá vĩnh viễn toàn bộ phiếu, chi tiết phiếu và danh mục hàng hoá thuộc công trình đó** — hệ thống hiện số liệu cụ thể (số phiếu/hàng hoá) trước khi xác nhận, đọc kỹ trước khi bấm xoá.

## 4. Danh mục hàng hóa

Menu **Danh mục hàng hóa** — quản lý danh sách vật tư của công trình đang chọn: mã hàng, tên hàng, đơn vị tính. Đây là danh sách "chuẩn" — khi tạo phiếu nhập/xuất, tên hàng phải khớp với danh mục này (gõ tên sẽ có gợi ý chọn).

## 5. Tạo Phiếu nhập kho / Phiếu xuất kho

Menu **Nhập kho** hoặc **Xuất kho** → bấm **"Tạo phiếu NK/XK"**.

**Cách 1 — Nhập tay**: điền số phiếu, ngày, nhà cung cấp/đối tác, thêm từng dòng hàng hoá (chọn từ danh mục gợi ý, nhập số lượng + đơn giá) → Lưu.

**Cách 2 — AI đọc phiếu tự động**: chọn tab "Đọc bảng AI" → chọn nhà cung cấp AI (Gemini/ChatGPT/Claude) → kéo thả hoặc chọn ảnh chụp/PDF phiếu giấy → bấm "Đọc và điền form tự động" → AI tự điền số phiếu, ngày, đối tác, danh sách hàng hoá — kiểm tra lại rồi Lưu. Với file PDF nhiều phiếu, AI tách và xử lý lần lượt từng phiếu.

**Sửa/Xoá phiếu**: bấm icon bút chì/thùng rác ở cột "Chi tiết" trong bảng danh sách.

## 6. Ảnh chứng từ nhập kho

Trong popup "Chi tiết" của 1 phiếu (bấm icon con mắt 👁) → kéo/chọn ảnh (JPG/PNG, tối đa 15MB — hệ thống tự nén, không cần tự nén trước) vào khu vực **"Ảnh chứng từ nhập kho"**.

- Upload được **nhiều ảnh** cho 1 phiếu.
- Ảnh đã upload hiện ngay trong bảng danh sách ở cột **"Hình ảnh"** dạng link "Ảnh 1", "Ảnh 2"... — bấm để xem/tải về.
- Bấm vào ảnh nhỏ trong popup để xem lớn; bấm dấu X để xoá ảnh.

## 7. Tồn kho, Báo cáo, Lịch sử giao dịch

- **Tồn kho**: tự động tính = tổng nhập − tổng xuất theo từng mặt hàng, không cần nhập tay.
- **Báo cáo**: số liệu tổng hợp + biểu đồ theo tháng — nút "Xuất Excel" ở đầu trang để tải báo cáo.
- **Lịch sử GD**: tra cứu toàn bộ lịch sử nhập/xuất của 1 mặt hàng cụ thể qua thời gian.
- **Cảnh báo**: danh sách mặt hàng tồn dưới ngưỡng thấp (mặc định ≤20) — có chuông báo ở thanh trên cùng.

## 8. Phân quyền *(chỉ Admin)*

Menu **Phân quyền** — gán công trình cho từng user (thủ kho):
- Danh sách user tự xuất hiện sau lần đầu người đó đăng nhập (không cần tạo tài khoản tay).
- Chọn user → tick chọn công trình được phép truy cập → Lưu. User đó chỉ thấy đúng (các) công trình được gán khi đăng nhập lại.
- Vai trò Admin/User được đồng bộ từ hệ thống phân quyền chung HPCore — muốn đổi ai thành Admin của KhoCtr, liên hệ quản trị viên HPCore (`account.hpcore.vn`), không đổi được trong trang này.

## 9. Ghi chú công việc

Menu **Ghi chú công việc** — tạo việc cần làm, đặt deadline, mức ưu tiên, xem dạng danh sách hoặc bảng Kanban theo trạng thái. Đánh dấu hoàn thành khi xong.

## 10. Thiết lập API AI *(chỉ Admin)*

Menu **Thiết lập API AI** — mỗi công trình có thể dùng chung key AI mặc định của công ty, hoặc cấu hình **API key riêng** (Gemini/Claude/ChatGPT) nếu công trình đó cần dùng tài khoản AI riêng. Có nút "Test kết nối" để kiểm tra key đã nhập đúng chưa trước khi lưu.

## 11. Nhật ký hoạt động *(chỉ Admin)*

Menu **Nhật ký HĐ** — xem log mọi thao tác tạo/sửa/xoá trong toàn hệ thống (ai làm gì, lúc nào), dùng để tra soát khi có sai lệch số liệu.

## 12. Nhập dữ liệu Excel

Menu **Import dữ liệu** *(trong màn hình theo từng công trình)* — tải lên file Excel để nhập hàng loạt dữ liệu (thay vì tạo tay từng phiếu), có bước xem trước dữ liệu trước khi xác nhận nhập.

## Câu hỏi thường gặp

**Đăng nhập được nhưng báo "chưa được cấp quyền"?**
→ Tài khoản HPCore hợp lệ nhưng chưa được admin KhoCtr gán quyền/công trình — liên hệ Admin để gán qua trang Phân quyền.

**Tạo phiếu báo lỗi "không có trong danh mục"?**
→ Tên hàng nhập không khớp danh mục hàng hóa của công trình — vào Danh mục hàng hóa thêm mặt hàng đó trước, hoặc chọn đúng tên có sẵn trong gợi ý.

**Upload ảnh báo lỗi?**
→ Kiểm tra định dạng phải là JPG/PNG và dưới 15MB. Nếu vẫn lỗi, báo lại đội kỹ thuật kèm ảnh chụp lỗi cụ thể.

**AI đọc phiếu sai thông tin?**
→ Vẫn cần kiểm tra lại số liệu AI điền trước khi Lưu — AI hỗ trợ đọc nhanh, không thay thế hoàn toàn việc kiểm tra tay, đặc biệt với phiếu viết tay chữ khó đọc.
