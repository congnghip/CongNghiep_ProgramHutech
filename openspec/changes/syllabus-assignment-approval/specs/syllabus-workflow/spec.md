## ADDED Requirements

### Requirement: Quyền soạn thảo của giảng viên được phân công
Giảng viên PHẢI có quyền tạo mới, chỉnh sửa và nộp bản thảo đề cương cho những môn được gán.

#### Scenario: Giảng viên truy cập đề cương được giao
- **WHEN** Giảng viên vào mục "Đề cương của tôi" và chọn soạn đề cương
- **THEN** Hệ thống hiển thị giao diện Syllabus Editor cho phép thay đổi nội dung

#### Scenario: Giảng viên không được phân công
- **WHEN** Giảng viên truy cập trực tiếp đề cương không được gán qua đường dẫn
- **THEN** Hệ thống từ chối quyền truy cập và hiển thị thông báo "Không có quyền"

### Requirement: Luồng phê duyệt đề cương đa cấp
Hệ thống PHẢI hỗ trợ luồng trạng thái từ `draft` -> `submitted` -> `approved_tbm` -> `approved_khoa` -> `approved_pdt/bgh` -> `published`.

#### Scenario: Giảng viên nộp đề cương
- **WHEN** Giảng viên hoàn tất nội dung và nhấn "Nộp duyệt"
- **THEN** Trạng thái đề cương chuyển từ `draft` sang `submitted`

#### Scenario: Phê duyệt theo từng cấp
- **WHEN** Trưởng ngành/Khoa/BGH phê duyệt lần lượt
- **THEN** Hệ thống ghi nhận log phê duyệt và chuyển trạng thái đề cương lên cấp tiếp theo
