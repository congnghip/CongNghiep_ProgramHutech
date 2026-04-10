# Sidebar Collapse Design

## Mục tiêu

Thêm nút thu gọn/mở rộng cho sidebar trái của ứng dụng để người dùng có thể chuyển từ chế độ đầy đủ sang chế độ `icon-only`, giúp tăng diện tích nội dung mà vẫn giữ điều hướng nhanh.

## Phạm vi

- Chỉ thay đổi frontend ở shell app hiện tại, chủ yếu trong `public/js/app.js`, `public/css/styles.css`, và test giao diện liên quan.
- Không thay đổi API backend.
- Không thay đổi danh sách menu, quyền hiển thị menu, hay logic điều hướng hiện có.

## Hành vi mong muốn

- Sidebar có nút toggle ở phần đầu để chuyển giữa hai trạng thái:
  - `expanded`: hiển thị như hiện tại
  - `collapsed`: chỉ giữ icon menu
- Khi `collapsed`:
  - ẩn tên ứng dụng `HUTECH Program`
  - ẩn tiêu đề nhóm menu như `Đào tạo`, `Cài đặt`
  - ẩn text của từng menu item, chỉ còn icon
  - ẩn toàn bộ khối user actions ở cuối sidebar
- Khi rê chuột vào icon trong trạng thái `collapsed`, trình duyệt hiển thị tooltip tên menu tương ứng.
- Người dùng vẫn bấm icon để điều hướng như bình thường.
- Trạng thái sidebar được lưu vào `localStorage`, nên khi reload hoặc đăng nhập lại trên cùng trình duyệt, app sẽ khôi phục trạng thái gần nhất.
- Nếu chưa có trạng thái đã lưu trước đó, sidebar mặc định hiển thị ở chế độ `expanded`.

## Thiết kế kỹ thuật

### App state

- Bổ sung state `sidebarCollapsed` vào `window.App`.
- Đọc giá trị đã lưu từ `localStorage` trước khi render app shell.
- Thêm method để:
  - đổi trạng thái thu gọn/mở rộng
  - lưu trạng thái mới vào `localStorage`
  - render lại class hoặc attribute cần thiết cho layout

### Sidebar markup

- Trong `renderApp()`, thêm nút toggle vào `sidebar-header`.
- Sidebar root nhận thêm class hoặc attribute thể hiện trạng thái `collapsed`.
- Mỗi `nav-item` có nhãn tooltip ổn định từ tên menu render thực tế.
- Notification nav vẫn giữ badge unread, nhưng layout phải co lại phù hợp khi sidebar thu gọn.

### CSS layout

- Thêm biến độ rộng sidebar thu gọn, ví dụ `--sidebar-collapsed-w`.
- Sidebar và `main-content` dùng transition nhẹ cho `width`, `margin-left`, và căn chỉnh nội dung.
- Ở trạng thái `collapsed`:
  - icon trong `nav-item` được căn giữa
  - text label của nav item bị ẩn
  - section headings bị ẩn
  - phần header chỉ còn nút toggle và biểu tượng thương hiệu nếu cần
  - khối `.sidebar-user` bị ẩn hoàn toàn
- Tooltip dùng `title` mặc định của trình duyệt để tránh phải dựng thêm component tooltip riêng.

## Tương thích với logic hiện có

- Logic `navigate()` không đổi; chỉ phần trình bày của sidebar thay đổi.
- Các menu phụ thuộc quyền vẫn render theo logic hiện tại, nên tooltip phải bám vào item thực sự có mặt trong DOM.
- Notification drawer và các listener hiện có vẫn gắn trên cùng phần tử menu, không thay đổi API sự kiện.

## Xử lý lỗi và fallback

- Nếu `localStorage` không khả dụng hoặc đọc/ghi thất bại, app fallback về trạng thái mặc định `expanded` mà không chặn render.
- Nếu số unread lớn, badge vẫn hiển thị gọn trong collapsed mode và không ép sidebar nở rộng bất ngờ.

## Kiểm thử

- Thêm test giao diện để xác nhận bấm nút toggle làm sidebar chuyển giữa `expanded` và `collapsed`.
- Xác nhận `main-content` dịch theo đúng độ rộng sidebar mới.
- Xác nhận reload trang vẫn giữ trạng thái đã lưu.
- Xác nhận nav item ở collapsed mode vẫn click để điều hướng được.
- Kiểm tra notification badge và tooltip vẫn hoạt động ở collapsed mode.

## Ngoài phạm vi

- Không làm sidebar tự bung ra khi hover.
- Không thêm mode mobile drawer riêng trong thay đổi này.
- Không thiết kế tooltip tùy biến bằng JS/CSS nếu `title` mặc định đã đáp ứng nhu cầu.
