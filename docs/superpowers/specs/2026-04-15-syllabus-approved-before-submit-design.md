# Syllabus Approved Before Program Submit

## Summary

Thêm điều kiện tiên quyết cho workflow duyệt CTĐT: **trước khi một phiên bản CTĐT có thể chuyển từ `draft` sang `submitted` (nộp duyệt), tất cả học phần trong phiên bản phải có đề cương đã được Trưởng ngành duyệt (syllabus status ≥ `approved_tbm`)**. Học phần chưa có row đề cương nào cũng bị chặn. Lỗi trả về gom thành 2 nhóm rõ ràng để user biết phải soạn thêm hay phải chờ duyệt.

## Background

### Workflow hiện tại

- Handler `POST /api/approval/submit` tại [server.js:2493-2557](../../../server.js#L2493-L2557) chỉ kiểm tra:
  1. Version đang ở status `draft`.
  2. User có permission `programs.submit` (hoặc là admin).
  3. Proposed courses được PDT cấp mã — chỉ check ở bước chuyển sang `approved_pdt`, không phải lúc submit.
- **Không** kiểm tra đề cương.

### Vòng đời syllabus

Theo [server.js:2597-2604](../../../server.js#L2597-L2604) và [db.js:444](../../../db.js#L444):

| Trạng thái | Ai chuyển tiếp (permission) |
|---|---|
| `draft` | GV soạn, chưa nộp |
| `submitted` | GV đã nộp đề cương, chờ duyệt |
| `approved_tbm` | Trưởng ngành / Trưởng BM (permission `syllabus.approve_tbm`) duyệt xong |
| `approved_khoa` | Lãnh đạo khoa duyệt |
| `approved_pdt` | Phòng đào tạo duyệt |
| `published` | Công bố chính thức |

Role `TRUONG_NGANH` được gán permission `syllabus.approve_tbm` ([db.js:468](../../../db.js#L468)). Nghĩa là một syllabus ở status `approved_tbm` = Trưởng ngành đã duyệt.

### Quan hệ HP ↔ đề cương

- `version_courses` (HP trong phiên bản) và `version_syllabi` (đề cương) **độc lập**: thêm HP vào version KHÔNG tự tạo row syllabus. Syllabus chỉ được tạo khi user click soạn đề cương hoặc khi assignment.
- Schema `version_syllabi` không có UNIQUE (version_id, course_id) — về lý thuyết có thể có nhiều syllabus cho cùng một (version, course). Trong thực tế chỉ 1 row, nhưng check phải bền vững với trường hợp nhiều row.
- Khi copy version, syllabi được copy với status reset về `draft` ([server.js:683-686](../../../server.js#L683-L686)).

### Gap cần sửa

Khi user click "Nộp duyệt" ở Version Editor, không có chặn gì. CTĐT có thể bị nộp lên khoa trong khi đề cương của các HP vẫn đang `draft` / chưa tồn tại.

## Approach

**Server-side precondition trong handler submit, client hiển thị lỗi chi tiết từ response.**

Đã loại:

- **Preflight ở client + recheck server**: duplicate logic; ít giá trị.
- **Disable nút "Nộp duyệt" ngay từ khi load**: phức tạp về sync state + latency.

Server-side check là source of truth, client chỉ xử lý response format mới để hiện UI rõ ràng cho user.

## Server Changes

### Vị trí

`POST /api/approval/submit` — [server.js:2493-2557](../../../server.js#L2493-L2557), sau khi verify `entity_type === 'program_version'` và `status='draft'` và permission, **trước** câu `UPDATE program_versions SET status='submitted' ...`.

### Logic check

```js
if (entity_type === 'program_version') {
  const checkRes = await pool.query(`
    SELECT vc.course_id, c.code, c.name,
           EXISTS(
             SELECT 1 FROM version_syllabi vs
             WHERE vs.version_id = vc.version_id
               AND vs.course_id = vc.course_id
               AND vs.status IN ('approved_tbm','approved_khoa','approved_pdt','published')
           ) AS has_approved,
           EXISTS(
             SELECT 1 FROM version_syllabi vs
             WHERE vs.version_id = vc.version_id
               AND vs.course_id = vc.course_id
           ) AS has_any
    FROM version_courses vc
    JOIN courses c ON c.id = vc.course_id
    WHERE vc.version_id = $1
    ORDER BY c.code NULLS LAST, c.name
  `, [entity_id]);

  const missing = [];
  const notApproved = [];
  for (const r of checkRes.rows) {
    const label = r.code ? `${r.code} — ${r.name}` : `(Chờ cấp mã) ${r.name}`;
    if (r.has_approved) continue;
    if (r.has_any) notApproved.push(label);
    else missing.push(label);
  }

  if (missing.length || notApproved.length) {
    return res.status(400).json({
      error: 'Chưa đủ điều kiện nộp CTĐT: cần Trưởng ngành duyệt đề cương cho tất cả học phần.',
      details: { missing, not_approved: notApproved }
    });
  }
}
```

### Vì sao dùng 2 subquery `EXISTS`

- Xử lý đúng trường hợp có nhiều row `version_syllabi` cho cùng (version, course) — nếu **bất kỳ** row nào có status ≥ `approved_tbm`, course coi như qua.
- `has_any = false` đồng nghĩa chưa có syllabus nào → bucket "missing".
- `has_any = true` nhưng `has_approved = false` → có syllabus đang ở `draft` / `submitted` / `is_rejected` → bucket "not_approved".

### Label HP

- HP thường: `"<code> — <name>"` (ví dụ `IT101 — Nhập môn Tin học`).
- HP đề xuất (`code=NULL`): `"(Chờ cấp mã) <name>"`.

### Edge cases

| Case | Hành vi |
|---|---|
| Version 0 HP | `rows=[]`, 2 mảng rỗng → không block, cho nộp |
| Mọi HP đều approved_tbm+ | Không block |
| 1 HP không có row `version_syllabi` | Block, HP vào `missing` |
| 1 HP có syllabus `draft` hoặc `submitted` | Block, HP vào `not_approved` |
| 1 HP có syllabus `is_rejected=true` nhưng status vẫn `approved_tbm` | Không block (vẫn được Trưởng ngành duyệt) |
| 1 HP có 2 syllabus: 1 `draft`, 1 `approved_tbm` | Không block (EXISTS approved match) |
| HP đề xuất chưa cấp mã | Phải có syllabus approved_tbm+ (giống HP thường) |

## Client Changes

### Vị trí

Trong [public/js/pages/version-editor.js](../../../public/js/pages/version-editor.js), hàm xử lý click nút "Nộp duyệt" (xem quanh dòng 1948-1973 theo research).

### Logic

Khi fetch `/api/approval/submit` trả non-OK:

- Parse JSON response.
- Nếu `body.details && (body.details.missing || body.details.not_approved)` → mở modal tùy chỉnh hiển thị 2 nhóm.
- Ngược lại: fallback hành vi cũ (`toast.error(body.error || 'Có lỗi xảy ra')`).

### Modal UI

Tên tạm: `showSubmitBlockedModal(errorMsg, details)`.

Layout (sử dụng các class modal có sẵn trong codebase):

```
Header: "Chưa thể nộp CTĐT"
Body:
  <p>{errorMsg}</p>
  {missing.length ? section "Chưa soạn đề cương (${missing.length})" + <ul> } : null}
  {not_approved.length ? section "Đề cương chưa được Trưởng ngành duyệt (${not_approved.length})" + <ul> } : null}
Footer: button "Đóng"
```

Dùng pattern modal tương tự `showProposeCourseModal()` (dynamically append `.modal-overlay` vào body, remove khi close). Ẩn section nếu mảng rỗng.

### Không làm

- Không thêm preflight fetch.
- Không disable nút "Nộp duyệt" từ đầu.
- Không thay đổi hiển thị tab Đề cương hay toast flow cho các lỗi khác.

## Out of Scope

- Thêm precondition khác cho các bước duyệt tiếp theo (khoa → PĐT → BGH).
- UNIQUE constraint cho `(version_id, course_id)` trên `version_syllabi` (schema change, có thể làm spec riêng nếu thực sự có bug trùng row).
- Đồng bộ notifications/audit log cho sự kiện "submit bị block".
- Preflight validation ở Version Editor header (ví dụ disable nút + tooltip).

## Manual Test Plan

(Không có test framework.)

### Pre-condition

Dev server chạy, DB có dữ liệu test. Cần:
- 1 CTĐT test với ít nhất 1 version status=`draft`, có các HP với syllabus ở nhiều trạng thái.

### Test 1 — Happy path

1. Version có N HP, mọi HP có syllabus `approved_tbm` (hoặc cao hơn).
2. Click "Nộp duyệt" → success toast, status chuyển `submitted`.

### Test 2 — HP không có đề cương

1. Version có HP A không có row `version_syllabi` nào.
2. Click "Nộp duyệt" → modal hiện, HP A nằm trong "Chưa soạn đề cương".
3. DB: `SELECT status FROM program_versions WHERE id=<vId>` → vẫn `draft`.

### Test 3 — HP có đề cương `draft` hoặc `submitted`

1. Version có HP B có row `version_syllabi` status=`draft`.
2. Click "Nộp duyệt" → modal hiện, HP B nằm trong "Đề cương chưa được Trưởng ngành duyệt".

### Test 4 — Trộn 2 case

1. Version có HP A (không có syllabus) + HP B (syllabus draft) + HP C (syllabus approved_tbm).
2. Click "Nộp duyệt" → modal hiện:
   - Section "Chưa soạn đề cương (1)": HP A.
   - Section "Đề cương chưa được Trưởng ngành duyệt (1)": HP B.
   - HP C không xuất hiện.

### Test 5 — Version 0 HP

1. Version draft chưa có HP nào.
2. Click "Nộp duyệt" → success (không block).

### Test 6 — Nhiều syllabus trùng (nếu có)

Insert thủ công:
```sql
INSERT INTO version_syllabi (version_id, course_id, status) VALUES (<vId>, <courseId>, 'draft');
INSERT INTO version_syllabi (version_id, course_id, status) VALUES (<vId>, <courseId>, 'approved_tbm');
```
1. Nộp → không block HP này (vì EXISTS approved match).

### Test 7 — HP đề xuất chưa cấp mã

1. Version có HP đề xuất `code=NULL`, có syllabus `approved_tbm`.
2. Nộp → không block. Nếu syllabus vẫn `draft`, block — label hiển thị "(Chờ cấp mã) <tên>".
