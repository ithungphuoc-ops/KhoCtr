# HPCons Project Instructions // Chỉ dẫn dự án HPCons

## Quy tắc bắt buộc
Mọi giao diện phải tuân thủ HPCons Design System V1.1 (cập nhật 11/07/2026).

## Tài liệu phải đọc trước khi sửa giao diện
- Tổng quan: @README.md
- Nền tảng: @02-foundations/README.md
- Màu sắc: @02-foundations/colors.md
- Chữ: @02-foundations/typography.md
- Khoảng cách: @02-foundations/spacing.md
- Giao diện tối: @03-theme/dark-mode.md
- Tương thích thiết bị: @07-responsive/responsive-rules.md
- Quy tắc lập trình: @15-coding/README.md

## Luật giao diện
1. Hỗ trợ cả Light Mode và Dark Mode (Dark Mode là mặc định).
2. Màu chính (Primary — hành động chính, nút CTA, menu đang chọn): `#096AA7`.
3. Màu thành công (Success — hoàn thành, trạng thái tốt/ổn định): `#60BB46`. Không dùng Success cho hành động/nút bấm thông thường.
4. Thanh điều hướng: `#4B4F55`.
5. Không tạo màu mới nếu chưa bổ sung vào Design Token // biến thiết kế.
6. Không dùng khoảng cách tùy ý ngoài thang quy chuẩn.
7. Không dùng Inline Style // định dạng viết trực tiếp trong mã.
8. Không lặp lại thành phần đã có.
9. Mobile // điện thoại không ép bảng nhiều cột; chuyển sang Card List // danh sách dạng thẻ.
10. Vùng chạm trên điện thoại tối thiểu `44x44px`.
11. Mọi trạng thái phải có cả màu và chữ.
12. Trước khi viết mã phải nêu rõ tài liệu đã đọc.
13. Sau khi viết mã phải tự kiểm tra bằng checklist liên quan.

## Quy trình cho mỗi nhiệm vụ
1. Đọc tài liệu nền tảng.
2. Xác định thiết bị mục tiêu.
3. Đọc tài liệu thành phần.
4. Đọc Business Pattern // mẫu nghiệp vụ liên quan.
5. Tái sử dụng thành phần hiện có.
6. Chạy kiểm tra TypeScript, lint và build.
7. Báo cáo file đã sửa và điểm chưa chắc chắn.

## Không được làm
- Tự đổi màu thương hiệu.
- Tạo thêm thư viện giao diện khi chưa cần.
- Dùng emoji làm biểu tượng chức năng chính.
- Dùng bóng đổ mạnh.
- Dùng chữ nhỏ hơn 12px cho nội dung quan trọng.
- Ẩn nhãn trường nhập và chỉ dùng placeholder // chữ gợi ý.
