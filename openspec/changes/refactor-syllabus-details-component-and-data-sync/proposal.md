## Why

Hiện tại, chức năng nhập đề cương từ PDF (Bước 2: Rà soát) và trang chỉnh sửa đề cương (Syllabus Editor) đang bị lặp lại mã nguồn (duplicated code) nghiêm trọng ở phần "Nội dung chi tiết học phần" (Mục 11-13). Điều này dẫn đến sự thiếu nhất quán về dữ liệu: AI bóc tách được 8 cột nội dung (Tuần, Chủ đề, Nội dung, LT, TH, Phương pháp, Tài liệu, CLO) nhưng trang Rà soát chỉ hiển thị 4 cột, gây mất mát thông tin quan trọng trước khi lưu vào cơ sở dữ liệu.

## What Changes

- **Đồng bộ Data Model**: Cập nhật cấu trúc dữ liệu `schedule` trong toàn bộ quy trình từ AI extraction, Backend Normalization đến Database để giữ trọn vẹn 8 trường thông tin.
- **Tái cấu trúc Frontend**: Tách phần hiển thị và chỉnh sửa "Nội dung chi tiết học phần" (Mục 11-13) thành một component dùng chung.
- **Nâng cấp Giao diện Rà soát**: Cập nhật Bước 2 của quy trình Import PDF để hiển thị đầy đủ 8 cột dữ liệu, khớp hoàn toàn với giao diện của Syllabus Editor.
- **Sửa lỗi Backend**: Cập nhật `services/syllabus-pdf-import.js` để không còn gộp hoặc bỏ bớt các cột dữ liệu bóc tách được từ AI.

## Capabilities

### New Capabilities
- `shared-syllabus-details-component`: Component dùng chung để hiển thị và chỉnh sửa các mục 11, 12, 13 (Mô tả, Mục tiêu, Tiên quyết, Phương pháp, Lịch trình).
- `full-data-sync-syllabus-import`: Quy trình đồng bộ dữ liệu toàn vẹn cho chức năng import PDF, đảm bảo không mất mát thông tin giữa các bước.

### Modified Capabilities
- `pdf-syllabus-import`: Cập nhật yêu cầu hiển thị và rà soát đầy đủ thông tin bóc tách từ AI ở Bước 2.
- `syllabus-editor`: Cập nhật để sử dụng component dùng chung cho phần chi tiết đề cương.

## Impact

- **Frontend**: `public/js/pages/syllabus-pdf-import.js`, `public/js/pages/syllabus-editor.js`, và tạo mới component trong `public/js/components/`.
- **Backend**: `services/syllabus-pdf-import.js` (logic normalization), `py/schemas.py` hoặc các file định nghĩa schema/database nếu cần.
- **Dữ liệu**: Các bản ghi `syllabus.content` trong database sẽ có cấu trúc `schedule` đầy đủ và đồng nhất hơn.
