## ADDED Requirements

### Requirement: Dedicated Syllabus Import Session
Hệ thống SHALL lưu trạng thái import đề cương PDF trong một session model dành riêng cho syllabus import.

#### Scenario: Tạo session sau khi upload
- **WHEN** người dùng tải lên file PDF hợp lệ để bắt đầu import đề cương
- **THEN** hệ thống SHALL tạo một session mới lưu file metadata, extraction state, và dữ liệu tạm của lần import đó

### Requirement: Session State Progression
Hệ thống SHALL theo dõi trạng thái xử lý của mỗi session import từ lúc upload đến lúc commit hoặc thất bại.

#### Scenario: Cập nhật tiến trình AI import
- **WHEN** session lần lượt đi qua các bước extraction, normalization, validation, review, và commit
- **THEN** hệ thống SHALL cập nhật trạng thái session tương ứng để frontend hiển thị tiến trình rõ ràng cho người dùng

### Requirement: Persistent Review Data
Hệ thống SHALL lưu canonical payload đã được AI chuẩn hóa và mọi chỉnh sửa của người dùng trong session để có thể tiếp tục review mà không mất dữ liệu.

#### Scenario: Tiếp tục phiên review
- **WHEN** người dùng tải lại trang hoặc quay lại một session import đang ở trạng thái review
- **THEN** hệ thống SHALL trả về canonical payload, warnings, validation results, và các chỉnh sửa gần nhất của người dùng

### Requirement: Retry and Failure Diagnostics
Hệ thống SHALL lưu thông tin lỗi và cho phép retry có kiểm soát khi extraction hoặc AI normalization thất bại.

#### Scenario: Retry sau lỗi AI response
- **WHEN** một session thất bại do AI timeout, malformed response, hoặc validation không qua
- **THEN** hệ thống SHALL lưu failure diagnostics trong session và cho phép khởi động lại lần xử lý mà không làm mất lịch sử lỗi trước đó

### Requirement: Session Access Isolation
Hệ thống SHALL chỉ cho phép người dùng phù hợp truy cập và thao tác trên session import của chính họ hoặc theo quyền được cấp.

#### Scenario: Từ chối truy cập session không thuộc quyền
- **WHEN** một người dùng cố mở hoặc commit session import không thuộc phạm vi truy cập của mình
- **THEN** hệ thống SHALL từ chối yêu cầu với lỗi phân quyền phù hợp
