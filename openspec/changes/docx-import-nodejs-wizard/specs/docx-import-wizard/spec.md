## ADDED Requirements

### Requirement: DOCX Import Wizard Workflow
Hệ thống SHALL cung cấp giao diện Wizard 4 bước để hướng dẫn người dùng qua quy trình nhập liệu CTDT từ file .docx.

#### Scenario: Chuyển đổi giữa các bước Wizard
- **WHEN** Người dùng hoàn thành bước hiện tại và dữ liệu hợp lệ
- **THEN** Hệ thống SHALL mở khóa và cho phép chuyển sang bước tiếp theo trong Wizard

### Requirement: Step 1 - File Upload
Người dùng SHALL có thể tải lên file .docx chứa dữ liệu chương trình đào tạo.

#### Scenario: Tải lên file hợp lệ
- **WHEN** Người dùng chọn file .docx và nhấn "Tiếp tục"
- **THEN** Hệ thống SHALL gửi file lên server để phân tích và chuyển sang bước Preview

### Requirement: Step 2 - Data Preview & Edit
Hệ thống SHALL hiển thị dữ liệu đã trích xuất trong giao diện các Tab (PO, PLO, Môn học, Ma trận) và cho phép người dùng chỉnh sửa trực tiếp.

#### Scenario: Chỉnh sửa dữ liệu trích xuất
- **WHEN** Người dùng thay đổi nội dung trong Tab PO hoặc Môn học ở màn hình Preview
- **THEN** Hệ thống SHALL cập nhật dữ liệu tạm thời trong Session và lưu vào Database tạm

### Requirement: Step 3 - Data Validation
Hệ thống SHALL thực hiện kiểm tra các ràng buộc logic và dữ liệu trước khi cho phép lưu chính thức.

#### Scenario: Kiểm tra lỗi ràng buộc
- **WHEN** Người dùng nhấn "Kiểm tra dữ liệu" ở Bước 3
- **THEN** Hệ thống SHALL hiển thị danh sách các lỗi (như thiếu mã môn học, PLO chưa được ánh xạ) và ngăn cản việc chuyển sang Bước 4 nếu có lỗi nghiêm trọng

### Requirement: Step 4 - Atomic Commit
Hệ thống SHALL thực hiện lưu toàn bộ dữ liệu từ phiên làm việc vào các bảng chính của Database trong một transaction duy nhất.

#### Scenario: Hoàn tất nhập liệu thành công
- **WHEN** Người dùng nhấn "Hoàn tất" ở Bước 4 sau khi đã Validation thành công
- **THEN** Hệ thống SHALL cập nhật dữ liệu vào các bảng programs, program_versions,... và hiển thị thông báo thành công
