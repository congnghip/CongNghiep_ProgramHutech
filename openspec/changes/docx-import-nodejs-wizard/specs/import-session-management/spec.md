## ADDED Requirements

### Requirement: Import Session Storage
Hệ thống SHALL lưu trữ trạng thái phiên làm việc trong bảng `docx_import_sessions` để cho phép phục hồi khi cần.

#### Scenario: Tạo mới Session sau khi tải lên
- **WHEN** Người dùng tải lên file .docx thành công
- **THEN** Hệ thống SHALL tạo bản ghi mới trong bảng `docx_import_sessions` với trạng thái `processing` và dữ liệu JSON đã trích xuất

### Requirement: CRUD Operations for Import Session
Người dùng SHALL có thể cập nhật dữ liệu trong phiên làm việc tại bước Preview.

#### Scenario: Lưu thay đổi Preview
- **WHEN** Người dùng thực hiện cập nhật giá trị PO hoặc Môn học trong Preview
- **THEN** Hệ thống SHALL gọi API PUT để lưu giá trị vào cột `raw_data` trong bản ghi Session tương ứng

### Requirement: Validation Errors Logging
Hệ thống SHALL lưu trữ các thông báo lỗi kiểm tra vào trong Session.

#### Scenario: Lưu vết lỗi Validation
- **WHEN** Hệ thống thực hiện Validation ở Bước 3
- **THEN** Hệ thống SHALL lưu mảng lỗi vào cột `validation_errors` trong Database Session để hiển thị cho người dùng
