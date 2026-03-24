## Context

Hiện tại, việc phân công giảng viên sử dụng API `/api/users` vốn yêu cầu quyền quản trị hệ thống (`rbac.manage_users`). Điều này khiến Trưởng ngành và Ban giám hiệu (không có quyền admin) bị chặn truy cập dữ liệu, dẫn đến crash Frontend và không thể thực hiện phân công. Ngoài ra, vai trò Trưởng ngành và BGH cũng đang thiếu quyền hạn cần thiết trong cấu trúc RBAC hiện tại.

## Goals / Non-Goals

**Goals:**
- Khắc phục lỗi crash UI bằng cách cung cấp dữ liệu hợp lệ cho người dùng không phải admin.
- Cập nhật quyền hạn RBAC để cho phép Trưởng ngành và BGH thực hiện phân công.
- Tăng cường bảo mật bằng cách hạn chế thông tin trả về của danh sách người dùng cho mục đích phân công.

**Non-Goals:**
- Thay đổi cấu trúc cơ bản của bảng `users`.
- Cấp quyền quản lý tài khoản (`rbac.manage_users`) cho Trưởng ngành.

## Decisions

### 1. Phân quyền (RBAC)
- **Quyết định**: Bổ sung `syllabus.assign` vào danh sách quyền của `TRUONG_NGANH` và `BAN_GIAM_HIEU` trong `db.js`.
- **Lý do**: Đảm bảo Backend không chặn các yêu cầu `POST /api/assignments` từ các vai trò này.

### 2. API Endpoint mới: `/api/users/assignable`
- **Quyết định**: Tạo endpoint riêng thay vì dùng chung `/api/users`, và endpoint nhận ngữ cảnh đề cương đang phân công qua `syllabus_id`.
- **Lý do**: 
    - Cô lập logic lọc dữ liệu theo phạm vi quản lý.
    - Cho phép người dùng bình thường truy cập thông tin tối thiểu của đồng nghiệp để phân công mà không cần quyền Admin.
    - Giảm thiểu rủi ro lộ thông tin nhạy cảm (email, password hash, status).
    - Đảm bảo `LANH_DAO_KHOA` khi vào một ngành cụ thể vẫn chỉ được phân công trong đúng ngành đó thay vì toàn khoa.

### 3. Logic xử lý Frontend
- **Quyết định**: Cập nhật `window.VersionEditorPage.openAssignModal` để gọi API mới và thêm kiểm tra `Array.isArray()`.
- **Lý do**: Ngăn chặn lỗi crash trang web trong trường hợp API trả về lỗi hoặc cấu trúc không mong muốn.

## Risks / Trade-offs

- **[Risk]** Người dùng có thể lợi dụng API mới để thu thập danh sách đồng nghiệp. → **Mitigation**: Chỉ trả về các trường công khai (`id`, `display_name`, `username`) và chỉ cho phép người có quyền `syllabus.assign` truy cập.
- **[Risk]** Phạm vi phân công bị tính sai nếu chỉ dựa trên role level. → **Mitigation**: Backend phải xác định ngành của đề cương đang thao tác và kiểm quyền/scope trên đúng ngành đó.
