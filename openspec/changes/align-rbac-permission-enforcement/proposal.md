## Why

Ma trận quyền hiện tại đã seed đủ 37 quyền nhưng enforcement chưa nhất quán giữa frontend, backend, và semantics của từng capability. Kết quả là có 11 quyền đang lệch ý đồ thiết kế: một số quyền chỉ ẩn nút ở UI, một số capability có thật nhưng backend đang kiểm tra sai mã quyền, và một số quyền chỉ tồn tại trong ma trận mà chưa có contract hành vi rõ ràng.

## What Changes

- Chuẩn hóa một nguồn sự thật cho 37 quyền seed: mỗi quyền phải được phân loại rõ là quyền được enforce ở backend, quyền dùng cho capability chưa triển khai, hay quyền bị loại bỏ/gộp vào quyền khác.
- Đồng bộ enforcement cho 3 quyền đang chặn giả bằng UI: `programs.submit`, `courses.view`, `rbac.view_audit_logs`.
- Sửa mapping semantics cho 4 quyền đang đi sai hướng trong code: `programs.export`, `programs.import_word`, `syllabus.view`, `syllabus.create`.
- Xác định contract sản phẩm cho 4 quyền dormant: `programs.manage_all`, `portfolio.own`, `portfolio.view_dept`, `rbac.system_config`, bao gồm giữ lại như capability có roadmap hay loại khỏi ma trận hiện hành.
- Bổ sung kiểm kê và quy tắc review để route mới không tiếp tục dùng quyền sai mã hoặc chỉ chặn ở frontend. **BREAKING** đối với một số API đọc/ghi hiện đang mở rộng hơn ma trận quyền dự kiến.

## Capabilities

### New Capabilities
- `permission-enforcement-matrix`: Quy định cách 37 quyền seed được phân loại, enforce, và kiểm tra nhất quán giữa UI, backend, và role matrix.
- `audit-access-control`: Quy định quyền truy cập nhật ký hệ thống và thống kê vận hành có chứa dữ liệu nhạy cảm nội bộ.
- `course-catalog-access`: Quy định quyền xem danh mục học phần và cách route đọc học phần phải tuân thủ `courses.view`.

### Modified Capabilities
- `training-program-management`: Điều chỉnh semantics cho submit, export, import Word, và quyền quản trị CTDT toàn trường.
- `syllabus-workflow`: Điều chỉnh semantics cho xem, tạo, sửa, nộp, và phân công đề cương theo đúng mã quyền.
- `docx-import-wizard`: Ràng buộc quyền khởi tạo luồng import với permission import phù hợp thay vì kế thừa ngầm từ quyền tạo CTĐT.

## Impact

- **Backend:** `server.js` cần chuẩn hóa middleware/handler cho các route submit, export, import, course catalog, audit logs, dashboard stats, và các route liên quan syllabus.
- **Frontend:** `public/js/app.js`, `public/js/pages/version-editor.js`, `public/js/pages/courses.js`, `public/js/pages/audit-logs.js`, và các màn hình liên quan cần đồng bộ với semantics quyền mới thay vì chỉ ẩn nút.
- **RBAC / Documentation:** `db.js` role-permission matrix, tài liệu OpenSpec, và checklist review route mới cần được cập nhật để phản ánh trạng thái thật của 37 quyền.
