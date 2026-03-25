# RBAC Route Review Checklist

Dung checklist nay moi khi them route moi hoac doi semantics quyen hien co.

## Permission Review Rules

- Route active theo ma quyen seed phai co enforcement o backend; khong duoc dua vao `display:none` o frontend.
- Route active phai dung dung ma quyen duoc seed trong `db.js`, khong duoc piggyback sang quyen gan nghia neu chua co spec noi ro.
- Neu route can kiem tra workflow/status, permission va workflow phai duoc check doc lap.
- Neu route doc du lieu nhay cam noi bo, can xac dinh ro co di qua `rbac.view_audit_logs` hay policy tuong duong khong.
- Neu them quyen moi vao seed matrix, phai cap nhat tai lieu permission matrix va verification script trong cung change.
- Neu quyen chi la placeholder, phai ghi ro `dormant` trong tai lieu thay vi de UI/backend ngam hieu la active.

## Regression Checklist For This Change

### UI-only permissions fixed

- `programs.submit` khong con chi an nut o UI; backend da khoa submit `program_version`.
- `courses.view` khong con chi an menu; `GET /api/courses` da check quyen.
- `rbac.view_audit_logs` khong con chi an menu; audit logs va dashboard activity da theo policy nay.

### Wrong-mapping permissions fixed

- `programs.export` duoc enforce tai route export.
- `programs.import_word` duoc enforce tai import start/commit.
- `syllabus.view` duoc enforce cho xem syllabus va danh sach syllabus theo version.
- `syllabus.create` duoc enforce rieng cho tao syllabus, khong dung chung `syllabus.edit`.

### Dormant permissions documented

- `portfolio.own`
- `portfolio.view_dept`
- `rbac.system_config`

### Program all-scope semantics

- `programs.manage_all` duoc coi la quyen bypass scope cho `programs.*` thay vi chi ton tai trong seed matrix.
