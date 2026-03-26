## Context

Luồng import đề cương PDF hiện hoạt động được nhưng kiến trúc AI normalization vẫn gắn chặt vào Gemini ở nhiều lớp cùng lúc: biến môi trường, hàm gọi HTTP, metadata `extraction_method`, script kiểm tra key, wording UI, và các thông báo lỗi vận hành. Đồng thời, backend và frontend đang dùng `mode = mock | ai` như trục chính của workflow, khiến mock mode vô tình trở thành một chế độ sản phẩm ngang hàng với AI thực thay vì chỉ là heuristic fallback/debug path.

Thay đổi này đụng nhiều lớp xuyên suốt gồm `services/syllabus-pdf-import.js`, `server.js`, `public/js/pages/syllabus-pdf-import.js`, `public/js/pages/syllabus-editor.js`, script vận hành, và tài liệu. Các stakeholder trực tiếp gồm người dùng import PDF, backend quản lý session/retry/commit, frontend review UI, và vận hành cần quan sát provider/model đang chạy thật.

## Goals / Non-Goals

**Goals:**
- Chuyển AI provider chính của luồng import PDF từ Gemini sang Groq mà không phá canonical syllabus payload hiện có.
- Tái cấu trúc flow theo hướng provider-first để phân biệt rõ LLM path và heuristic fallback path.
- Chuẩn hóa metadata của session và dữ liệu đã commit để phản ánh `engine`, `provider`, `model`, `prompt_version`, và `fallback_used`.
- Giảm độ nổi bật của mock mode trong UI flow chính và đưa AI import qua Groq thành trải nghiệm mặc định.
- Giữ nguyên các bước review, validation, và commit an toàn đã có.

**Non-Goals:**
- Không thiết kế một multi-provider platform tổng quát cho toàn bộ hệ thống ngoài phạm vi import đề cương PDF.
- Không thay đổi canonical payload schema ở mức làm gãy mapping sang `version_syllabi`, `course_clos`, hoặc `clo_plo_map`.
- Không mở rộng phạm vi sang OCR hoàn chỉnh cho PDF scan ảnh xấu.
- Không loại bỏ hoàn toàn heuristic/mock path trong phase này; nó vẫn tồn tại như fallback/debug tool.

## Decisions

- **Tách selection logic thành `engine` thay vì `mode`**
  - Why: `mode = mock | ai` đang trộn hai câu hỏi khác nhau: đường xử lý nào được dùng và AI provider nào được gọi. Đổi sang `engine = groq | mock` hoặc một cấu trúc tương đương giúp code, metadata, và UI cùng nói một ngôn ngữ rõ ràng hơn.
  - Alternatives considered:
    - Giữ `mode` và chỉ đổi nhánh `ai` sang gọi Groq: nhanh nhưng tiếp tục che giấu provider thật và giữ mock như khái niệm trung tâm.
    - Dùng `provider` thuần mà bỏ khái niệm heuristic path: không phù hợp vì mock/fallback không phải LLM provider.

- **Giữ canonical syllabus payload, chỉ nâng cấp metadata**
  - Why: Giá trị lớn nhất của luồng hiện tại nằm ở canonical payload ổn định và pipeline review/validation/commit. Việc migrate provider không nên kéo theo thay đổi phá vỡ contract downstream.
  - Alternatives considered:
    - Thiết kế lại payload theo response shape của Groq/model mới: rủi ro regression cao và không cần thiết.
    - Ghi trực tiếp metadata provider vào field tự do không chuẩn hóa: khó audit và làm UI khó hiển thị nhất quán.

