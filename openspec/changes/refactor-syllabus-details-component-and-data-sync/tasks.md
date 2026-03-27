## 1. Backend Data Model Synchronization

- [x] 1.1 Cập nhật `services/syllabus-pdf-import.js`: Sửa hàm `normalizeCanonicalPayload` để giữ nguyên 8 trường của `schedule`.
- [x] 1.2 Cập nhật `services/syllabus-pdf-import.js`: Sửa hàm `buildCanonicalPayloadFromAi` để map đầy đủ các trường từ AI output sang canonical format.
- [x] 1.3 Cập nhật `services/syllabus-pdf-import.js`: Sửa hàm `mapPayloadToSyllabusContent` để đảm bảo dữ liệu lưu vào DB có cấu trúc `schedule` 8 trường đồng nhất.
- [x] 1.4 Kiểm tra (Test) backend logic bằng script mẫu để xác nhận dữ liệu không bị mất mát sau khi qua bộ chuẩn hóa.

## 2. Shared Frontend Component Development

- [x] 2.1 Tạo mới `public/js/components/syllabus-details-section.js` định nghĩa object dùng chung.
- [x] 2.2 Triển khai hàm `render(container, data, editable)` trong component: Render các textarea mục 11, 12 và bảng 8 cột cho mục 13.
- [x] 2.3 Triển khai hàm `capture()` trong component: Thu thập dữ liệu từ DOM và trả về object JSON chuẩn.
- [x] 2.4 Triển khai hàm `addRow()` cho bảng lịch trình trong component.

## 3. Frontend Integration & Refactoring

- [x] 3.1 Cập nhật `public/js/pages/syllabus-pdf-import.js`: Thay thế code render Mục 11-13 ở Bước 2 bằng việc gọi component mới.
- [x] 3.2 Cập nhật `public/js/pages/syllabus-pdf-import.js`: Sửa hàm `captureReviewPayloadFromDom` để lấy dữ liệu từ component mới.
- [x] 3.3 Cập nhật `public/js/pages/syllabus-editor.js`: Thay thế code render và save trong `renderScheduleTab` bằng component mới.
- [x] 3.4 Đảm bảo CSS cho bảng 8 cột hoạt động tốt trên cả hai trang (xử lý overflow cuộn ngang).

## 4. Verification & Validation

- [x] 4.1 Thực hiện quy trình Import PDF từ file mẫu, kiểm tra Bước 2 hiển thị đủ 8 cột.
- [x] 4.2 Lưu đề cương và mở bằng Syllabus Editor, kiểm tra dữ liệu 8 cột được bảo toàn và hiển thị đúng.
- [x] 4.3 Kiểm tra việc thêm/xóa dòng và lưu dữ liệu ở cả hai trang (Import & Editor).
