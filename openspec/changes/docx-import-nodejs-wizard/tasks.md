## 1. Cơ sở hạ tầng & Database

- [x] 1.1 Thêm thư viện `adm-zip` và `fast-xml-parser` vào `package.json`
- [x] 1.2 Tạo bảng `docx_import_sessions` trong Database (`db.js`) với các cột: `id`, `user_id`, `status`, `raw_data` (jsonb), `validation_errors` (jsonb), `created_at`
- [x] 1.3 Thêm route API khởi tạo session: `POST /api/import/docx/session`
- [x] 1.4 Thêm route API lấy thông tin session: `GET /api/import/docx/session/:id`

## 2. Node.js DOCX Parser Service

- [x] 2.1 Xây dựng module `services/docx-parser.js` sử dụng `adm-zip` để đọc cấu trúc .docx
- [x] 2.2 Triển khai logic trích xuất XML: PO, PLO từ các bảng trong document.xml
- [x] 2.3 Triển khai logic trích xuất danh sách Môn học và Ma trận (PO-PLO, PLO-Course)
- [x] 2.4 Xây dựng hàm xử lý ô bị gộp (merged cells) trong bảng XML

## 3. Frontend Component Refactoring

- [x] 3.1 Tách các tab chỉnh sửa từ `version-editor.js` thành các component độc lập trong `public/js/components/training-tabs.js`
- [x] 3.2 Cập nhật `version-editor.js` để sử dụng các component đã tách
- [x] 3.3 Đảm bảo các component này hỗ trợ chế độ "Preview" (không lưu trực tiếp vào bảng chính)

## 4. Wizard UI & Flow Implementation

- [x] 4.1 Tạo trang `public/js/pages/syllabus-import.js` với giao diện Wizard 4 bước
- [x] 4.2 Triển khai Bước 1: Upload file và gọi API Parser
- [x] 4.3 Triển khai Bước 2: Preview dữ liệu sử dụng `training-tabs.js` và cho phép sửa đổi
- [x] 4.4 Triển khai Bước 3: Validation logic trên cả Frontend và Backend
- [x] 4.5 Triển khai Bước 4: Nút "Hoàn tất" và gọi API Atomic Commit

## 5. API Backend & Integration

- [x] 5.1 Thêm route API `PUT /api/import/docx/session/:id` để cập nhật dữ liệu tạm
- [x] 5.2 Thêm route API `POST /api/import/docx/session/:id/validate` để kiểm tra ràng buộc
- [x] 5.3 Thêm route API `POST /api/import/docx/session/:id/commit` để lưu chính thức (sử dụng Transaction)
- [x] 5.4 Tích hợp nút "Nhập từ DOCX" vào màn hình danh sách CTDT (`programs.js`)
- [x] 5.5 Cập nhật phân quyền để cho phép người dùng có quyền `programs.create` sử dụng tính năng import

## 6. Testing & Validation

- [x] 6.1 Viết script test parse file .docx mẫu và so sánh kết quả với Python parser cũ
- [x] 6.2 Kiểm tra luồng Wizard: từ upload đến khi dữ liệu xuất hiện trong bảng chính
- [x] 6.3 Test trường hợp file lỗi hoặc dữ liệu không hợp lệ (Validation)
- [x] 6.4 Đảm bảo Transaction hoạt động đúng (Rollback nếu commit lỗi giữa chừng)
