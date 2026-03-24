## MODIFIED Requirements

### Requirement: Giới hạn danh sách giảng viên khi phân công
Hệ thống PHẢI lọc danh sách giảng viên dựa trên đơn vị của người đang thực hiện phân công thông qua API chuyên dụng.

#### Scenario: Trưởng ngành chỉ thấy giảng viên ngành mình
- **WHEN** Trưởng ngành mở modal phân công
- **THEN** Hệ thống gọi API `/api/users/assignable` và chỉ hiển thị giảng viên thuộc đơn vị của Trưởng ngành

#### Scenario: Lãnh đạo khoa thấy toàn bộ giảng viên trong khoa
- **WHEN** Lãnh đạo khoa mở modal phân công cho đề cương thuộc một ngành cụ thể
- **THEN** Hệ thống gọi API `/api/users/assignable` theo ngữ cảnh đề cương hiện tại và hiển thị toàn bộ giảng viên thuộc khoa chứa ngành đó

#### Scenario: Ban giám hiệu/Phòng Đào tạo thấy toàn bộ giảng viên
- **WHEN** Ban giám hiệu mở modal phân công
- **THEN** Hệ thống gọi API `/api/users/assignable` và hiển thị toàn bộ giảng viên trong trường để lựa chọn
