## Why

Hệ thống hiện đã có luồng import CTĐT từ `.docx`, nhưng chưa có một năng lực tương ứng để nhập đề cương học phần từ `.pdf` trong khi đây là định dạng giảng viên đang dùng phổ biến và rất không đồng nhất về bố cục. Cần một change chính thức cho giải pháp Node.js dùng AI để bóc tách, chuẩn hóa, và đưa nhiều mẫu PDF khác nhau về một form đề cương chuẩn có thể review và lưu an toàn vào schema hiện tại.

## What Changes

- Xây dựng luồng import đề cương từ file `.pdf` trong Node.js, bao gồm upload, phân tích, preview, validation, và commit theo mô hình session tương tự import DOCX nhưng tối ưu cho dữ liệu AI-generated.
- Thêm lớp AI normalization dùng `GEMINI_API_KEY` để chuyển nội dung PDF không đồng nhất thành một canonical syllabus payload ổn định, có cảnh báo, confidence, và field review.
- Chuẩn hóa contract dữ liệu giữa PDF extraction, AI response, UI review, và persistence vào các bảng đề cương hiện có như `version_syllabi`, `course_clos`, và `clo_plo_map`.
- Thiết kế chiến lược xử lý nhiều dạng PDF khác nhau, bao gồm nhận diện section, fallback khi layout kém, kiểm tra JSON trả về, và giới hạn commit tự động cho các trường có độ tin cậy thấp.
- Mở rộng giao diện nhập liệu để người dùng có thể rà soát và sửa bản đề cương chuẩn trước khi lưu, thay vì ghi thẳng dữ liệu AI vào hệ thống.

## Capabilities

### New Capabilities
- `pdf-syllabus-import`: Cung cấp workflow import đề cương từ PDF theo hướng upload, AI parse, preview, validation, và commit trong hệ thống Node.js.
- `ai-syllabus-normalization`: Định nghĩa contract cho lớp AI bóc tách và chuẩn hóa nội dung PDF không đồng nhất về một JSON đề cương chuẩn, nhất quán và có thể kiểm chứng.
- `syllabus-import-session-management`: Quản lý vòng đời session import, trạng thái xử lý AI, dữ liệu tạm, cảnh báo, và retry/review trước khi commit.
- `syllabus-persistence-mapping`: Xác định cách map canonical syllabus payload vào các cấu trúc lưu trữ hiện tại như `version_syllabi.content`, `course_clos`, và `clo_plo_map`.

### Modified Capabilities

## Impact

- **Backend**: Thêm hoặc mở rộng API import PDF, dịch vụ orchestration cho AI, validation pipeline, session storage, và logic commit cho đề cương.
- **Frontend**: Mở rộng màn import/review để hiển thị bản đề cương chuẩn, warning, confidence, và các khu vực cần người dùng xác nhận trước khi lưu.
- **Database**: Tái sử dụng hoặc mở rộng bảng session import hiện có, đồng thời dùng schema đề cương hiện tại (`version_syllabi`, `course_clos`, `clo_plo_map`) làm đích commit.
- **Dependencies / Integrations**: Tích hợp Gemini qua `GEMINI_API_KEY`, xử lý upload PDF, text extraction, và cơ chế timeout/retry/logging cho AI requests.
- **Operational**: Cần observability cho thời gian xử lý 30-60 giây, lỗi parse, chất lượng output AI, và khả năng fallback khi PDF có cấu trúc kém.
