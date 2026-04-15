# Simplify Syllabus Approval to Single-Step (Trưởng Ngành)

## Summary

Đơn giản hoá vòng duyệt đề cương: thay vì chuỗi 4 bước (`submitted → approved_tbm → approved_khoa → approved_pdt → published`), giờ chỉ còn **1 bước** — Trưởng ngành duyệt là đề cương được "thông qua" / `published`. Bỏ luôn các trạng thái trung gian.

Đồng thời fix bug `column "is_locked" of relation "version_syllabi" does not exist` trong handler review (lỗi do code shared giữa `program_version` và `syllabus` cố set `is_locked` cho cả hai).

## Background

### Bug `is_locked`

[server.js:2712-2716](../../../server.js#L2712-L2716):
```js
const isLocking = (nextStatus === 'published');
await pool.query(
  `UPDATE ${table} SET status=$1, is_rejected=false, rejection_reason=NULL, updated_at=NOW() ${isLocking ? ', is_locked=true' : ''} WHERE id=$2`,
  [nextStatus, entity_id]
);
```

Khi `nextStatus === 'published'`, code append `, is_locked=true` vào UPDATE bất kể `${table}` là gì. `program_versions` có cột `is_locked` (boolean), nhưng `version_syllabi` thì không → fail với lỗi `column "is_locked" of relation "version_syllabi" does not exist`.

### Workflow syllabus hiện tại

Permissions ([server.js:2635-2641](../../../server.js#L2635-L2641)):
```js
const perms = {
  submitted: 'syllabus.approve_tbm',
  approved_tbm: 'syllabus.approve_khoa',
  approved_khoa: 'syllabus.approve_pdt',
  approved_pdt: 'syllabus.approve_bgh'
};
```

Flow ([server.js:2687-2693](../../../server.js#L2687-L2693)):
```js
const flow = {
  submitted: 'approved_tbm',
  approved_tbm: 'approved_khoa',
  approved_khoa: 'approved_pdt',
  approved_pdt: 'published'
};
```

User mới yêu cầu: **chỉ Trưởng ngành duyệt là xong**. Bỏ Khoa/PĐT/BGH cho syllabus.

### Submit-CTĐT block check

Spec trước (`2026-04-15-syllabus-approved-before-submit-design.md`) check: `status IN ('approved_tbm','approved_khoa','approved_pdt','published')` ([server.js:2548-2553](../../../server.js#L2548-L2553)).

Sau khi đơn giản hoá + migration, syllabus chỉ còn 3 trạng thái: `draft`, `submitted`, `published`. Check rút gọn về `status = 'published'`.

### Trạng thái CTĐT (program_version)

**Không đổi**. CTĐT vẫn có 4 bước: `draft → submitted → approved_khoa → approved_pdt → published` (hoặc `approved_bgh → published` tuỳ flow).

## Approach

Server-side rewrite handler review (bug fix + simplified maps), thêm migration vào `initDB()`, dọn UI label maps để loại bỏ trạng thái trung gian không còn có thể xảy ra cho syllabus.

Permissions `syllabus.approve_khoa` / `syllabus.approve_pdt` / `syllabus.approve_bgh` được giữ trong DB (vô hại, không reference tới đâu sau cleanup) — cleanup nếu cần ở spec sau.

## Server Changes

### 1. Fix bug `is_locked` ở handler review

[server.js:2712-2716](../../../server.js#L2712-L2716) — wrap `is_locked=true` chỉ áp dụng khi entity là `program_version`:

```js
const isLocking = (nextStatus === 'published' && entity_type === 'program_version');
await pool.query(
  `UPDATE ${table} SET status=$1, is_rejected=false, rejection_reason=NULL, updated_at=NOW() ${isLocking ? ', is_locked=true' : ''} WHERE id=$2`,
  [nextStatus, entity_id]
);
```

Logic giữ nguyên — chỉ thêm điều kiện `entity_type` để guard cột không tồn tại trên `version_syllabi`.

### 2. Đơn giản hoá syllabus approval maps

[server.js:2634-2642](../../../server.js#L2634-L2642) — permissions:

```js
} else {
  const perms = {
    submitted: 'syllabus.approve_tbm'
  };
  requiredPerm = perms[status];
}
```

[server.js:2686-2694](../../../server.js#L2686-L2694) — flow:

```js
} else {
  const flow = {
    submitted: 'published'
  };
  nextStatus = flow[status];
}
```

Sau đổi: syllabus ở `submitted` → click Duyệt → `published`. Status khác (`draft`, `published`) không có Duyệt → trả lỗi `'Trạng thái này không thể duyệt tiếp'` (đã có sẵn ở line 2644).

### 3. Đơn giản hoá submit-CTĐT check

[server.js:2548-2553](../../../server.js#L2548-L2553) — đổi `IN (...)` về `=`:

```js
EXISTS(
  SELECT 1 FROM version_syllabi vs
  WHERE vs.version_id = vc.version_id
    AND vs.course_id = vc.course_id
    AND vs.status = 'published'
) AS has_approved,
```

Ý nghĩa không đổi vì sau migration không syllabus nào ở trạng thái trung gian. Trường hợp legacy data có syllabus còn ở `approved_tbm` (chưa migrate) → coi như chưa duyệt → user phải duyệt lại. Migration chạy ở `initDB()` đảm bảo không còn legacy.

### 4. Migration `version_syllabi`

Thêm vào cuối `initDB()` trong [db.js](../../../db.js), ngay sau migration `academic_year` đã có ở Task trước:

```sql
-- Migration: syllabi đã qua bất kỳ bước duyệt cũ nào (approved_tbm/khoa/pdt) → published.
-- Idempotent: row đã ở trạng thái khác sẽ skip.
UPDATE version_syllabi
   SET status = 'published', updated_at = NOW()
 WHERE status IN ('approved_tbm', 'approved_khoa', 'approved_pdt');
```

## Frontend Changes

Dọn các label maps để loại bỏ các trạng thái trung gian KHÔNG CÒN có thể xảy ra cho syllabus. Vẫn giữ `approved_khoa`/`approved_pdt` ở các map dùng chung với program_version.

### File-by-file

| File | Line | Hành động |
|---|---|---|
| `public/js/pages/my-assignments.js` | 51-52 | Bỏ `approved_tbm`, `approved_khoa`, `approved_pdt` (map chỉ dùng cho syllabus assignments) |
| `public/js/pages/version-editor.js` | 1760 | Bỏ 3 trạng thái trung gian (map cho tab Đề cương) |
| `public/js/pages/dashboard.js` | 37 | Bỏ 3 trạng thái trung gian (map syllabus, không phải program_version) |
| `public/js/pages/syllabus-editor.js` | 65 | Bỏ 3 trạng thái trung gian |
| `public/js/pages/approval.js` | 10-12 | Bỏ `approved_tbm` (giữ `approved_khoa`/`approved_pdt` cho program_version) |
| `public/js/pages/approval.js` | 23-29 | Đơn giản hoá `getRequiredPerm` syllabus branch về `{ submitted: 'syllabus.approve_tbm' }` |
| `public/js/pages/approval.js` | 36-37 | Bỏ `'syllabus.approve_khoa'`, `'syllabus.approve_pdt'`, `'syllabus.approve_bgh'` khỏi `hasAnyApproval` syllabus branch (giữ `'syllabus.approve_tbm'`) |

### Không đụng

- `programs.js:145-146` (option Duyệt Khoa/PĐT) — cho program_version, không phải syllabus.
- `programs.js:482-483` (program status colors/labels) — không có `approved_tbm`, đã đúng cho program_version.
- `dashboard.js:31` — không có `approved_tbm`, là map cho program_version. Đã đúng.
- `version-editor.js:28-46, 172` — toàn bộ liên quan program_version flow.

## Database — Permissions cleanup (Out of Scope)

Permissions `syllabus.approve_khoa`, `syllabus.approve_pdt`, `syllabus.approve_bgh` (định nghĩa ở `db.js:445-447`) và các role assignments tương ứng (LANH_DAO_KHOA, PHONG_DAO_TAO, BAN_GIAM_HIEU) — KHÔNG xoá. Lý do:

- Vô hại — không còn code reference tới sau cleanup.
- Xoá có rủi ro nếu sau này muốn thêm lại bước duyệt nâng cao.
- Cleanup spec sau nếu user yêu cầu.

## Edge Cases

| Case | Hành vi |
|---|---|
| Syllabus đang `submitted` → user có `syllabus.approve_tbm` click Duyệt | Status → `published`, log entry, success |
| Syllabus đang `submitted` → user KHÔNG có quyền | 403 (giữ nguyên) |
| Syllabus đang `published` → click Duyệt | `requiredPerm = undefined` → 400 "Trạng thái này không thể duyệt tiếp" (giữ nguyên) |
| Syllabus đang `approved_pdt` (legacy) trước migration chạy | Migration sẽ promote về `published` ngay khi server restart |
| Syllabus đang `approved_pdt` (legacy) khi user click Duyệt trước migration kịp | `requiredPerm = undefined` → 400 (legacy state không có trong map mới) — cần restart server để chạy migration |
| Reject syllabus | Vẫn về `draft` như cũ — không đổi |
| `is_locked` trên program_version published | Vẫn set như cũ (chỉ entity_type này thoả isLocking) |

## Out of Scope

- Đổi flow CTĐT (program_version) — vẫn 4 bước.
- Xoá permission codes `syllabus.approve_khoa/pdt/bgh` khỏi DB.
- Xoá role assignments của các permission đó.
- UI cleanup các option "reject to approved_khoa" trong UI nếu có cho syllabus (chưa thấy tồn tại).
- Audit log retention / migration log entries.

## Manual Test Plan

(Không có test framework.)

### Test 1 — Bug fix `is_locked`

1. Chuẩn bị: 1 syllabus đang ở `submitted`, user có quyền `syllabus.approve_tbm`.
2. Click Duyệt → expect: success, status → `published`. (Trước fix: 500 error `is_locked does not exist`.)

### Test 2 — Migration legacy data

1. Trước restart: `SELECT status, COUNT(*) FROM version_syllabi GROUP BY status;` — note có row ở `approved_pdt` (4 syllabi của user theo screenshot).
2. Restart server (`make dev` reload).
3. Sau restart: query lại — các row `approved_tbm/khoa/pdt` đều thành `published`.
4. Restart lần 2 → query lần 3 → idempotent, không đổi.

### Test 3 — Single-step syllabus approval

1. Tạo 1 syllabus mới (nếu chưa có) ở status `draft` → user GV nộp → `submitted`.
2. User Trưởng ngành mở trang Approval hoặc syllabus-editor → thấy "Duyệt" button.
3. Click Duyệt → status → `published` ngay (không qua bước trung gian).
4. Sau khi `published`, không còn nút Duyệt.

### Test 4 — Submit CTĐT block check (regression)

1. CTĐT có HP với syllabus `draft` → submit CTĐT → modal block hiện HP đó.
2. Promote syllabus đó lên `published` (qua bước duyệt mới đơn).
3. Submit lại → success (nếu các HP khác cũng `published`).
4. Test trộn: 1 HP `published`, 1 HP `submitted`, 1 HP chưa có syllabus → modal hiện 2 nhóm "Chưa soạn" + "Chưa duyệt" như cũ.

### Test 5 — Reject (regression)

1. Syllabus `submitted` → user Trưởng ngành click Từ chối → status → `draft`, `is_rejected=true`. Không lỗi.

### Test 6 — UI label cleanup

- Tab Đề cương trong Version Editor: chỉ hiển thị badge "Nháp" / "Đã nộp" / "Công bố" / "Chưa tạo".
- Trang my-assignments: tương tự.
- Trang Approval: syllabus rows chỉ ở `submitted` (chờ Duyệt) hoặc các trạng thái khác đều có badge phù hợp.
- Không còn badge "TBM ✓" / "Khoa ✓" / "PĐT ✓" cho syllabus ở bất kỳ trang nào sau migration.

### Test 7 — Program_version flow không bị ảnh hưởng

- CTĐT `submitted` → Lãnh đạo khoa duyệt → `approved_khoa` → ... → `published` + `is_locked=true`. Toàn bộ flow CTĐT hoạt động bình thường.
