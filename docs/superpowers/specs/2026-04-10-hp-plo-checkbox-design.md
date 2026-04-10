# HP-PLO Checkbox Auto-Save Design

## Mục tiêu

Đổi riêng tab `Ma trận HP ↔ PLO` từ giao diện chọn mức đóng góp (`—`, `1`, `2`, `3`) sang giao diện checkbox nhị phân để người dùng chỉ chọn `áp dụng` hoặc `không áp dụng`.

## Phạm vi

- Chỉ áp dụng cho tab `HP ↔ PLO` trong trang chỉnh sửa phiên bản CTĐT.
- Không thay đổi UI hoặc hành vi của các tab `HP ↔ PI`, `PO ↔ PLO`, `CLO ↔ PLO`.
- Không thay đổi API backend hiện có cho `PUT /api/versions/:vId/course-plo-map`.

## Hành vi mong muốn

- Mỗi ô giao giữa học phần và PLO hiển thị một checkbox.
- Ô đã có mapping với `contribution_level > 0` được hiển thị là đã tích.
- Khi người dùng tích checkbox:
  - frontend gửi lại toàn bộ ma trận hiện tại qua API hiện có
  - ô được tích được lưu với `contribution_level = 1`
- Khi người dùng bỏ tích checkbox:
  - frontend gửi lại toàn bộ ma trận hiện tại qua API hiện có
  - mapping tương ứng bị loại khỏi payload để backend xóa khỏi bảng `course_plo_map`
- Trạng thái lưu hiển thị ngắn gọn như hiện tại: đang lưu, đã lưu, lỗi lưu.

## Tương thích dữ liệu cũ

- Dữ liệu cũ có `contribution_level = 2` hoặc `3` vẫn được xem là `đã áp dụng` khi render checkbox.
- Sau lần người dùng thao tác và auto-save, các mapping còn được giữ sẽ được chuẩn hóa về `contribution_level = 1`.

## Cập nhật giao diện

- Dòng hướng dẫn đổi từ `— = Không áp dụng · 1 = Thấp · 2 = TB · 3 = Cao`
  thành `Bỏ trống = Không áp dụng · Tích = Áp dụng`.
- Bỏ dropdown trong từng ô, thay bằng checkbox canh giữa.
- Khi tab ở chế độ không cho sửa, checkbox bị disabled nhưng vẫn phản ánh đúng dữ liệu.

## Lưu tự động

- Giữ cơ chế debounce ngắn hiện có để tránh gọi API quá dày khi người dùng thao tác liên tiếp.
- Sự kiện `change` trên checkbox kích hoạt auto-save ngay, không cần nút lưu riêng.

## Rủi ro và cách xử lý

- Nếu lưu thất bại, hiển thị toast lỗi như hành vi hiện tại và xóa trạng thái `Đang lưu...`.
- Vì backend đang ghi đè toàn bộ ma trận theo payload mới, frontend phải luôn xây lại đầy đủ danh sách các ô đang được tích trước khi gửi.
