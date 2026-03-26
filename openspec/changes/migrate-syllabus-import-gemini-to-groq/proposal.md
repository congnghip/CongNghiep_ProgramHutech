## Why

Luồng import đề cương PDF hiện đang gắn chặt AI normalization vào Gemini, trong khi sản phẩm cần chuyển sang Groq và giảm vai trò của mock mode xuống thành fallback/debug path thay vì một chế độ ngang hàng với AI. Đây là thời điểm phù hợp để tái cấu trúc theo hướng provider-first, giúp cấu hình AI rõ ràng hơn, wording UI nhất quán hơn, và mở đường cho việc thay provider/model trong tương lai mà không phải vá tiếp kiến trúc.

## What Changes

- Chuyển engine AI chính của luồng import đề cương PDF từ Gemini sang Groq, bao gồm cấu hình environment, HTTP integration, lỗi vận hành, và metadata lưu theo provider/model thực tế.
- Tách trục xử lý `engine/provider/model` khỏi nhãn `mock|ai`, để backend và frontend hiểu rõ đâu là đường đi LLM thực, đâu là fallback heuristic nội bộ.
- Cập nhật contract metadata của import session và payload đã commit để lưu first-class các trường như `engine`, `provider`, `model`, `prompt_version`, và trạng thái fallback thay vì chỉ lưu `mode`.
- Điều chỉnh UI import/review/editor để mặc định nhấn mạnh AI import qua Groq, đồng thời đẩy mock mode sang vai trò debug hoặc advanced fallback thay vì CTA nổi bật ở flow chính.
- Cập nhật tài liệu vận hành, script kiểm tra key, và wording quan sát hệ thống để phản ánh Groq thay cho Gemini.

## Capabilities

### New Capabilities
- `syllabus-import-llm-provider-routing`: Định nghĩa cách luồng import PDF chọn engine xử lý giữa Groq LLM path và heuristic fallback path, cùng metadata tương ứng.
- `groq-syllabus-normalization`: Định nghĩa contract gọi Groq để chuẩn hóa text PDF thành canonical syllabus payload ổn định và kiểm chứng được.
- `syllabus-import-ai-metadata`: Định nghĩa metadata chuẩn cho session review và dữ liệu đã commit, phản ánh provider/model/prompt/fallback thay vì nhãn mode mơ hồ.

### Modified Capabilities

## Impact

- **Backend**: `services/syllabus-pdf-import.js`, `server.js`, session metadata handling, retry flow, error handling, validation wording.
- **Frontend**: `public/js/pages/syllabus-pdf-import.js`, `public/js/pages/syllabus-editor.js`, text labels, badges, and review metadata cards.
- **Tooling / Ops**: script test key, operational docs, env configuration, logs, and diagnostics naming.
- **Dependencies / Integrations**: thay thế `GEMINI_API_KEY` / Gemini endpoint bằng cấu hình Groq tương ứng và adapter LLM trung tính hơn.
