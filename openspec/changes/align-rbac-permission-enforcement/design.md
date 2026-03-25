## Context

Hệ thống hiện có một ma trận 37 quyền được seed trong `db.js`, nhưng enforcement đang bị phân tán qua ba lớp khác nhau:
- frontend dùng `hasPerm()` và `hasRole()` để ẩn menu/nút;
- backend dùng `requirePerm()`, `requireViewVersion()`, `requireViewSyllabus()`, `checkVersionEditAccess()` và một số kiểm tra thủ công trong handler;
- một số capability đang dùng quyền “gần đúng” thay vì đúng mã quyền đã được khai báo trong role matrix.

Kết quả audit cho thấy 11 quyền đang lệch:
- 3 quyền `ui_only`: `programs.submit`, `courses.view`, `rbac.view_audit_logs`;
- 4 quyền `wrong_mapping`: `programs.export`, `programs.import_word`, `syllabus.view`, `syllabus.create`;
- 4 quyền `dormant`: `programs.manage_all`, `portfolio.own`, `portfolio.view_dept`, `rbac.system_config`.

Thay đổi này là cross-cutting vì cùng lúc đụng tới semantics của ma trận quyền, backend route guards, và frontend navigation/UI gating.

## Goals / Non-Goals

**Goals:**
- Thiết lập một taxonomy rõ ràng cho toàn bộ 37 quyền: `healthy`, `ui_only`, `wrong_mapping`, hoặc `dormant`.
- Chuyển các capability đang bị chặn giả sang enforcement backend thực thụ.
- Đồng bộ lại các route đang kiểm tra sai mã quyền với semantics của role matrix.
- Xác định contract rõ ràng cho các quyền dormant để tránh tiếp tục seed “quyền ma”.
- Giữ cho frontend chỉ đóng vai trò phản ánh quyền, không trở thành lớp bảo vệ chính.

**Non-Goals:**
- Không thay đổi cấu trúc bảng `roles`, `permissions`, `role_permissions`, hoặc `user_roles`.
- Không thiết kế lại toàn bộ RBAC hierarchy đã được chốt trong thay đổi `hierarchical-department-rbac`.
- Không mở rộng thêm capability portfolio hoặc system configuration trong cùng change này; chỉ chốt trạng thái và contract của các quyền liên quan.
- Không xử lý toàn bộ các lỗ route ngoài phạm vi 11 quyền lệch, trừ khi việc chuẩn hóa quyền buộc phải đụng vào chúng.

## Decisions

### 1. Dùng backend enforcement làm nguồn sự thật duy nhất cho permission checks
**Quyết định:** Mọi quyền được xem là “active” trong ma trận phải được enforce ở backend bằng đúng mã quyền hoặc thông qua một mapping helper được chuẩn hóa và audit được.
**Lý do:** `checkPermissions()` ở frontend chỉ `display:none`, nên không đủ để bảo vệ route hoặc dữ liệu nhạy cảm.
**Lựa chọn thay thế:** Tiếp tục để UI ẩn nút và chỉ vá từng lỗ riêng lẻ. Cách này giữ hệ thống ở trạng thái “có vẻ có quyền” nhưng không chứng minh được enforcement thật.

### 2. Tạo một permission registry logic trong design/spec thay vì dựa vào suy luận rải rác trong code
**Quyết định:** Mỗi quyền được gắn một trạng thái chuẩn:
- `enforced`: phải có backend check rõ ràng;
- `mapped`: capability đang tồn tại nhưng route dùng helper/mapping hợp lệ;
- `dormant`: chưa có capability thật, không được expose nhầm như quyền đang hoạt động.
**Lý do:** Đây là cách duy nhất để review 37 quyền có hệ thống, thay vì chỉ tìm chuỗi trong mã nguồn.
**Lựa chọn thay thế:** Chỉ sửa 11 quyền nghi vấn. Cách này nhanh hơn nhưng không để lại khung review cho các route mới.

### 3. Tách “permission semantics” khỏi “workflow/status checks”
**Quyết định:** Các route workflow như submit/review phải kiểm tra cả hai mặt:
- quyền tương ứng (`programs.submit`, `syllabus.submit`, quyền approve theo cấp);
- điều kiện trạng thái (`draft`, `submitted`, `approved_*`).
**Lý do:** Nhiều bug hiện tại đến từ việc code chỉ check trạng thái mà không check permission tương ứng, hoặc ngược lại.
**Lựa chọn thay thế:** Gộp permission vào logic trạng thái. Điều này làm semantics khó đọc và khiến matrix quyền mất ý nghĩa.

