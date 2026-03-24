## ADDED Requirements

### Requirement: Phân công giảng viên cho đề cương
Hệ thống PHẢI cho phép Trưởng ngành (hoặc cấp cao hơn) gán một hoặc nhiều giảng viên vào một môn học cụ thể trong phiên bản CTDT để họ có quyền soạn thảo đề cương.

#### Scenario: Trưởng ngành phân công giảng viên trong ngành
- **WHEN** Trưởng ngành chọn môn học trong Version Editor và chọn danh sách giảng viên thuộc ngành mình
- **THEN** Hệ thống lưu trữ các bản ghi phân công vào bảng `syllabus_assignments`

#### Scenario: Ban giám hiệu phân công giảng viên ngoài ngành
- **WHEN** Ban giám hiệu chọn môn học "Anh văn" (thuộc Khoa Ngoại ngữ) và phân công giảng viên từ Khoa Ngoại ngữ cho phiên bản CTDT của Khoa CNTT
- **THEN** Giảng viên được phân công sẽ có quyền soạn thảo đề cương môn Anh văn trong phiên bản đó

### Requirement: Giới hạn danh sách giảng viên khi phân công
Hệ thống PHẢI lọc danh sách giảng viên dựa trên đơn vị của người đang thực hiện phân công.

#### Scenario: Trưởng ngành chỉ thấy giảng viên ngành mình
- **WHEN** Trưởng ngành mở modal phân công
- **THEN** Danh sách giảng viên chỉ hiển thị những người có `department_id` trùng với đơn vị của Trưởng ngành

#### Scenario: Ban giám hiệu/Phòng Đào tạo thấy toàn bộ giảng viên
- **WHEN** Ban giám hiệu mở modal phân công
- **THEN** Hệ thống hiển thị toàn bộ giảng viên trong trường để lựa chọn
