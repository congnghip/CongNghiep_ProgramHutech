## Why

Quá trình triển khai tính năng Phân công soạn đề cương gặp lỗi crash UI (`filteredUsers.map is not a function`) do API `/api/users` yêu cầu quyền Admin. Ngoài ra, vai trò Trưởng ngành và Ban giám hiệu đang thiếu quyền `syllabus.assign` để thực hiện thao tác.

## What Changes

- **Cập nhật RBAC**: Gán bổ sung quyền `syllabus.assign` cho các vai trò `TRUONG_NGANH` và `BAN_GIAM_HIEU`.
- **API Mới**: Tạo API `/api/users/assignable` cho phép lấy danh sách giảng viên phù hợp với phạm vi quản lý của người dùng trên đúng ngành của đề cương đang thao tác (`TRUONG_NGANH` và `LANH_DAO_KHOA` chỉ thấy người trong ngành hiện tại; `PHONG_DAO_TAO` và `BAN_GIAM_HIEU` thấy toàn trường).
- **Frontend Refactor**: Chuyển sang sử dụng API mới trong modal phân công và thêm cơ chế kiểm tra dữ liệu để tránh crash.

## Capabilities

### New Capabilities
- `assignable-users-api`: API cung cấp danh sách người dùng có thể được phân công dựa trên vai trò người gọi.

### Modified Capabilities
- `syllabus-assignment`: Cập nhật yêu cầu về quyền hạn thực hiện phân công cho các vai trò bổ sung.

## Impact

- **Database**: Cập nhật hàm gán quyền (seed data) trong `db.js`.
- **Backend**: Thêm endpoint mới và logic lọc trong `server.js`.
- **Frontend**: Cập nhật logic gọi API trong `version-editor.js`.
