# Design: Chỉnh sửa trực tiếp 3 tab Học phần, Mô tả HP, Kế hoạch GD

**Ngày:** 2026-03-26
**Mục tiêu:** Thêm chức năng chỉnh sửa inline cho 3 tab trong version editor: Học phần (LT, TH, ĐA, TT, HK), Mô tả HP (description), Kế hoạch GD (tất cả trường).

## Bối cảnh

Hiện tại:
- **Học phần**: Chỉ có thêm/xóa HP. Không có UI sửa LT, TH, ĐA, TT, HK.
- **Mô tả HP**: Hoàn toàn read-only. Mô tả lấy từ bảng `courses` master.
- **Kế hoạch GD**: Hoàn toàn read-only. Chỉ nhập qua import Word. Dữ liệu từ bảng `teaching_plan`.

Yêu cầu: Sửa trực tiếp vào bảng master (`courses` và `teaching_plan`). Ai có quyền chỉnh sửa CTĐT (`programs.edit`) thì sửa được.

## Vấn đề phân quyền

Route `PUT /api/courses/:id` hiện có yêu cầu quyền `courses.edit`. Tuy nhiên, vai trò LANH_DAO_KHOA có `programs.edit` nhưng KHÔNG có `courses.edit`. Để cho phép sửa từ trong version editor, cần tạo endpoint riêng kiểm tra quyền chỉnh sửa CTĐT (qua `checkVersionEditAccess`) thay vì `courses.edit`.

## Thay đổi

### 1. Backend — server.js

#### 1a. Tạo route mới: `PUT /api/version-courses/:id/course-info`

Cho phép sửa thông tin course master (LT, TH, ĐA, TT, description) từ bối cảnh version editor. Kiểm tra quyền qua `checkVersionEditAccess` (cần `programs.edit` cho draft).

```
PUT /api/version-courses/:id/course-info
Auth: checkVersionEditAccess(userId, version_id)
Body: { credits_theory, credits_practice, credits_project, credits_internship, description }
Action: UPDATE courses SET ... WHERE id = (SELECT course_id FROM version_courses WHERE id = :id)
```

#### 1b. Cập nhật route: `PUT /api/version-courses/:id`

Route đã có, chấp nhận `{ semester, course_type }`. Chỉ cần đảm bảo frontend gọi đúng.

#### 1c. Tạo route mới: `POST /api/versions/:vId/teaching-plan`

Tạo hoặc cập nhật record teaching_plan cho 1 HP.

```
POST /api/versions/:vId/teaching-plan
Auth: requireDraft('vId')
Body: { version_course_id, hours_theory, hours_practice, hours_project, hours_internship, software, managing_dept, batch, notes }
Action: INSERT INTO teaching_plan ... ON CONFLICT (version_course_id) DO UPDATE SET ...
```

Lưu ý: cần thêm UNIQUE constraint cho `version_course_id` trong bảng `teaching_plan` để hỗ trợ upsert.

#### 1d. Tạo route mới: `PUT /api/teaching-plan/:id`

Sửa record teaching_plan đã có.

```
PUT /api/teaching-plan/:id
Auth: checkVersionEditAccess(userId, version_id từ teaching_plan → version_courses)
Body: { hours_theory, hours_practice, hours_project, hours_internship, software, managing_dept, batch, notes }
Action: UPDATE teaching_plan SET ... WHERE id = :id
```

### 2. Database — db.js

Thêm UNIQUE constraint cho `teaching_plan.version_course_id`:

```sql
ALTER TABLE teaching_plan ADD CONSTRAINT IF NOT EXISTS teaching_plan_version_course_id_unique UNIQUE (version_course_id);
```

### 3. Frontend — version-editor.js

#### 3a. Tab Học phần (`renderCoursesTab`)

Khi `editable = true`:
- Cột LT, TH, ĐA, TT → hiển thị `<input type="number">` thay vì text
- Cột HK → hiển thị `<input type="number">` thay vì text
- Thêm nút "Lưu" mỗi hàng
- Click "Lưu":
  - Gọi `PUT /api/version-courses/:id/course-info` với `{ credits_theory, credits_practice, credits_project, credits_internship }`
  - Gọi `PUT /api/version-courses/:id` với `{ semester }` (nếu HK thay đổi)

#### 3b. Tab Mô tả HP (`renderDescriptionsTab`)

Khi `editable = true`:
- Cột mô tả → hiển thị `<textarea>` thay vì text
- Thêm nút "Lưu" mỗi hàng
- Click "Lưu": Gọi `PUT /api/version-courses/:id/course-info` với `{ description }`

#### 3c. Tab Kế hoạch GD (`renderPlanTab`)

Khi `editable = true`:
- Tất cả cột → hiển thị input tương ứng (number cho giờ, text cho phần mềm/đơn vị/đợt/ghi chú)
- Thêm nút "Lưu" mỗi hàng
- Click "Lưu":
  - Nếu chưa có teaching_plan record → `POST /api/versions/:vId/teaching-plan`
  - Nếu đã có → `PUT /api/teaching-plan/:id`

## Không thay đổi

- Quyền `courses.edit` cho trang quản lý danh mục HP riêng — giữ nguyên
- Chức năng thêm/xóa HP trên tab Học phần — giữ nguyên
- Import Word — giữ nguyên
- Các tab khác — giữ nguyên
