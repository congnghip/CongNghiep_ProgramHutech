## Context

Codebase hiện tại đã có một workflow import `.docx` cho CTĐT trong Node.js với các thành phần quan trọng: upload endpoint, bảng session JSONB, bước preview, validation, và atomic commit. Trong khi đó, nhu cầu mới là nhập đề cương học phần từ `.pdf`, nhưng PDF từ giảng viên không thống nhất về cấu trúc, có thể khác tiêu đề section, khác bố cục bảng, và chất lượng extract text không ổn định; vì vậy giải pháp rule-based như DOCX parser là không đủ.

Repo cũng đã có một prototype Python cho việc bóc tách đề cương PDF bằng Gemini tại `decuong/syllabus_extractor.py`, cùng schema runtime cho đề cương trong Node.js đang chia dữ liệu thành hai vùng: `version_syllabi.content` lưu phần nội dung JSON và `course_clos` / `clo_plo_map` lưu chuẩn đầu ra cùng ánh xạ. Điều này khiến change này vừa là một bài toán import workflow, vừa là một bài toán canonicalization dữ liệu và persistence mapping.

Các stakeholder trực tiếp gồm:
- Người dùng nghiệp vụ cần upload nhiều mẫu PDF khác nhau và nhận về một bản đề cương chuẩn để rà soát.
- Backend Node.js cần kiểm soát luồng gọi AI, session, timeout, retry, validation, và commit an toàn.
- Frontend admin workspace cần một màn review dễ hiểu, nhất quán với giao diện hiện có, nhưng đủ rõ để hiển thị warning và các field cần xác nhận.

## Goals / Non-Goals

**Goals:**
- Định nghĩa một kiến trúc Node.js cho import đề cương PDF bằng AI, từ upload đến commit, phù hợp với schema đề cương hiện tại.
- Chuẩn hóa một canonical syllabus payload duy nhất làm contract giữa extraction, AI normalization, review UI, validation, và persistence.
- Thiết kế cơ chế session import riêng cho syllabus PDF để lưu raw extraction, AI output, warning, confidence, validation state, và trạng thái retry/review.
- Xác định rõ phần nào có thể auto-map an toàn vào `version_syllabi.content`, `course_clos`, `clo_plo_map`, và phần nào phải qua review bắt buộc.
- Chuẩn bị nền observability và failure-handling cho mục tiêu phản hồi khoảng 30-60 giây trên phần lớn PDF text-based.

**Non-Goals:**
- Không cam kết giải quyết OCR hoàn chỉnh cho mọi PDF scan ảnh xấu trong change đầu tiên.
- Không thay đổi approval workflow của đề cương sau khi đã được tạo trong hệ thống.
- Không thay đổi mô hình dữ liệu lõi của `version_syllabi`, `course_clos`, hoặc `clo_plo_map` ngoài phạm vi cần để hỗ trợ import session và metadata đi kèm.
- Không biến AI thành nguồn dữ liệu tin cậy tuyệt đối; change này vẫn giữ con người trong vòng review trước khi commit.

## Decisions

- **Dùng Node.js orchestration thay vì parser thuần rule-based**
  - Why: PDF đề cương không đồng nhất về nhãn và cấu trúc, nên rule-based parser sẽ giòn và khó scale. Node.js sẽ giữ vai trò điều phối các bước extract, normalize, validate, và commit; AI là lớp chuẩn hóa chứ không phải điểm commit trực tiếp.
  - Alternatives considered:
    - Mở rộng parser Python hiện có: nhanh cho prototype nhưng lệch stack, khó tái sử dụng session/UI hiện tại và tăng chi phí vận hành.
    - Dùng parser thuần heuristic trong Node.js: đơn giản hơn về dependency nhưng độ phủ thấp với PDF đa dạng.

- **Thiết kế canonical syllabus payload làm contract trung tâm**
  - Why: Vấn đề cốt lõi không phải đọc được PDF, mà là ép nhiều đầu vào khác nhau về một form chuẩn ổn định. Contract này sẽ là đầu ra duy nhất AI được phép trả về và là đầu vào duy nhất cho preview/commit.
  - Alternatives considered:
    - Để AI trả về JSON linh hoạt rồi map động theo từng file: tốc độ demo nhanh nhưng gần như không kiểm soát được tính nhất quán.
    - Cho AI ghi trực tiếp theo schema DB: coupling quá chặt vào persistence và khó review.

- **Tạo session model riêng cho syllabus PDF thay vì tái sử dụng nguyên trạng `docx_import_sessions`**
  - Why: Session DOCX hiện mang semantics của CTĐT nhiều bảng, còn syllabus PDF là import một đề cương đơn lẻ với thêm metadata AI như confidence, warnings, prompt version, extraction diagnostics. Một bảng/session type riêng giúp schema rõ ràng hơn và tránh đánh tráo nghĩa của `raw_data`.
  - Alternatives considered:
    - Nhồi chung vào `docx_import_sessions`: tái sử dụng nhanh nhưng khiến contract mơ hồ, khó bảo trì, và validation logic bị pha trộn.
    - Tổng quát hóa ngay thành `document_import_sessions`: hấp dẫn về dài hạn nhưng tăng scope của change đầu tiên.

