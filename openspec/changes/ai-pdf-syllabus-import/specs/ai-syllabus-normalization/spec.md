## ADDED Requirements

### Requirement: Canonical Syllabus Payload
Hệ thống SHALL yêu cầu lớp AI normalization trả về một canonical syllabus payload có cấu trúc ổn định, thay vì một JSON linh hoạt theo từng mẫu PDF.

#### Scenario: Trả về payload đúng contract
- **WHEN** hệ thống gửi nội dung PDF đã được tiền xử lý sang AI
- **THEN** AI normalization SHALL trả về một payload chuẩn bao gồm định danh học phần, nội dung đề cương, danh sách CLO, metadata extraction, warnings, và confidence information

### Requirement: Section Inference Across Heterogeneous PDFs
Hệ thống SHALL cho phép lớp AI suy luận các section tương đương từ nhiều cấu trúc PDF khác nhau để đưa về cùng một schema chuẩn.

#### Scenario: Mapping các tiêu đề khác nhau về cùng một field
- **WHEN** PDF sử dụng các tiêu đề khác nhau cho cùng một khái niệm như mục tiêu học phần, mô tả học phần, hoặc học phần tiên quyết
- **THEN** AI normalization SHALL ánh xạ các phần đó vào cùng field chuẩn trong canonical syllabus payload

### Requirement: AI Response Validation and Rejection
Hệ thống SHALL kiểm tra response từ AI theo schema chuẩn và không được xem response là hợp lệ chỉ vì JSON parse thành công.

#### Scenario: Từ chối response sai contract
- **WHEN** AI trả về JSON thiếu field bắt buộc, sai kiểu dữ liệu, hoặc chứa cấu trúc không tương thích với canonical payload
- **THEN** hệ thống SHALL đánh dấu lần xử lý là failed hoặc needs-retry thay vì chuyển thẳng sang bước commit

### Requirement: Confidence and Warning Annotation
Hệ thống SHALL gắn thông tin confidence, inferred fields, và warnings vào kết quả chuẩn hóa để hỗ trợ review của người dùng.

#### Scenario: Đánh dấu dữ liệu cần xác nhận
- **WHEN** AI phải suy luận một giá trị từ ngữ cảnh không rõ ràng hoặc không tìm đủ bằng chứng trong PDF
- **THEN** hệ thống SHALL đưa giá trị đó vào payload cùng cảnh báo để giao diện review hiển thị như một trường cần xác nhận

### Requirement: Latency-aware AI Processing
Hệ thống SHALL tổ chức lời gọi AI theo cách hỗ trợ mục tiêu phản hồi trong khoảng 30-60 giây cho phần lớn PDF text-based.

#### Scenario: Xử lý file PDF nhiều trang
- **WHEN** người dùng tải lên một PDF có nội dung dài nhưng vẫn thuộc phạm vi text-based bình thường
- **THEN** hệ thống SHALL áp dụng tiền xử lý, cắt ngữ cảnh, hoặc chia nhỏ bước AI processing để tránh timeout không cần thiết
