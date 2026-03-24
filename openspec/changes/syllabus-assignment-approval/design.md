## Context

Hệ thống quản lý CTDT hiện tại cho phép tạo đề cương nhưng chưa có cơ chế phân công giảng viên soạn thảo cụ thể. Mọi người dùng có quyền `syllabus.edit` đều có thể tạo đề cương. Cần một cơ chế kiểm soát dựa trên đối tượng (Object-level control) để giảng viên chỉ thấy và soạn những gì được giao.

## Goals / Non-Goals

**Goals:**
- Liên kết người dùng với một đơn vị quản lý (Khoa/Ngành).
- Cho phép phân công một hoặc nhiều giảng viên vào một đề cương môn học.
- Tạo trang "Đề cương của tôi" cho giảng viên để tập trung công việc.
- Cập nhật logic phê duyệt đa cấp.

**Non-Goals:**
- Thay đổi cấu trúc bảng `departments`.
- Thay đổi cách thức soạn thảo nội dung (JSON) trong Syllabus Editor.

## Decisions

### 1. Cấu trúc dữ liệu người dùng
- **Quyết định**: Thêm cột `department_id` vào bảng `users`.
- **Lý do**: Mặc dù một người có thể dạy nhiều môn ở nhiều khoa, nhưng mỗi người thường thuộc về một đơn vị quản lý hành chính cố định. Điều này giúp lọc danh sách giảng viên khi Trưởng ngành thực hiện phân công.

### 2. Quản lý phân công (Assignments)
- **Quyết định**: Tạo bảng mới `syllabus_assignments` (id, syllabus_id, user_id).
- **Lý do**: Hỗ trợ trường hợp nhiều giảng viên cùng hợp tác soạn thảo một đề cương. Việc gán trực tiếp vào `version_syllabi.author_id` sẽ bị giới hạn ở 1 người.

### 3. Logic hiển thị tại Sidebar
- **Quyết định**: Thêm mục menu "Đề cương của tôi" chỉ hiển thị khi người dùng có vai trò là Giảng viên hoặc được gán ít nhất một đề cương.
- **Lý do**: Giúp giảng viên nhanh chóng truy cập công việc mà không cần đi qua danh mục CTDT phức tạp.

### 4. Logic phê duyệt
- **Quyết định**: Sử dụng bảng `approval_logs` hiện có nhưng định nghĩa lại các bước (steps) tương ứng với trạng thái của đề cương.

## Risks / Trade-offs

- **[Risk]** Giảng viên chuyển công tác giữa các khoa. → **Mitigation**: Cập nhật `department_id` trong trang Quản lý người dùng; các phân công cũ vẫn giữ nguyên vì dựa trên `user_id`.
- **[Trade-off]** Việc cho phép nhiều người soạn chung một đề cương có thể dẫn đến xung đột khi lưu. → **Mitigation**: Trong giai đoạn này, hệ thống chỉ hỗ trợ ghi đè (last write wins), sẽ bổ sung cảnh báo "Người khác đang soạn" ở các phiên bản sau.
