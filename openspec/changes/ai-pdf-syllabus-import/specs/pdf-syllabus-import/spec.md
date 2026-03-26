## ADDED Requirements

### Requirement: PDF Syllabus Import Workflow
Hệ thống SHALL cung cấp workflow import đề cương từ file `.pdf` trong Node.js theo các bước upload, xử lý AI, preview, validation, và commit.

#### Scenario: Hoàn thành workflow import
- **WHEN** người dùng tải lên một file PDF hợp lệ và tiếp tục toàn bộ các bước review cần thiết
- **THEN** hệ thống SHALL tạo một session import, xử lý dữ liệu qua AI, hiển thị bản đề cương chuẩn để chỉnh sửa, và chỉ cho phép commit sau khi validation thành công

### Requirement: Supported Input and Early Rejection
Hệ thống SHALL kiểm tra định dạng file và từ chối sớm các trường hợp không thuộc phạm vi hỗ trợ của luồng import PDF.

#### Scenario: Từ chối file không hợp lệ
- **WHEN** người dùng tải lên file không phải PDF hoặc file PDF vượt giới hạn kích thước cấu hình
- **THEN** hệ thống SHALL từ chối yêu cầu trước khi tạo phiên AI processing và trả về thông báo lỗi rõ ràng

### Requirement: Review Before Commit
Hệ thống SHALL hiển thị dữ liệu đề cương đã được chuẩn hóa trong giao diện review để người dùng kiểm tra và chỉnh sửa trước khi lưu vào hệ thống chính.

#### Scenario: Chỉnh sửa bản đề cương chuẩn
- **WHEN** AI trả về canonical syllabus payload cho session import
- **THEN** hệ thống SHALL hiển thị các phần thông tin học phần, CLO, lịch học, đánh giá, và tài liệu để người dùng chỉnh sửa trực tiếp trước khi commit

### Requirement: Validation Gate Before Persistence
Hệ thống SHALL thực hiện validation nghiệp vụ và validation schema trên dữ liệu đề cương chuẩn trước khi cho phép commit.

#### Scenario: Chặn commit khi còn lỗi nghiêm trọng
- **WHEN** session import còn thiếu trường bắt buộc hoặc còn mapping không hợp lệ
- **THEN** hệ thống SHALL ngăn thao tác commit và hiển thị danh sách lỗi cần xử lý

### Requirement: Atomic Commit of Approved Import
Hệ thống SHALL lưu dữ liệu đề cương đã được review vào hệ thống chính bằng một transaction duy nhất.

#### Scenario: Commit thành công
- **WHEN** người dùng xác nhận lưu một session import đã vượt qua validation
- **THEN** hệ thống SHALL cập nhật các bảng đích của đề cương trong một transaction nguyên tử và đánh dấu session là completed
