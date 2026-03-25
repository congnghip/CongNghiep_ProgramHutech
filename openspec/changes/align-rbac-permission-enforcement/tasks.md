## 1. Audit Baseline

- [ ] 1.1 Lập bảng kiểm kê 37 quyền seed với các cột: roles được gán, UI entry points, backend guards hiện tại, và trạng thái `healthy/ui_only/wrong_mapping/dormant`.
- [ ] 1.2 Chốt semantics chính thức cho 11 quyền lệch dựa trên design và specs của change này.
- [ ] 1.3 Ghi rõ các API, màn hình, và role bị ảnh hưởng bởi thay đổi enforcement để làm regression checklist.

## 2. Backend Enforcement Alignment

- [ ] 2.1 Thêm kiểm tra `programs.submit` cho luồng submit `program_version`.
- [ ] 2.2 Thêm kiểm tra `courses.view` cho route đọc danh mục học phần.
- [ ] 2.3 Thêm kiểm tra `rbac.view_audit_logs` cho API audit logs và phần activity nhạy cảm trong dashboard.
- [ ] 2.4 Chuyển export CTĐT sang dùng `programs.export` theo đúng scope.
- [ ] 2.5 Chuyển khởi tạo và commit import DOCX sang contract `programs.import_word`.
- [ ] 2.6 Chuyển xem đề cương sang semantics `syllabus.view` mà vẫn giữ ngoại lệ hợp lệ cho giảng viên được phân công.
- [ ] 2.7 Chuyển tạo đề cương sang dùng `syllabus.create` và giữ sửa đề cương ở `syllabus.edit`.
- [ ] 2.8 Quyết định và hiện thực semantics `programs.manage_all` như quyền bypass scope hoặc ghi rõ là dormant trong backend policy.

## 3. Frontend Permission Reflection

- [ ] 3.1 Đồng bộ sidebar/menu/nút với semantics backend mới để bỏ các chỗ chỉ ẩn nút mà route chưa khóa thật.
- [ ] 3.2 Cập nhật UI submit/export/import/course catalog/audit logs theo đúng mã quyền đã được chuẩn hóa.
- [ ] 3.3 Rà soát `hasPerm()` và các chỗ piggyback permission ở frontend để đảm bảo UI phản ánh policy mới thay vì tự suy diễn thêm quyền.

## 4. Dormant Permission Contracts

- [ ] 4.1 Gắn trạng thái rõ ràng cho `portfolio.own`, `portfolio.view_dept`, và `rbac.system_config` trong tài liệu/change notes để tránh bị hiểu là capability đang hoạt động.
- [ ] 4.2 Nếu giữ `programs.manage_all` ở trạng thái active, bổ sung kiểm thử và tài liệu cho semantics all-scope; nếu không, document hóa nó là dormant.
- [ ] 4.3 Bổ sung checklist review cho route/capability mới: không được thêm quyền seed mới mà thiếu backend enforcement hoặc dùng sai mã quyền.

## 5. Verification

- [ ] 5.1 Kiểm thử thủ công hoặc tự động cho 6 role hệ thống trên các capability bị ảnh hưởng bởi 11 quyền lệch.
- [ ] 5.2 Xác nhận 3 quyền `ui_only` đã không còn bypass được bằng request trực tiếp.
- [ ] 5.3 Xác nhận 4 quyền `wrong_mapping` đang được enforce bằng đúng mã quyền đã seed.
- [ ] 5.4 Xác nhận 4 quyền dormant được tài liệu hóa rõ ràng và không còn bị hiểu sai là capability hoạt động.
