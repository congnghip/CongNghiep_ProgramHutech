# RBAC Permission Matrix Audit

Tai lieu nay ghi nhan trang thai thuc thi cua 37 quyen seed trong `db.js` sau change `align-rbac-permission-enforcement`.

## Status Taxonomy

- `healthy`: backend dang enforce dung hoac sat nghia voi ma quyen.
- `ui_only`: frontend da tung an/hien UI theo quyen nhung backend chua khoa dung ma quyen.
- `wrong_mapping`: capability co that nhung backend dang dung quyen khac gan nghia.
- `dormant`: quyen ton tai trong matrix nhung chua co capability active.

## Role Shorthand

- `GV`: `GIANG_VIEN`
- `TN`: `TRUONG_NGANH`
- `LDK`: `LANH_DAO_KHOA`
- `PDT`: `PHONG_DAO_TAO`
- `BGH`: `BAN_GIAM_HIEU`
- `ADMIN`: `ADMIN`

## 37 Permissions

| Permission | Roles | UI | Backend | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `programs.view_published` | GV, TN, LDK, PDT, BGH, ADMIN | Sidebar CTDT, editor tabs | `requireViewVersion`, list/filter programs | healthy | Published CTDT visibility |
| `programs.view_draft` | TN, LDK, PDT, BGH, ADMIN | Sidebar CTDT, draft editor | `requireViewVersion`, versions list | healthy | Draft CTDT visibility |
| `programs.create` | LDK, PDT | Create program button | `POST /api/programs` | healthy | Create CTDT |
| `programs.edit` | LDK, PDT | Edit CTDT/version buttons | `PUT /api/programs/:id`, `checkVersionEditAccess` | healthy | Edit CTDT |
| `programs.delete_draft` | LDK, PDT, ADMIN | Delete buttons | `DELETE /api/programs/:id`, `DELETE /api/versions/:id` | healthy | Delete draft data |
| `programs.submit` | LDK | Submit version button | `POST /api/approval/submit` for `program_version` | healthy | Was ui_only before this change |
| `programs.approve_khoa` | LDK | Approval page | Approval workflow | healthy | Khoa-level review |
| `programs.approve_pdt` | PDT | Approval page | Approval workflow | healthy | PDT-level review |
| `programs.approve_bgh` | BGH | Approval page | Approval workflow | healthy | BGH-level review |
| `programs.export` | LDK, PDT, BGH | Export button | `GET /api/export/version/:vId` | healthy | Was wrong_mapping before this change |
| `programs.import_word` | LDK, PDT | DOCX import button/page | Import session create/commit routes | healthy | Was wrong_mapping before this change |
| `programs.manage_all` | PDT, ADMIN | No dedicated UI | `hasPermission()` scoped bypass for `programs.*` | healthy | All-scope program management |
| `programs.create_version` | PDT, ADMIN | Create/clone version buttons | `POST /api/programs/:programId/versions` | healthy | Create version |
| `programs.po.edit` | LDK, PDT, ADMIN | PO tab | PO CRUD routes | healthy | Granular edit |
| `programs.plo.edit` | LDK, PDT, ADMIN | PLO/PI tabs | PLO + PI CRUD routes | healthy | Granular edit |
| `programs.courses.edit` | LDK, PDT, ADMIN | Courses/plan tabs | Version-course CRUD routes | healthy | Granular edit |
| `programs.matrix.edit` | LDK, PDT, ADMIN | Matrix tabs | PO-PLO / course-PLO / PI map routes | healthy | Granular edit |
| `programs.assessment.edit` | LDK, PDT, ADMIN | Assessment tab | Assessment CRUD routes | healthy | Granular edit |
| `syllabus.view` | GV, TN, LDK, PDT, BGH, ADMIN | No direct menu gate | `requireViewSyllabus`, version syllabi list | healthy | Was wrong_mapping before this change |
| `syllabus.create` | GV, LDK, PDT | Create syllabus button in version editor | `POST /api/versions/:vId/syllabi` | healthy | Was wrong_mapping before this change |
| `syllabus.edit` | GV, LDK, PDT | Syllabus tab/editor | `PUT /api/syllabi/:id` | healthy | Edit existing syllabus |
| `syllabus.submit` | GV, LDK | Syllabus editor submit | `POST /api/approval/submit` for `syllabus` | healthy | Workflow submit |
| `syllabus.approve_tbm` | TN | Approval page | Approval workflow | healthy | TBM review |
| `syllabus.approve_khoa` | LDK | Approval page | Approval workflow | healthy | Khoa review |
| `syllabus.approve_pdt` | PDT | Approval page | Approval workflow | healthy | PDT review |
| `syllabus.approve_bgh` | BGH | Approval page | Approval workflow | healthy | BGH review |
| `syllabus.assign` | TN, LDK, PDT, BGH | Assignment modal | Assignable users + assignments routes | healthy | Assignment scope |
| `courses.view` | GV, TN, LDK, PDT, BGH, ADMIN | Sidebar courses | `GET /api/courses` | healthy | Was ui_only before this change |
| `courses.create` | PDT | Create course button | `POST /api/courses` | healthy | Create master course |
| `courses.edit` | PDT | Edit/delete course buttons | `PUT/DELETE /api/courses/:id` | healthy | Edit master course |
| `portfolio.own` | GV, TN, LDK | No UI | No live capability | dormant | Placeholder only |
| `portfolio.view_dept` | LDK, PDT, ADMIN | No UI | No live capability | dormant | Placeholder only |
| `rbac.manage_users` | ADMIN | RBAC menu | Users API write | healthy | User administration |
| `rbac.manage_roles` | ADMIN | RBAC menu | Roles/permissions API write | healthy | Role administration |
| `rbac.manage_departments` | ADMIN | RBAC menu | Department API write | healthy | Department administration |
| `rbac.view_audit_logs` | PDT, ADMIN | Audit menu and dashboard activity | `/api/audit-logs`, protected dashboard activity | healthy | Was ui_only before this change |
| `rbac.system_config` | ADMIN | No UI | No live capability | dormant | Placeholder only |

## Affected APIs and Screens

### Backend routes aligned in this change

- `POST /api/approval/submit` for `program_version`
- `GET /api/courses`
- `GET /api/audit-logs`
- `GET /api/dashboard/stats` recent activity payload
- `GET /api/export/version/:vId`
- `POST /api/import/docx/session`
- `POST /api/import/docx/session/:id/commit`
- `GET /api/syllabi/:id`
- `GET /api/versions/:vId/syllabi`
- `POST /api/versions/:vId/syllabi`

### Frontend screens aligned in this change

- Sidebar and generic permission reflection in `public/js/app.js`
- Program list/import entry points in `public/js/pages/programs.js`
- CTDT export and syllabus creation UI in `public/js/pages/version-editor.js`
- Dashboard recent activity visibility in `public/js/pages/dashboard.js`

## Dormant Permissions

The following permissions remain documented but inactive:

- `portfolio.own`
- `portfolio.view_dept`
- `rbac.system_config`

They SHALL NOT be treated as live capabilities until a dedicated OpenSpec change introduces the corresponding routes and UI.
