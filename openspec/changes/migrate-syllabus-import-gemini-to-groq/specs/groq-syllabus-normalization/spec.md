## ADDED Requirements

### Requirement: Groq SHALL be the primary provider for syllabus AI normalization
Hệ thống SHALL dùng Groq làm provider chính để chuẩn hóa text PDF thành AI payload trước bước canonicalization.

#### Scenario: Chuẩn hóa PDF text-based bằng Groq
- **WHEN** service import nhận được nội dung PDF text-based hợp lệ trên đường LLM mặc định
- **THEN** hệ thống SHALL gửi prompt normalization tới Groq và nhận về JSON phù hợp với contract AI payload nội bộ

### Requirement: Groq integration SHALL expose explicit configuration and error handling
Hệ thống SHALL dùng cấu hình environment và thông báo lỗi vận hành phản ánh rõ provider Groq, model đang dùng, và các lỗi như timeout, auth, quota, hoặc malformed response.

#### Scenario: Thiếu cấu hình Groq
- **WHEN** hệ thống cố gọi normalization qua Groq nhưng thiếu API key hoặc model configuration bắt buộc
- **THEN** hệ thống SHALL trả lỗi chỉ rõ cấu hình Groq đang thiếu thay vì nhắc tới Gemini hoặc một provider mơ hồ

#### Scenario: Groq trả response không hợp lệ
- **WHEN** Groq trả response không parse được thành JSON hợp lệ hoặc không đúng contract kỳ vọng
- **THEN** hệ thống SHALL từ chối kết quả đó và đánh dấu lần xử lý là failed hoặc needs-review thay vì tiếp tục commit pipeline

### Requirement: Groq prompt metadata SHALL remain auditable
Hệ thống SHALL ghi nhận model và prompt version của lần normalize qua Groq để phục vụ review, retry, và vận hành.

#### Scenario: Lưu audit metadata cho session Groq
- **WHEN** một session import Groq được tạo hoặc retry thành công
- **THEN** session SHALL lưu đủ provider, model, prompt version, và dấu thời gian xử lý để downstream UI và logs có thể hiển thị nhất quán
