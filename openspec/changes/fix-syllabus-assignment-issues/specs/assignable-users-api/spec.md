## ADDED Requirements

### Requirement: Lấy danh sách người dùng có thể phân công
Hệ thống PHẢI cung cấp một API trả về danh sách giảng viên mà người dùng hiện tại có quyền phân công soạn đề cương.

#### Scenario: Trưởng ngành lấy danh sách
- **WHEN** Trưởng ngành gọi API `/api/users/assignable`
- **THEN** Hệ thống trả về danh sách giảng viên thuộc cùng đơn vị với Trưởng ngành

#### Scenario: Lãnh đạo khoa lấy danh sách theo khoa của đề cương
- **WHEN** Lãnh đạo khoa gọi API `/api/users/assignable` cho một đề cương thuộc ngành cụ thể
- **THEN** Hệ thống trả về danh sách giảng viên thuộc toàn bộ khoa chứa ngành của đề cương đó

#### Scenario: Ban giám hiệu lấy danh sách
- **WHEN** Ban giám hiệu gọi API `/api/users/assignable`
- **THEN** Hệ thống trả về toàn bộ giảng viên trong hệ thống

### Requirement: API sử dụng ngữ cảnh đề cương để tính phạm vi
API `assignable` PHẢI xác định phạm vi phân công từ đề cương đang thao tác thay vì chỉ dựa trên vai trò tổng quát của người gọi.

#### Scenario: Phân công theo đúng ngành của đề cương
- **WHEN** Người dùng gọi API `/api/users/assignable` với `syllabus_id`
- **THEN** Hệ thống dùng ngành của đề cương đó để xác định danh sách giảng viên hợp lệ cho người gọi

### Requirement: Bảo mật dữ liệu người dùng
API `assignable` PHẢI giới hạn các trường thông tin trả về để đảm bảo bảo mật.

#### Scenario: Cấu trúc dữ liệu trả về
- **WHEN** API được gọi thành công
- **THEN** Dữ liệu chỉ bao gồm `id`, `display_name`, `username` và `dept_name`
