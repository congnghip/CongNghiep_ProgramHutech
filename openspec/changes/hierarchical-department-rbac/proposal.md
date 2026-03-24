## Why

Hiện tại, hệ thống phân quyền (RBAC) đang hoạt động ở mức độ "phẳng" tại các Khoa, chưa hỗ trợ phân cấp chi tiết đến từng "Ngành" trực thuộc Khoa. Điều này dẫn đến việc Trưởng ngành khi được gán quyền sẽ có quyền hạn trên toàn bộ Khoa hoặc không thể giới hạn phạm vi quản lý chỉ trong Ngành của mình. Việc bổ sung vai trò "Ngành" con của "Khoa" giúp chuẩn hóa quy trình quản lý Chương trình đào tạo (CTDT) và Đề cương chi tiết (Syllabus) đúng với thực tế tổ chức tại HUTECH.

## What Changes

- **Phân cấp Đơn vị (Department Hierarchy):** Chính thức áp dụng cấu trúc cha-con (Khoa -> Ngành) trong bảng `departments`.
- **Vai trò mới (New Roles):** Tách biệt và bổ sung vai trò Trưởng Ngành (giới hạn trong đơn vị Ngành) và Lãnh đạo Khoa (quản lý toàn bộ các Ngành thuộc Khoa).
- **Giao diện Gán quyền (RBAC UI):** Cập nhật modal gán vai trò để hỗ trợ chọn Khoa sau đó mới chọn Ngành (Cascading Select).
- **Giao diện Quản lý CTDT:** Thêm dropdown chọn Ngành khi tạo mới/chỉnh sửa CTDT, tự động lọc theo Khoa đã chọn.
- **Phạm vi truy cập dữ liệu (Data Scoping):** Cập nhật logic API để Trưởng Ngành chỉ thấy và thao tác được trên các CTDT thuộc Ngành của họ. **BREAKING** (Thay đổi logic lọc dữ liệu mặc định của API).

## Capabilities

### New Capabilities
- `hierarchical-rbac`: Cơ chế kiểm tra quyền kế thừa (Lãnh đạo Khoa có quyền trên các Ngành con).
- `cascading-dept-selection`: Thành phần giao diện chọn đơn vị theo cấp bậc (Khoa -> Ngành).
- `scoped-program-management`: Tự động lọc dữ liệu CTDT dựa trên đơn vị (Department ID) của người dùng.

### Modified Capabilities
- `rbac-admin`: Cập nhật giao diện quản lý người dùng và gán vai trò để hỗ trợ cấu trúc mới.

## Impact

- **Database:** Bảng `departments` cần được kiểm tra dữ liệu mẫu (seed data) để tạo quan hệ `parent_id`.
- **Backend:** Hàm `hasPermission` trong `db.js` và các API `GET /api/programs` cần cập nhật logic lọc.
- **Frontend:** Các file `users.js`, `programs.js` và `rbac-admin.js` cần cập nhật UI components.
