## Context

Hệ thống hiện tại có cấu trúc bảng `departments` hỗ trợ `parent_id` nhưng logic phân quyền và lọc dữ liệu chưa khai thác quan hệ này. Vai trò Trưởng ngành đang bị hiểu nhầm là có quyền hạn tương đương một cấp của Khoa hoặc không có đơn vị đại diện cụ thể (Ngành con).

## Goals / Non-Goals

**Goals:**
- Triển khai thành công cấu trúc phân cấp Khoa -> Ngành trong Database và UI.
- Cập nhật logic phân quyền để người ở cấp Khoa tự động có quyền ở các Ngành trực thuộc.
- Giới hạn phạm vi dữ liệu (Data Scoping) của Trưởng ngành chỉ trong Ngành của họ.
- Cải thiện trải nghiệm người dùng (UX) khi chọn đơn vị thông qua Cascading Select.

**Non-Goals:**
- Không thay đổi cấu trúc bảng `user_roles` hay `roles`.
- Không thay đổi luồng phê duyệt (Approval Workflow) của Phòng đào tạo và Ban giám hiệu.

## Decisions

### 1. SQL Đệ quy cho kiểm tra quyền (Hierarchical RBAC)
**Quyết định:** Nâng cấp hàm `hasPermission` trong `db.js` để sử dụng Common Table Expression (CTE) của PostgreSQL nhằm tìm tất cả các đơn vị con.
**Lý do:** Cho phép Lãnh đạo Khoa quản lý được tất cả các Ngành con mà không cần gán quyền thủ công cho từng Ngành.
**Lựa chọn thay thế:** Lưu danh sách ID phòng ban vào JWT (gây phình to token) hoặc kiểm tra bằng code JS (chậm hơn SQL).

### 2. Tự động lọc API theo phạm vi người dùng (Automatic Scoping)
**Quyết định:** Cập nhật middleware hoặc logic trong `GET /api/programs` để tự động thêm điều kiện `WHERE department_id = ANY(user_allowed_depts)`.
**Lý do:** Đảm bảo an toàn dữ liệu ngay từ tầng API, ngăn chặn Trưởng ngành này xem CTĐT của ngành khác thông qua URL.

### 3. Thành phần Giao diện "Khoa-Ngành" liên kết (Cascading UI)
**Quyết định:** Xây dựng logic chọn Khoa sau đó mới chọn Ngành trong các modal.
**Lý do:** Giúp người quản lý (Admin) gán đúng người vào đúng đơn vị, tránh danh sách dropdown quá dài và lộn xộn.

## Risks / Trade-offs

- **[Risk] Hiệu năng SQL:** Truy vấn đệ quy có thể chậm nếu cây thư mục quá lớn. → **Mitigation:** Cấu trúc Khoa-Ngành thực tế chỉ sâu 2-3 cấp, PostgreSQL xử lý cực nhanh ở quy mô này.
- **[Trade-off] Dữ liệu cũ:** Các CTĐT hiện tại đang gắn trực tiếp vào Khoa. → **Mitigation:** Cần một bước "dọn dẹp" (migration) để chuyển các CTĐT này về đúng ID của Ngành tương ứng.
