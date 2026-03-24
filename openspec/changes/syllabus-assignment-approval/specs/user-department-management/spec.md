## ADDED Requirements

### Requirement: Người dùng được gán vào đơn vị
Hệ thống PHẢI cho phép gán mỗi người dùng vào một đơn vị (Ngành hoặc Khoa) cụ thể thông qua thuộc tính `department_id`.

#### Scenario: Gán đơn vị cho người dùng mới
- **WHEN** Quản trị viên tạo người dùng mới và chọn đơn vị từ danh sách
- **THEN** Hệ thống lưu trữ `department_id` tương ứng vào thông tin người dùng

#### Scenario: Cập nhật đơn vị cho người dùng hiện tại
- **WHEN** Quản trị viên chỉnh sửa người dùng và thay đổi đơn vị
- **THEN** Hệ thống cập nhật `department_id` mới và áp dụng phạm vi quyền hạn mới ngay lập tức

### Requirement: Hiển thị đơn vị người dùng trong danh sách
Hệ thống PHẢI hiển thị tên đơn vị của người dùng trong trang Quản lý người dùng.

#### Scenario: Xem danh sách người dùng
- **WHEN** Quản trị viên truy cập trang Quản lý người dùng
- **THEN** Hệ thống hiển thị cột "Đơn vị" với tên Khoa/Ngành tương ứng của từng người dùng
