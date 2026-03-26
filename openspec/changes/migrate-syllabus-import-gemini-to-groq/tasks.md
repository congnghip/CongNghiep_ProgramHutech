## 1. Provider Routing And Groq Integration

- [x] 1.1 Tách logic chọn đường xử lý import PDF từ `mode = mock|ai` sang cấu trúc engine rõ ràng cho Groq và heuristic/debug path
- [x] 1.2 Thay hàm gọi Gemini bằng Groq adapter riêng, bao gồm env config, endpoint, timeout, response parsing, và normalized error handling
- [x] 1.3 Cập nhật orchestration service để Groq trở thành engine mặc định cho AI normalization mà vẫn giữ canonical payload hiện có
- [x] 1.4 Cập nhật retry flow để bảo toàn engine đã dùng trên session thay vì ngầm đổi giữa AI và mock

## 2. Metadata And Backward Compatibility

- [x] 2.1 Chuẩn hóa metadata session import để lưu `engine`, `provider`, `model`, `prompt_version`, và trạng thái fallback theo cấu trúc rõ nghĩa
- [x] 2.2 Cập nhật metadata được ghi vào payload đề cương đã commit để editor downstream hiển thị đúng provenance của bản import
- [x] 2.3 Bổ sung compatibility logic cho session và payload cũ chỉ lưu `mode = mock|ai`
- [x] 2.4 Rà lại validation, diagnostics, và extraction metadata để loại bỏ wording Gemini hardcode

## 3. UI And Product Positioning

- [x] 3.1 Cập nhật màn import PDF để AI import qua Groq là flow mặc định và mock chỉ còn là advanced/debug option
- [x] 3.2 Điều chỉnh các badge, meta cards, và review wording để hiển thị nguồn Groq, model, và fallback status thay vì nhãn AI chung chung
- [x] 3.3 Cập nhật màn syllabus editor để hiển thị provenance mới của đề cương đã commit một cách chính xác

## 4. Tooling, Verification, And Operations

- [x] 4.1 Thay script kiểm tra Gemini key bằng script kiểm tra Groq configuration/model usability
- [x] 4.2 Cập nhật tài liệu vận hành import PDF để phản ánh Groq là provider chính và mock là đường debug/fallback
- [ ] 4.3 Kiểm thử lại create session, retry, review, validate, commit, và editor rendering trên cả session mới lẫn session legacy
- [x] 4.4 Xác nhận logging và diagnostics hiển thị đúng provider/model để phục vụ rollout và debug sau triển khai
