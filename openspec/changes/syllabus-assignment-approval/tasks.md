## 1. Cơ sở dữ liệu (Database)

- [x] 1.1 Thêm cột `department_id` (FK tới `departments`) vào bảng `users`
- [x] 1.2 Tạo bảng `syllabus_assignments` (id, syllabus_id, user_id, assigned_at)
- [x] 1.3 Cập nhật dữ liệu mẫu cho một số người dùng để gán họ vào Khoa/Ngành

## 2. API Backend & RBAC

- [x] 2.1 Cập nhật `GET /api/users` và `POST/PUT /api/users` để hỗ trợ `department_id`
- [x] 2.2 Tạo API `GET /api/assignments/:syllabusId` để lấy danh sách giảng viên được phân công
- [x] 2.3 Tạo API `POST /api/assignments` để lưu phân công (kiểm tra quyền Trưởng ngành/BGH)
- [x] 2.4 Cập nhật `GET /api/versions/:vId/syllabi` để trả về thông tin các tác giả từ bảng assignments
- [x] 2.5 Cập nhật logic kiểm tra quyền trong `PUT /api/syllabi/:id` (chỉ cho phép tác giả được phân công soạn)

## 3. Giao diện Quản lý (Admin UI)

- [x] 3.1 Cập nhật `public/js/pages/users.js`: Thêm cột Đơn vị và dropdown chọn Đơn vị khi tạo/sửa user
- [x] 3.2 Cập nhật `public/js/pages/version-editor.js`: Thêm nút "Phân công" và modal chọn giảng viên trong tab Đề cương
- [x] 3.3 Tích hợp logic lọc giảng viên theo đơn vị trong modal phân công (Trưởng ngành chỉ thấy người cùng ngành)

## 4. Giao diện Giảng viên (Faculty UI)

- [x] 4.1 Cập nhật `public/js/app.js`: Thêm mục "Đề cương của tôi" vào sidebar (điều kiện hiển thị: role Giảng viên)
- [x] 4.2 Tạo file `public/js/pages/my-syllabi.js` để hiển thị danh sách các đề cương được phân công
- [x] 4.3 Cập nhật `public/index.html` để nạp file JS mới của trang Đề cương của tôi

## 5. Luồng Phê duyệt & Kiểm thử

- [x] 5.1 Cập nhật trạng thái đề cương trong `public/js/pages/syllabus-editor.js` để hỗ trợ luồng đa cấp
- [x] 5.2 Kiểm thử kịch bản: Giảng viên nộp bài -> Trưởng ngành duyệt -> BGH duyệt cuối
- [x] 5.3 Kiểm thử kịch bản: Giảng viên cố gắng soạn đề cương không được phân công (phải bị chặn)