- **Tạo adapter Groq riêng thay cho hàm `callGemini()` hardcode**
  - Why: Một adapter LLM riêng cho import PDF giúp cô lập endpoint, auth header, timeout, response parsing, và error normalization của Groq. Service orchestration phía trên chỉ cần biết “gọi normalization engine” và nhận canonical AI payload.
  - Alternatives considered:
    - Sửa trực tiếp `callGemini()` thành gọi Groq nhưng giữ tên cũ: gây lệch nghĩa và làm codebase khó hiểu.
    - Đưa luôn mọi thứ vào một abstraction provider framework lớn: vượt scope của change này.

- **Đưa mock về advanced fallback/debug path**
  - Why: Tài liệu vận hành hiện cũng xem mock là công cụ local verification/prompt tuning, không phải đường sản phẩm chính. UI cần phản ánh điều đó để tránh user hiểu nhầm rằng mock là lựa chọn ngang hàng với AI thực.
  - Alternatives considered:
    - Giữ nút mock mode nổi bật ở bước upload: tốt cho demo nhưng làm lệch định vị sản phẩm.
    - Xóa hẳn mock khỏi backend: làm mất công cụ chẩn đoán hữu ích cho phase hiện tại.

- **Lưu metadata provider/model xuyên suốt từ session đến payload đã commit**
  - Why: Người dùng và vận hành cần biết bản đề cương này được chuẩn hóa bởi engine nào, model nào, prompt version nào, và có dùng fallback hay không. Điều này cũng giúp retry, audit, và cải tiến prompt sau rollout.
  - Alternatives considered:
    - Chỉ lưu trong session mà không đẩy xuống content đã commit: editor downstream sẽ không hiển thị nguồn thật một cách đáng tin cậy.
    - Chỉ lưu label “AI” chung chung: không đủ để vận hành hay debug.

## Risks / Trade-offs

- [Risk] Groq trả response có shape hoặc failure mode khác Gemini -> Mitigation: adapter Groq phải normalize lỗi, parse JSON chặt, và giữ cùng contract AI payload nội bộ trước khi canonicalize.
- [Risk] Session cũ và session mới dùng metadata khác nghĩa -> Mitigation: thiết kế tương thích ngược khi đọc metadata và giữ fallback đọc `mode` cũ trong UI/backend cho dữ liệu đã tồn tại.
- [Risk] Giảm độ nổi bật của mock mode có thể làm team debug chậm hơn trong ngắn hạn -> Mitigation: giữ mock dưới advanced/debug path và cập nhật docs/scripts rõ ràng.
- [Risk] Đổi env/config có thể làm deploy thiếu key hoặc model id -> Mitigation: thêm script kiểm tra Groq key/model và cập nhật docs rollout/operations trước khi bật production.
- [Trade-off] Tạo adapter provider và metadata chuẩn hóa làm scope lớn hơn việc “đổi key” đơn thuần -> Đổi lại là giảm debt kiến trúc và tránh phải refactor lần nữa khi thêm provider/model khác.

## Migration Plan

1. Thêm change artifacts và chốt contract mới cho engine/provider/model metadata.
2. Triển khai adapter Groq và nối service import PDF sang đường Groq làm mặc định.
3. Cập nhật session metadata, retry flow, commit payload metadata, và compatibility logic cho dữ liệu cũ còn lưu `mode`.
4. Điều chỉnh UI import/editor để hiển thị nguồn Groq và hạ mock xuống advanced/debug path.
5. Cập nhật script kiểm tra key, docs vận hành, logging, và diagnostics naming.
6. Rollout strategy: bật Groq path với env mới; nếu có sự cố, tạm chuyển engine mặc định về heuristic/debug path hoặc rollback sang commit trước đó mà không làm hỏng dữ liệu đã commit.

## Open Questions

- Có cần cho phép cấu hình model Groq qua env linh hoạt ngay trong phase đầu hay chốt một default model duy nhất trước?
- Mock path nên được giữ như toggle UI ẩn, query/debug flag, hay chỉ còn trong script nội bộ?
- `extraction_method` có nên tiếp tục gói cả text extraction + normalization provider trong một string, hay tách thành trường rõ hơn trong metadata?
