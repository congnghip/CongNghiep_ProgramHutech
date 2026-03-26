# Design: Bỏ phân quyền "Soạn thảo chi tiết" CTĐT

**Ngày:** 2026-03-26
**Mục tiêu:** Xóa 5 quyền granular CTĐT, thay bằng quyền `programs.edit` duy nhất. Giữ nguyên quyền đề cương.

## Bối cảnh

Hiện tại có 5 quyền "soạn thảo chi tiết" kiểm soát việc chỉnh sửa từng phần nội dung phiên bản CTĐT:

| Code | Mô tả |
|------|--------|
| `programs.po.edit` | Chỉnh sửa Mục tiêu PO |
| `programs.plo.edit` | Chỉnh sửa Chuẩn đầu ra PLO & PI |
| `programs.courses.edit` | Chỉnh sửa Học phần & Kế hoạch GD |
| `programs.matrix.edit` | Chỉnh sửa Ma trận liên kết |
| `programs.assessment.edit` | Chỉnh sửa Đánh giá CĐR |

Yêu cầu: Ai có quyền `programs.edit` thì chỉnh sửa được tất cả nội dung CTĐT. Quyền đề cương (`syllabus.edit`) giữ nguyên.

## Thay đổi

### 1. `db.js` — Seed data

- Xóa 5 dòng permission granular khỏi mảng `perms` (dòng 394-399, module `programs_granular`)
- Xóa biến `ctDtGranular` (dòng 425)
- Bỏ `...ctDtGranular` khỏi role mappings: `LANH_DAO_KHOA` (dòng 429), `PHONG_DAO_TAO` (dòng 430), `ADMIN` (dòng 432)
- Thêm lệnh cleanup: `DELETE FROM permissions WHERE module = 'programs_granular'` (tương tự pattern đã có cho module `plo` và `rbac`)
- Cập nhật comment số lượng: 36 → 31

### 2. `server.js` — Backend routes (17 chỗ)

Tất cả `requireDraft('vId', 'programs.*.edit')` → `requireDraft('vId')` (default là `programs.edit`).
Tất cả `checkVersionEditAccess(userId, vId, 'programs.*.edit')` → `checkVersionEditAccess(userId, vId)` (default là `programs.edit`).

Danh sách routes bị ảnh hưởng:

**PO (Objectives):**
- Dòng 745: `POST /api/versions/:vId/objectives` — `requireDraft('vId', 'programs.po.edit')` → `requireDraft('vId')`
- Dòng 761: `PUT /api/objectives/:id` — `checkVersionEditAccess(..., 'programs.po.edit')` → bỏ param
- Dòng 775: `DELETE /api/objectives/:id` — tương tự

**PLO:**
- Dòng 805: `POST /api/versions/:vId/plos` — `checkVersionEditAccess(..., 'programs.plo.edit')` → bỏ param
- Dòng 819: `PUT /api/plos/:id` — tương tự
- Dòng 833: `DELETE /api/plos/:id` — tương tự

**PI:**
- Dòng 848: `POST /api/plos/:ploId/pis` — `checkVersionEditAccess(..., 'programs.plo.edit')` → bỏ param
- Dòng 889: `PUT /api/pis/:id` — tương tự
- Dòng 923: `DELETE /api/pis/:id` — tương tự

**Courses:**
- Dòng 1024: `POST /api/versions/:vId/courses` — `requireDraft('vId', 'programs.courses.edit')` → `requireDraft('vId')`
- Dòng 1040: `PUT /api/version-courses/:id` — `checkVersionEditAccess(..., 'programs.courses.edit')` → bỏ param
- Dòng 1054: `DELETE /api/version-courses/:id` — tương tự

**Matrices:**
- Dòng 1069: `PUT /api/versions/:vId/po-plo-map` — `requireDraft('vId', 'programs.matrix.edit')` → `requireDraft('vId')`
- Dòng 1088: `PUT /api/versions/:vId/course-plo-map` — tương tự
- Dòng 1122: `PUT /api/versions/:vId/course-pi-map` — tương tự

**Assessments:**
- Dòng 1156: `POST /api/versions/:vId/assessments` — `requireDraft('vId', 'programs.assessment.edit')` → `requireDraft('vId')`
- Dòng 1172: `DELETE /api/assessments/:id` — `checkVersionEditAccess(..., 'programs.assessment.edit')` → bỏ param

Hàm `checkVersionEditAccess` và `requireDraft` KHÔNG cần sửa — default đã là `'programs.edit'`.

### 3. `public/js/pages/version-editor.js` — Frontend tabs (dòng 7-21)

Xóa thuộc tính `editPerm` khỏi tất cả tab CTĐT. Giữ nguyên `editPerm: 'syllabus.edit'` cho tab Đề cương.

Trước:
```js
{ key: 'po', label: 'Mục tiêu PO', viewPerm: 'programs.view_published', editPerm: 'programs.po.edit' },
```

Sau:
```js
{ key: 'po', label: 'Mục tiêu PO', viewPerm: 'programs.view_published' },
```

Logic `tabEditable` (dòng 125) vẫn hoạt động đúng: `(!tab.editPerm || window.App.hasPerm(tab.editPerm))` — khi không có `editPerm`, điều kiện luôn true → chỉ cần `canEditStatus` (tức `programs.edit` hoặc quyền phê duyệt theo status).

### 4. `public/js/app.js` — `hasPerm()` (dòng 27-37)

Bỏ logic hierarchy `programs.*.edit` vì không còn tồn tại. Giữ logic cho `programs.view_*`.

Trước:
```js
const isEditPerm = (code.startsWith('programs.') && code.endsWith('.edit')) || code === 'syllabus.edit';
const isViewPerm = code === 'programs.view_published' || code === 'programs.view_draft';
if (isEditPerm || isViewPerm) {
  return this.userPerms.includes('programs.edit');
}
```

Sau:
```js
const isViewPerm = code === 'programs.view_published' || code === 'programs.view_draft';
if (isViewPerm) {
  return this.userPerms.includes('programs.edit');
}
```

### 5. `public/js/pages/rbac-admin.js` — RBAC admin UI (dòng 383)

Xóa dòng: `programs_granular: 'CTĐT (Soạn thảo chi tiết)',`

## Không thay đổi

- Quyền `syllabus.edit` và tất cả quyền syllabus — giữ nguyên
- Hàm `checkVersionEditAccess` — giữ nguyên (default đã đúng)
- Hàm `requireDraft` — giữ nguyên (default đã đúng)
- Workflow phê duyệt — giữ nguyên
- Logic admin bypass — giữ nguyên
