## ADDED Requirements

### Requirement: Session metadata SHALL represent engine, provider, and model explicitly
Hệ thống SHALL lưu metadata import session theo các trường rõ nghĩa cho engine xử lý, provider LLM, model, prompt version, và trạng thái fallback thay vì chỉ lưu một nhãn `mode` mơ hồ.

#### Scenario: Lưu metadata cho session Groq
- **WHEN** hệ thống tạo một session import bằng Groq
- **THEN** metadata của session SHALL thể hiện rõ engine LLM, provider Groq, model đang dùng, prompt version, và các diagnostics liên quan

#### Scenario: Lưu metadata cho session heuristic
- **WHEN** hệ thống tạo một session import bằng heuristic/debug path
- **THEN** metadata của session SHALL phản ánh đây là heuristic engine và không được giả danh thành một provider AI thực

### Requirement: Committed syllabus metadata SHALL preserve import provenance
Hệ thống SHALL ghi metadata nguồn import xuống payload đề cương đã commit để màn hình editor và audit downstream hiển thị được nguồn chuẩn hóa thật.

#### Scenario: Hiển thị nguồn đề cương đã commit
- **WHEN** người dùng mở một đề cương đã được tạo từ import PDF
- **THEN** hệ thống SHALL có đủ metadata trong payload đã commit để UI hiển thị nguồn như Groq hoặc heuristic fallback một cách chính xác

### Requirement: Metadata readers SHALL remain backward-compatible with legacy mode fields
Hệ thống SHALL tiếp tục đọc được các session hoặc payload cũ chỉ có `mode = mock|ai` trong giai đoạn chuyển tiếp.

#### Scenario: Đọc session cũ từ thời Gemini
- **WHEN** backend hoặc frontend mở một session import cũ chỉ lưu metadata kiểu legacy
- **THEN** hệ thống SHALL suy diễn được nhãn hiển thị tối thiểu mà không làm hỏng review, retry, hoặc editor flow
