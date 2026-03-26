## 1. Discovery And Contracts

- [x] 1.1 Chốt canonical syllabus payload cho import PDF, bao gồm course identity, content fields, CLO list, mapping fields, warnings, confidence, và import metadata
- [x] 1.2 Đối chiếu canonical payload với schema runtime hiện tại của `version_syllabi.content`, `course_clos`, và `clo_plo_map` để xác định các trường map trực tiếp và các trường cần review-first
- [x] 1.3 Thu thập một bộ fixture PDF đại diện cho nhiều cấu trúc đề cương khác nhau và ghi chú đặc điểm khó của từng mẫu để dùng cho prompt tuning và verification
- [x] 1.4 Xác định rõ phạm vi phase đầu cho PDF text-based, scan-like PDF, giới hạn kích thước file, và kỳ vọng latency 30-60 giây

## 2. Session And API Foundations

- [x] 2.1 Thiết kế và thêm session storage cho syllabus PDF import, bao gồm trạng thái xử lý, canonical payload, warnings, diagnostics, validation errors, và metadata AI
- [x] 2.2 Tạo API để bắt đầu session import PDF, lấy chi tiết session, cập nhật payload review, validate session, retry xử lý, và commit session
- [x] 2.3 Áp dụng kiểm tra phân quyền và session ownership cho toàn bộ API import đề cương PDF
- [x] 2.4 Bổ sung logging, timing, và error surfaces cho các bước upload, extraction, AI normalization, validation, và commit

## 3. PDF Extraction And AI Normalization

- [x] 3.1 Triển khai lớp extraction trong Node.js để lấy text theo trang, table hints, và metadata chất lượng từ file PDF
- [x] 3.2 Xây dựng orchestration service dùng `GEMINI_API_KEY` để gửi dữ liệu extraction sang AI theo luồng tiền xử lý, normalize, và response validation
- [x] 3.3 Thiết kế prompt và response contract để AI luôn trả về canonical syllabus payload thay vì JSON linh hoạt theo từng file
- [x] 3.4 Bổ sung cơ chế retry, timeout, malformed-response handling, và fallback cho các trường hợp PDF dài hoặc layout kém
- [x] 3.5 Ghi warnings, inferred fields, confidence, và diagnostics vào session để phục vụ review

## 4. Review And Validation Experience

- [x] 4.1 Thiết kế màn preview/review cho syllabus PDF import dựa trên pattern wizard hiện có nhưng tối ưu cho dữ liệu đề cương đơn lẻ
- [x] 4.2 Hiển thị đầy đủ các phần content, CLO, mapping, warnings, và confidence để người dùng hiểu phần nào AI chắc chắn và phần nào cần xác nhận
- [x] 4.3 Cho phép người dùng chỉnh sửa canonical payload trong session mà không mất metadata review quan trọng
- [x] 4.4 Triển khai validation nghiệp vụ cho trường bắt buộc, uniqueness của CLO, tổng trọng số đánh giá, thứ tự tuần học, và tính hợp lệ của các liên kết mapping
- [x] 4.5 Chặn thao tác commit khi còn lỗi nghiêm trọng hoặc còn mapping bị gắn cờ review bắt buộc

## 5. Persistence Mapping

- [x] 5.1 Triển khai mapping từ canonical payload sang `version_syllabi.content` theo đúng shape editor đề cương hiện có
- [x] 5.2 Triển khai mapping danh sách CLO sang `course_clos` và liên kết với học phần của đề cương đích
- [x] 5.3 Triển khai logic lưu `clo_plo_map` theo hướng only-if-valid và bỏ qua hoặc chặn các liên kết confidence thấp/chưa được xác nhận
- [x] 5.4 Đặt toàn bộ quá trình persistence vào transaction duy nhất với rollback đầy đủ khi lỗi phát sinh giữa chừng
- [x] 5.5 Lưu source-aware import metadata để có thể truy vết bản đề cương được tạo từ session import PDF

## 6. Verification And Rollout Readiness

- [x] 6.1 Kiểm thử end-to-end với các fixture PDF đã thu thập để đo độ đúng của canonical payload và độ ổn định của thời gian xử lý
- [x] 6.2 So sánh output AI với bản review cuối cùng của người dùng để xác định các field thường sai và cập nhật prompt/validation theo kết quả thực tế
- [x] 6.3 Kiểm thử các ca lỗi như file không hợp lệ, timeout AI, malformed JSON, session retry, rollback transaction, và lỗi phân quyền
- [x] 6.4 Viết tài liệu vận hành ngắn cho cấu hình `GEMINI_API_KEY`, giới hạn hệ thống, và quy trình xử lý khi import thất bại
