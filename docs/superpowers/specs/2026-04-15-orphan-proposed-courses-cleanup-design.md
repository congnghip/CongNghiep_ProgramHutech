# Orphan Proposed Courses Cleanup

## Summary

Hai bug liên quan đến vòng đời học phần đề xuất:

1. Khi user gỡ một HP đề xuất khỏi version (nút "Xóa" ở tab Học phần), chỉ row trong `version_courses` bị xóa; row `courses` với `is_proposed=true` vẫn tồn tại, không hiển thị ở đâu trong UI, trở thành **mồ côi trong DB**.
2. Khi user xóa một CTĐT có version đang chứa HP đề xuất (dù user đã gỡ HP đó ra rồi, vì bug 1 khiến row mồ côi), FK `courses.proposed_by_version_id_fkey` (NO ACTION) block việc cascade xóa `program_versions` → handler trả về HTTP 500 generic.

Spec này sửa cả hai ở tầng server (`server.js`), không đổi schema, không đổi frontend.

## Background

### Bug evidence

Program id=735 ("Ngôn ngữ Trung Quốc") không xóa được. Điều tra:

- Program có 1 version (id=587, status=`draft`, no `copied_from_id` references).
- `SELECT id, code, name, is_proposed, proposed_by_version_id FROM courses WHERE proposed_by_version_id = 587` → 1 row: course id=1249 ("học phần mới"), `is_proposed=true`, code NULL.
- User đã gỡ HP này khỏi tab Học phần nhưng row `courses` vẫn còn.
- `pg_constraint` check: tất cả FK trỏ vào `program_versions` đều `ON DELETE CASCADE` **trừ** `courses.proposed_by_version_id_fkey` (`confdeltype='a'` = NO ACTION).

### Route 1 — `DELETE /api/version-courses/:id` ([server.js:1521-1530](../../../server.js#L1521-L1530))