### 4. Chuẩn hóa “wrong mapping” theo nguyên tắc route phải dùng đúng quyền khai báo trong ma trận, trừ khi spec nói rõ quyền đó là alias
**Quyết định:** Các capability `export`, `import_word`, `syllabus.view`, `syllabus.create` sẽ được viết lại spec để route backend dùng đúng mã quyền, thay vì piggyback lên quyền khác.
**Lý do:** Khi role matrix đã seed quyền riêng mà code không dùng, người đọc sẽ hiểu sai policy thực tế và rất khó audit.
**Lựa chọn thay thế:** Chính thức gộp các quyền này vào quyền khác và xóa khỏi matrix. Chỉ nên làm nếu sản phẩm thật sự không cần tách quyền.

### 5. Giữ dormant permissions nhưng bắt buộc phải có contract “không active”
**Quyết định:** Các quyền `programs.manage_all`, `portfolio.*`, `rbac.system_config` không bị xóa ngay trong design này, nhưng spec phải buộc hệ thống đánh dấu rõ là chưa active hoặc chưa có capability triển khai.
**Lý do:** Một số quyền có vẻ là roadmap hợp lệ, đặc biệt `programs.manage_all`. Loại bỏ ngay có thể gây mất ý đồ sản phẩm.
**Lựa chọn thay thế:** Xóa thẳng các quyền dormant khỏi seed matrix. Cách này sạch hơn nhưng cần quyết định sản phẩm mạnh tay hơn trong một change riêng.

### 6. Bảo vệ dữ liệu nhạy cảm nội bộ bằng permission chuyên biệt thay vì “đã đăng nhập là xem được”
**Quyết định:** Audit logs và dashboard sections chứa hoạt động hệ thống phải đi qua `rbac.view_audit_logs` hoặc một policy tương đương được nêu rõ trong spec.
**Lý do:** Nhật ký thao tác và recent activity là dữ liệu nội bộ có mức nhạy cảm cao hơn dữ liệu nghiệp vụ thông thường.
**Lựa chọn thay thế:** Giữ chế độ open cho mọi user đăng nhập. Cách này mâu thuẫn với sự tồn tại của `rbac.view_audit_logs`.

## Risks / Trade-offs

- **[Risk] Thay đổi enforcement có thể làm một số role đang “quen dùng được” bị mất quyền truy cập.** → **Mitigation:** Ghi rõ các route/API nào là breaking trong spec và tasks; kiểm thử bằng role matrix hiện hành trước khi merge.
- **[Risk] Một số quyền dormant có thể chưa có quyết định sản phẩm cuối cùng.** → **Mitigation:** Giữ open questions rõ ràng và cho phép implement theo chế độ “documented dormant” thay vì ép kích hoạt capability mới.
- **[Risk] Route hiện dùng nhiều helper khác nhau, vá từng nơi có thể tạo policy không đồng nhất.** → **Mitigation:** Tạo checklist/registry kiểm tra 37 quyền để review tập trung, thay vì sửa rời rạc theo file.
- **[Trade-off] Dùng đúng mã quyền làm code dài hơn và bớt “tiện tay” hơn piggyback.** → **Mitigation:** Chấp nhận verbosity nhỏ để đổi lấy khả năng audit và bảo trì lâu dài.

## Migration Plan

1. Chốt spec cho 11 quyền lệch và phân loại đủ 37 quyền.
2. Cập nhật backend guards theo từng capability, ưu tiên `ui_only` trước.
3. Đồng bộ frontend menu/nút với semantics backend mới, bỏ các chỗ chỉ ẩn nút nếu route chưa được khóa thật.
4. Kiểm thử theo role matrix hiện tại cho 6 role hệ thống.
5. Khi rollout, thông báo rõ các API đọc/ghi nào trở nên chặt hơn để tránh nhầm là regression.
6. Nếu phát hiện dormant permission cần kích hoạt thành capability thật, tách sang change tiếp theo thay vì mở rộng scope giữa chừng.

## Open Questions

- `programs.manage_all` có phải là quyền bypass scoping chính thức cho `PHONG_DAO_TAO` và `ADMIN`, hay chỉ là placeholder cũ chưa được dùng?
- `syllabus.create` có cần tồn tại riêng với `syllabus.edit`, hay hệ thống muốn gộp hai quyền này về mặt sản phẩm?
- `programs.export` và `programs.import_word` có cần UI entry point riêng theo role, hay chỉ cần backend enforce để giữ semantics?
- Dashboard có nên tách phần “recent activity / internal metrics” ra khỏi thống kê nghiệp vụ công khai nội bộ, hay toàn bộ `/api/dashboard/stats` phải đi theo `rbac.view_audit_logs`?