- **Chia pipeline thành nhiều lớp thay vì một lần gọi AI duy nhất**
  - Proposed flow:
    1. Upload PDF và tạo session
    2. Extract text/page blocks/table hints
    3. Detect sections và chuẩn bị prompt context
    4. Gọi AI để chuẩn hóa về canonical schema
    5. Chạy schema validation + repair/reject pass
    6. Trả về preview payload có warnings/confidence
    7. Chỉ commit sau khi validation đạt và user xác nhận
  - Why: Mô hình này giúp kiểm soát output AI, giảm nguy cơ malformed JSON, và hỗ trợ fallback tốt hơn cho PDF có cấu trúc kém.
  - Alternatives considered:
    - Một prompt lớn duy nhất với toàn bộ PDF text: đơn giản nhưng rủi ro timeout, token waste, và khó debug chất lượng.

- **Giới hạn auto-commit cho các trường có độ chắc chắn cao; review-first cho mapping nhạy cảm**
  - Safe-first fields: thông tin học phần, mô tả, mục tiêu, điều kiện tiên quyết, phương pháp, lịch giảng dạy, hình thức đánh giá, tài liệu.
  - Review-first fields: `CLO -> PLO`, `assessment -> CLO`, các suy luận tuần học khi layout PDF bị vỡ, và những giá trị AI đánh dấu là inferred/low confidence.
  - Why: Một số phần “trông có vẻ hợp lý” nhưng sai nghiệp vụ rất khó phát hiện nếu commit thẳng.
  - Alternatives considered:
    - Auto-commit toàn bộ khi JSON hợp lệ: thao tác nhanh hơn nhưng rủi ro sai dữ liệu học thuật cao.

- **Giữ mục tiêu latency 30-60 giây bằng cách tối ưu orchestration thay vì bỏ bớt review**
  - Why: Trải nghiệm nhanh phải đến từ pipeline hợp lý, không phải bỏ qua bước kiểm soát.
  - Tactics: page chunking, prompt rút gọn theo section, timeout + retry có chủ đích, lưu intermediate result trong session, và hiển thị trạng thái tiến trình cho người dùng.

## Risks / Trade-offs

- [Risk] PDF text extraction kém làm AI nhận tín hiệu sai ngay từ đầu -> Mitigation: lưu extraction diagnostics trong session, đánh dấu file low-quality, và cho phép retry bằng chế độ fallback/chunked processing.
- [Risk] AI trả JSON hợp lệ nhưng sai ngữ nghĩa -> Mitigation: dùng canonical schema chặt, server-side validation, confidence flags, và review bắt buộc cho mapping nhạy cảm.
- [Risk] Tạo session model riêng làm tăng số bảng/API cần quản lý -> Mitigation: giữ reuse ở mức workflow/UI pattern và naming nhất quán với import DOCX để giảm cognitive load.
- [Risk] Prompt lớn hoặc PDF dài làm vượt ngưỡng 30-60 giây -> Mitigation: cắt ngữ cảnh theo section, áp timeout rõ ràng, và cho phép partial diagnostics nếu AI không hoàn tất.
- [Risk] User kỳ vọng import “hoàn hảo” trên mọi PDF scan -> Mitigation: ghi rõ phạm vi hỗ trợ text-based PDF trước, bổ sung warning/fallback cho scan-like PDF.
- [Trade-off] Review step làm chậm thao tác hơn save trực tiếp -> Đổi lại là giảm rủi ro đưa dữ liệu AI chưa kiểm chứng vào các bảng đề cương chính.

## Migration Plan

1. Thêm schema/session storage và API skeleton cho import đề cương PDF mà không ảnh hưởng tới luồng DOCX hiện có.
2. Tích hợp lớp extraction + AI normalization và ghi intermediate payload vào session mới.
3. Triển khai preview/validation UI cho canonical syllabus payload, ưu tiên khớp với editor đề cương hiện có.
4. Bổ sung logic commit transaction để map dữ liệu vào `version_syllabi.content`, `course_clos`, và `clo_plo_map`.
5. Bật logging, timing metrics, và error diagnostics trước khi rollout cho dữ liệu thật.
6. Rollback strategy: tắt entry point import PDF mới và giữ nguyên dữ liệu session nếu cần; không ảnh hưởng tới dữ liệu đề cương đã commit trước đó.

## Open Questions

- Có cần hỗ trợ chính thức cho PDF scan ảnh trong phase đầu hay chỉ cảnh báo “unsupported/low confidence”?
- Session mới nên là bảng riêng `syllabus_import_sessions` hay một bảng document session tổng quát hơn nếu team muốn đầu tư cho nhiều loại import tiếp theo?
- Có cần cho phép người dùng import vào một `version_syllabi` có sẵn để ghi đè phần content/CLO, hay chỉ hỗ trợ tạo mới từ đầu?
- Mức confidence nào đủ để auto-fill mà không bắt review thủ công cho từng field?
- Có cần lưu prompt version / model version trong session để phục vụ audit và cải thiện prompt sau rollout không?