```js
app.delete('/api/version-courses/:id', authMiddleware, async (req, res) => {
  try {
    const vcRes = await pool.query('SELECT version_id FROM version_courses WHERE id=$1', [req.params.id]);
    if (!vcRes.rows.length) throw new Error('Không tìm thấy HP trong phiên bản');
    await checkVersionEditAccess(req.user.id, vcRes.rows[0].version_id);

    await pool.query('DELETE FROM version_courses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

Chỉ xóa row `version_courses`. Không kiểm tra row `courses` tương ứng có còn cần thiết hay không.

### Route 2 — `DELETE /api/programs/:id` ([server.js:548-572](../../../server.js#L548-L572))

```js
app.delete('/api/programs/:id', authMiddleware, requirePerm('programs.delete_draft'), async (req, res) => {
  try {
    // 1. Check if program has any published versions
    const check = await pool.query(
      'SELECT id FROM program_versions WHERE program_id = $1 AND status = \'published\' LIMIT 1',
      [req.params.id]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa CTĐT đã công bố. Vui lòng liên hệ Admin nếu cần xóa.' });
    }

    // 2. Nullify copied_from_id references pointing to versions of this program
    const versionIds = await pool.query(
      'SELECT id FROM program_versions WHERE program_id = $1',
      [req.params.id]
    );
    if (versionIds.rows.length > 0) {
      const ids = versionIds.rows.map(r => r.id);
      await pool.query(
        'UPDATE program_versions SET copied_from_id = NULL WHERE copied_from_id = ANY($1)',
        [ids]
      );
    }

    // 3. Cascade delete will be handled by DB foreign keys (ON DELETE CASCADE)
    await pool.query('DELETE FROM programs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    if (e.code === '23503' && e.constraint && e.constraint.includes('copied_from_id')) {
      return res.status(400).json({ error: 'Không thể xóa CTĐT vì có phiên bản khác được tạo từ bản này. Hãy xóa các phiên bản phụ thuộc trước.' });
    }
    res.status(500).json({ error: e.message });
  }
});
```

Đã có bước (2) dọn thủ công cho FK `copied_from_id`. Cần bước tương tự cho `proposed_by_version_id`.

### Fact quan trọng về proposed course lifecycle

Theo [docs/superpowers/specs/2026-04-13-proposed-courses-design.md](2026-04-13-proposed-courses-design.md):

| Trạng thái | `code` | `is_proposed` | `proposed_by_version_id` |
|---|---|---|---|
| HP catalog | `'CS101'` | `false` | `NULL` |
| HP đề xuất | `NULL` | `true` | `42` (version id) |
| Đề xuất đã cấp mã | `'CS201'` | `false` | `NULL` |

→ `proposed_by_version_id` **chỉ** khác `NULL` khi `is_proposed=true`. Sau khi PDT cấp mã, `proposed_by_version_id` được reset về `NULL`.

→ Điều kiện `is_proposed=true AND proposed_by_version_id IN (...)` = "đề xuất chưa cấp mã, thuộc những version này". Catalog courses và courses đã cấp mã **không bao giờ** match.

## Approach

**Server-side cleanup trong cả 2 route**, theo pattern đã có sẵn cho `copied_from_id`. Không đụng schema, không migration.

Lý do không chọn sửa FK sang `ON DELETE CASCADE` / `SET NULL`:

- Cần migration (`DROP CONSTRAINT` + `ADD CONSTRAINT`) — rủi ro hơn với DB production.
- Pattern hiện có trong codebase (`copied_from_id`) đã dùng cleanup thủ công; giữ nhất quán.
- CASCADE ở tầng DB sẽ xóa luôn cả courses chưa-cấp-mã khi version bị xóa, nhưng điều kiện `is_proposed=true` đảm bảo chính xác hơn nếu sau này schema đổi.

## Fix 1 — `DELETE /api/version-courses/:id`

### Logic mới

1. SELECT lấy cả `version_id` và `course_id` từ row `version_courses`.
2. `checkVersionEditAccess` (như cũ).
3. Mở transaction (`pool.connect()` + `BEGIN`):
   a. `DELETE FROM version_courses WHERE id=$1`.
   b. `SELECT is_proposed FROM courses WHERE id=$courseId`. Nếu `is_proposed=true`:
      - `SELECT 1 FROM version_courses WHERE course_id=$courseId LIMIT 1`.
      - Nếu 0 row → `DELETE FROM courses WHERE id=$courseId`.
   c. `COMMIT`.
4. `res.json({ success: true })`.

### Transaction rationale

Race window: giữa bước 3a và 3b, một request khác có thể INSERT vào `version_courses` với cùng `course_id`. Nhưng điều này gần như không xảy ra với HP đề xuất (`/api/courses/all` lọc ra `is_proposed=false` nên không thêm được HP đề xuất sang version khác). Vẫn dùng transaction để an toàn; cost rất thấp, 1 connection.

### Behaviour matrix

| `course.is_proposed` | # `version_courses` còn lại sau delete | Kết quả |
|---|---|---|
| `false` (catalog) | bất kỳ | Chỉ xóa row `version_courses`; row `courses` giữ nguyên |
| `true` (đề xuất) | `0` | Xóa cả row `courses` |
| `true` (đề xuất) | `>0` | Chỉ xóa row `version_courses` (an toàn — chưa đụng trường hợp thực tế) |

## Fix 2 — `DELETE /api/programs/:id`

### Logic mới

Giữ nguyên bước (1) check published. Sau bước (2) nullify `copied_from_id`, thêm bước (2b):

```js
// 2b. Delete proposed courses tied to versions of this program
//     (proposed_by_version_id FK has NO ACTION; must clean up before CASCADE)
await pool.query(
  'DELETE FROM courses WHERE is_proposed = true AND proposed_by_version_id = ANY($1)',
  [ids]
);
```

Bước (3) `DELETE FROM programs` giữ nguyên — CASCADE sẽ xóa các version và liên quan.

Bước (2) và (2b) đặt trong cùng `if (versionIds.rows.length > 0)` block.

### Error handler

Giữ nguyên nhánh `copied_from_id`. Thêm nhánh mới (phòng ngừa — nếu vẫn bị lỗi FK vì lý do nào đó khác):

```js
if (e.code === '23503' && e.constraint && e.constraint.includes('proposed_by_version_id')) {
  return res.status(400).json({
    error: 'Không thể xóa CTĐT vì có học phần đề xuất đang tham chiếu phiên bản này. Liên hệ Admin.'
  });
}
```

## Out of Scope

- Đổi FK sang `ON DELETE CASCADE` / `SET NULL` ở tầng schema.
- UI confirm dialog đặc biệt khi gỡ HP đề xuất (ví dụ "Gỡ HP này sẽ xóa hẳn, không khôi phục được — tiếp tục?"). UX hiện tại đã có confirm generic; đây là hành vi hợp lý mặc định.
- Batch cleanup orphan courses hiện có trong DB (spec này fix cho request tương lai; course 1249 sẽ được Fix 2 dọn khi user retry xóa CTĐT Ngôn Ngữ Trung Quốc).
- Audit log cho việc auto-delete course. Hiện code cũng không audit việc xóa `version_courses`.

## Manual Test Plan

(Project không có test framework.)

### Pre-condition

Dev server đang chạy (`make dev`), DB có user với permission `courses.propose` và `programs.delete_draft`.

### Test 1 — Fix 1, HP đề xuất được gỡ ra

1. Mở Version Editor của 1 CTĐT (version status `draft`) → tab Học phần → "Đề xuất HP mới" → tạo HP tên `TEST orphan fix 1` → submit.
2. `SELECT id, name, is_proposed FROM courses WHERE name = 'TEST orphan fix 1';` → 1 row, `is_proposed=true`.
3. Ở tab Học phần, bấm "Xóa" dòng HP đó → confirm.
4. `SELECT id, name FROM courses WHERE name = 'TEST orphan fix 1';` → **0 row** (đã auto-delete).

### Test 2 — Fix 1, HP catalog được gỡ (không ảnh hưởng)

1. Trong Version Editor, thêm 1 HP catalog có sẵn vào version (dropdown "Thêm HP").
2. Ghi lại `course_id` của HP đó.
3. Bấm "Xóa" gỡ khỏi version → confirm.
4. `SELECT id FROM courses WHERE id = <course_id>;` → **vẫn còn 1 row**.

### Test 3 — Fix 2, xóa CTĐT với HP đề xuất còn sót (tái hiện Ngôn Ngữ Trung Quốc)

1. Pre-seed orphan: tạo 1 CTĐT test, tạo version draft, đề xuất 1 HP. Sau đó mô phỏng bug cũ bằng cách xóa thủ công row `version_courses` nhưng giữ lại row `courses`:
   ```sql
   DELETE FROM version_courses
   WHERE version_id = <test_version_id>
     AND course_id = <test_course_id>;
   ```
2. Verify course còn trong DB: `SELECT id, is_proposed, proposed_by_version_id FROM courses WHERE id = <test_course_id>;` → 1 row, `is_proposed=true`, `proposed_by_version_id=<test_version_id>`.
3. UI: xóa CTĐT test. Expect thành công (trước fix sẽ 500).
4. Verify xóa sạch:
   ```sql
   SELECT COUNT(*) FROM programs WHERE id = <test_program_id>;        -- 0
   SELECT COUNT(*) FROM program_versions WHERE id = <test_version_id>; -- 0
   SELECT COUNT(*) FROM courses WHERE id = <test_course_id>;           -- 0
   ```

### Test 4 — Fix 2, xóa CTĐT có HP catalog trộn với HP đề xuất

1. Tạo CTĐT test + version, thêm 1 HP catalog có sẵn + tạo 1 HP đề xuất.
2. Ghi lại `catalog_course_id` và `proposed_course_id`.
3. Xóa CTĐT test.
4. Verify:
   ```sql
   SELECT id FROM courses WHERE id = <catalog_course_id>;   -- 1 row (còn)
   SELECT id FROM courses WHERE id = <proposed_course_id>;  -- 0 row (đã xóa)
   ```

### Test 5 — Retry Ngôn Ngữ Trung Quốc

Sau khi deploy fix:

1. `SELECT * FROM courses WHERE id = 1249;` — ghi lại để confirm còn đó.
2. UI: xóa CTĐT id=735. Expect thành công.
3. `SELECT COUNT(*) FROM programs WHERE id = 735;` → 0.
4. `SELECT COUNT(*) FROM courses WHERE id = 1249;` → 0.

Nếu bước 2 vẫn fail, dừng lại và debug — không tự làm workaround DELETE manual.
