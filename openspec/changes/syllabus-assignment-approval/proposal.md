## Why

Hiện tại, hệ thống chưa có cơ chế phân công giảng viên soạn thảo đề cương một cách linh hoạt. Việc phân quyền soạn thảo cần được số hóa để đảm bảo giảng viên chỉ thao tác trên các môn được giao, đồng thời hỗ trợ Trưởng ngành và Ban giám hiệu/Phòng Đào tạo quản lý việc phân công cho cả giảng viên trong và ngoài khoa.

## What Changes

- **Quản lý Đơn vị Người dùng**: Bổ sung thông tin đơn vị (Department) cho người dùng để hỗ trợ logic lọc giảng viên theo Ngành/Khoa.
- **Cơ chế Phân công (Syllabus Assignment)**: Cho phép Trưởng ngành gán giảng viên vào các môn học trong một phiên bản CTDT. Hỗ trợ gán nhiều giảng viên cho một môn.
- **Giao diện Giảng viên**: Thêm mục "Đề cương của tôi" vào sidebar. Giảng viên chỉ thấy các đề cương mình được phân công để soạn thảo và theo dõi trạng thái.
- **Luồng Phê duyệt Đề cương**: Thiết lập quy trình duyệt đi từ Giảng viên -> Trưởng ngành -> Lãnh đạo Khoa -> Ban giám hiệu.

## Capabilities

### New Capabilities
- `syllabus-assignment`: Quản lý việc gán giảng viên vào các đề cương môn học trong từng phiên bản.
- `syllabus-workflow`: Cơ chế chuyển đổi trạng thái đề cương (Draft, Submitted, Approved, Published) và phân quyền duyệt theo cấp bậc.
- `user-department-management`: Quản lý mối quan hệ giữa người dùng và đơn vị (Khoa/Ngành) để phục vụ phân quyền.

### Modified Capabilities
- `rbac-admin`: Cập nhật giao diện quản lý người dùng để gán đơn vị.
- `version-management`: Thêm tính năng phân công giảng viên trong tab Đề cương của Version Editor.

## Impact

- **Database**: Cập nhật bảng `users` (thêm `department_id`) và tạo bảng mới `syllabus_assignments`.
- **Backend**: Thêm các API phân công (`/api/assignments`), cập nhật logic API đề cương để kiểm tra quyền tác giả.
- **Frontend**: Cập nhật `app.js` (sidebar), `version-editor.js` (UI phân công), và tạo trang quản lý đề cương cá nhân cho giảng viên.
