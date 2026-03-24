## 1. Chuẩn bị Dữ liệu & Database

- [x] 1.1 Cập nhật `seedData` trong `db.js` để tạo cấu trúc mẫu: Khoa CNTT có 2 Ngành con (Công nghệ thông tin, Trí tuệ nhân tạo).
- [x] 1.2 Viết hàm SQL đệ quy (CTE) để lấy danh sách ID phòng ban con trong `db.js`.
- [x] 1.3 Nâng cấp hàm `hasPermission` trong `db.js` để sử dụng logic đệ quy kiểm tra quyền theo cấp bậc.

## 2. Backend API & Phân quyền

- [x] 2.1 Cập nhật API `GET /api/programs` để lọc dữ liệu dựa trên Department ID của người dùng (nếu level < 4).
- [x] 2.2 Cập nhật API `POST /api/programs` để kiểm tra quyền tạo CTĐT đúng tại đơn vị (Ngành) được gán.
- [x] 2.3 Cập nhật middleware `requirePerm` hoặc logic kiểm tra quyền trong các route liên quan đến `entity_id`.

## 3. Frontend: Giao diện Gán quyền (RBAC)

- [x] 3.1 Cập nhật `public/js/pages/users.js`: Thêm logic Cascading Select trong `openRoleModal` (Chọn Khoa -> Load Ngành).
- [x] 3.2 Cập nhật `public/js/pages/rbac-admin.js`: Hiển thị tên Khoa-Ngành trong danh sách người dùng.
- [x] 3.3 Đảm bảo khi lưu (`assignRole`), `department_id` của Ngành được gửi lên server.

## 4. Frontend: Giao diện Chương trình đào tạo

- [x] 4.1 Cập nhật `public/js/pages/programs.js`: Thêm logic Cascading Select trong modal tạo/sửa chương trình.
- [x] 4.2 Cập nhật logic hiển thị bảng CTĐT: Thêm cột hiển thị thông tin Khoa quản lý (truy xuất từ parent của Ngành).

## 5. Kiểm thử & Hoàn thiện

- [x] 5.1 Tạo tài khoản mẫu cho Trưởng ngành và kiểm tra xem họ có chỉ thấy CTĐT của ngành đó không.
- [x] 5.2 Kiểm tra tài khoản Lãnh đạo khoa để đảm bảo thấy được tất cả CTĐT của các ngành trực thuộc.
- [x] 5.3 Kiểm tra tài khoản Admin/Phòng đào tạo để đảm bảo quyền truy cập toàn cục không bị ảnh hưởng.
