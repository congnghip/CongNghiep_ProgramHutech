# Main Content Width Expansion Design

## Mục tiêu

Nới bề ngang vùng nội dung chính của ứng dụng để các trang desktop, đặc biệt là `version-editor`, có thêm không gian ngang cho form, tab, bảng và khu vực chỉnh sửa.

## Phạm vi

- Chỉ thay đổi layout chung của vùng nội dung chính trong `public/css/styles.css`.
- Áp dụng cho toàn bộ trang dùng `.main-content`.
- Không thay đổi riêng từng page module như `dashboard`, `programs`, `version-editor`, `courses`, `rbac-admin`.
- Không thay đổi các modal hoặc thành phần đã có `max-width` cục bộ riêng.

## Hành vi mong muốn

- Vùng nội dung chính rộng hơn đáng kể trên desktop.
- Cảm giác bố cục vẫn có lề hai bên, không chuyển sang full-width hoàn toàn.
- Sidebar mở hoặc thu gọn vẫn giữ căn lề đúng cho phần nội dung.
- Các trang hiện có không bị thay đổi cấu trúc, chỉ được nới không gian ngang khả dụng.

## Thiết kế kỹ thuật

### Layout chung

- Điều chỉnh `.main-content` trong `public/css/styles.css`.
- Giảm `padding` ngang từ `48px` xuống khoảng `32px` để bớt hao không gian mép trái/phải.
- Tăng `max-width` từ `1100px` lên khoảng `1440px`.
- Giữ nguyên:
  - `margin-left: var(--sidebar-w)`
  - `.layout.sidebar-collapsed .main-content { margin-left: var(--sidebar-collapsed-w); }`

### Tác động mong đợi

- `version-editor` có nhiều không gian hơn cho breadcrumb, thanh tab, banner trạng thái và form thông tin.
- Các trang danh sách hoặc quản trị cũng có thêm chiều ngang để bảng và toolbar bớt chật.
- Những khối tự giới hạn bề rộng bằng `max-width` riêng vẫn giữ nguyên, nên thay đổi tập trung ở khung ngoài thay vì từng thành phần con.

## Rủi ro và cách xử lý

- Nếu một số trang đang dựa vào khoảng trắng lớn hai bên để tạo cảm giác thoáng, việc tăng `max-width` có thể làm bố cục đậm đặc hơn. Việc giữ lại `padding: 32px` giúp hạn chế rủi ro này.
- Nếu có thành phần con dùng chiều rộng phần trăm hoặc flex theo vùng chứa, nó sẽ giãn theo chiều ngang mới. Điều này là chủ đích, nhưng cần kiểm tra nhanh các trang chính sau khi đổi.
- Sidebar collapse đã được thêm gần đây, nên cần giữ nguyên logic `margin-left` để tránh lệch layout khi đổi trạng thái sidebar.

## Kiểm thử

- Kiểm tra trực quan các trang đại diện:
  - `dashboard`
  - `programs`
  - `version-editor`
  - `rbac-admin`
- Kiểm tra ở cả hai trạng thái sidebar:
  - mở rộng
  - thu gọn
- Xác nhận `version-editor` hiển thị thoáng hơn ở desktop mà không tràn mép.
- Xác nhận modal, hộp thoại và các input có `max-width` riêng không bị thay đổi ngoài ý muốn.

## Ngoài phạm vi

- Không tinh chỉnh spacing riêng cho từng page.
- Không làm responsive/mobile redesign trong thay đổi này.
- Không thay đổi component con như tab bar, form row, table cell, hoặc modal width.
