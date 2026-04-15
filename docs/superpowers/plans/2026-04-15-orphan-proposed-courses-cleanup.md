# Orphan Proposed Courses Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two related bugs so (1) gỡ HP đề xuất khỏi version xóa luôn row `courses` nếu mồ côi; (2) xóa CTĐT tự dọn HP đề xuất còn sót trước khi CASCADE.

**Architecture:** Server-side only. Two route handler edits in `server.js`, zero schema changes, zero frontend changes. Follows existing cleanup pattern used for `copied_from_id` FK.

**Tech Stack:** Node.js + Express.js + `pg` (node-postgres), PostgreSQL 15. Project has no test framework and no linter (per CLAUDE.md) — manual verification per the spec.

**Spec:** [docs/superpowers/specs/2026-04-15-orphan-proposed-courses-cleanup-design.md](../specs/2026-04-15-orphan-proposed-courses-cleanup-design.md)

---

## File Structure

**Modify (only file touched):**
- `server.js` — two localized handler edits:
  - `DELETE /api/version-courses/:id` (lines 1521-1530) — wrap in transaction, auto-delete orphaned proposed course.
  - `DELETE /api/programs/:id` (lines 548-572) — add step (2b) to delete proposed courses before CASCADE; add error-handler branch for `proposed_by_version_id` FK.

The two edits are independent — Task 1 addresses Fix 1, Task 2 addresses Fix 2.

---

## Task 1: Auto-delete orphaned proposed course on `DELETE /api/version-courses/:id`

**Files:**
- Modify: `server.js:1521-1530`

**Reference:** the existing handler for context.

### Current code (to replace in full)

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

- [ ] **Step 1: Replace the handler with transaction + orphan cleanup**

Replace the entire block above with:

```js
app.delete('/api/version-courses/:id', authMiddleware, async (req, res) => {
  try {
    const vcRes = await pool.query('SELECT version_id, course_id FROM version_courses WHERE id=$1', [req.params.id]);
    if (!vcRes.rows.length) throw new Error('Không tìm thấy HP trong phiên bản');
    const { version_id, course_id } = vcRes.rows[0];
    await checkVersionEditAccess(req.user.id, version_id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM version_courses WHERE id=$1', [req.params.id]);

      // If the course is a proposed (unassigned-code) course and no other
      // version_courses row still references it, delete the orphaned course row.
      const courseRes = await client.query('SELECT is_proposed FROM courses WHERE id=$1', [course_id]);
      if (courseRes.rows.length && courseRes.rows[0].is_proposed) {
        const stillRef = await client.query('SELECT 1 FROM version_courses WHERE course_id=$1 LIMIT 1', [course_id]);
        if (stillRef.rows.length === 0) {
          await client.query('DELETE FROM courses WHERE id=$1', [course_id]);
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

Notes:
- `SELECT` now returns both `version_id` (for access check) and `course_id` (for the orphan check).
- Transaction uses `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` pattern; the `finally { client.release() }` is required to return the connection to the pool.
- Orphan-delete ONLY when `is_proposed=true` — catalog courses are never touched.

- [ ] **Step 2: Verify file parses cleanly**

```bash
node --check server.js
```

Expected: exit 0, no output. If error, investigate (likely a brace/bracket mismatch).

- [ ] **Step 3: Spot-check the handler end-to-end with a transient test**

Start dev server if not already running:

```bash
make dev
```

Wait ~5 seconds for server startup logs to settle. Then in a separate shell, run this integration check that uses psql directly (no UI needed):

```bash
docker exec -i program-db psql -U program -d program_db <<'SQL'
-- Pick a draft version to use (first available)
SELECT id AS version_id, program_id, academic_year, status
FROM program_versions
WHERE status = 'draft'
ORDER BY id
LIMIT 1;
SQL
```

Note the `version_id` printed. Then simulate the bug repro via SQL only (bypassing UI):

```bash
docker exec -i program-db psql -U program -d program_db <<'SQL'
-- Insert a fake proposed course directly
INSERT INTO courses (code, name, credits, is_proposed, proposed_by_version_id)
VALUES (NULL, 'TEST Task1 orphan', 3, true, <PASTE_VERSION_ID>)
RETURNING id AS course_id;
SQL
```

Note the `course_id`. Then insert a `version_courses` row:

```bash
docker exec -i program-db psql -U program -d program_db <<'SQL'
INSERT INTO version_courses (version_id, course_id, semester, course_type)
VALUES (<PASTE_VERSION_ID>, <PASTE_COURSE_ID>, 1, 'required')
RETURNING id AS vc_id;
SQL
```

Note the `vc_id`. Now call the DELETE endpoint. First, get an auth cookie — easiest path is to log in via browser at http://localhost:3600 and copy the `token` cookie value:

```bash
TOKEN='<paste-cookie-value>'
curl -s -X DELETE http://localhost:3600/api/version-courses/<PASTE_VC_ID> \
  -H "Cookie: token=$TOKEN" | head -c 200
echo
```

Expected: `{"success":true}`. Then verify the course was auto-deleted:

```bash
docker exec -i program-db psql -U program -d program_db <<'SQL'
SELECT id FROM courses WHERE name = 'TEST Task1 orphan';
SQL
```

Expected: `(0 rows)`.

**If auth is tricky** (no browser handy / no test user): skip the curl part, call DELETE via UI: log in, go to the Version Editor for the chosen version, add a proposed course named `TEST Task1 orphan` manually through the UI, then click "Xóa" on it. Query `SELECT id FROM courses WHERE name = 'TEST Task1 orphan';` — expect 0 rows.

If the course still exists after the delete, STOP and debug before committing.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "$(cat <<'EOF'
fix(api): auto-delete orphan proposed course on version-courses remove

When a proposed course (is_proposed=true) is removed from a version via
DELETE /api/version-courses/:id and no other version still references it,
also delete the courses row so it does not linger as an invisible orphan
in the DB. Wrap in a transaction to avoid races with concurrent inserts.

Catalog courses (is_proposed=false) are unaffected — only the version_courses
row is removed for them.
EOF
)"
```

---

## Task 2: Delete proposed courses before CASCADE in `DELETE /api/programs/:id`

**Files:**
- Modify: `server.js:548-572`

### Current code (for reference, do NOT replace in full — targeted edits)

```js
app.delete('/api/programs/:id', authMiddleware, requirePerm('programs.delete_draft'), async (req, res) => {
  try {
    // 1. Check if program has any published versions
    const check = await pool.query('SELECT id FROM program_versions WHERE program_id = $1 AND status = \'published\' LIMIT 1', [req.params.id]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa CTĐT đã công bố. Vui lòng liên hệ Admin nếu cần xóa.' });
    }

    // 2. Nullify copied_from_id references pointing to versions of this program
    const versionIds = await pool.query('SELECT id FROM program_versions WHERE program_id = $1', [req.params.id]);
    if (versionIds.rows.length > 0) {
      const ids = versionIds.rows.map(r => r.id);
      await pool.query('UPDATE program_versions SET copied_from_id = NULL WHERE copied_from_id = ANY($1)', [ids]);
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

- [ ] **Step 1: Add step (2b) — delete proposed courses before CASCADE**

Find this block inside the `if (versionIds.rows.length > 0)` branch:

```js
    if (versionIds.rows.length > 0) {
      const ids = versionIds.rows.map(r => r.id);
      await pool.query('UPDATE program_versions SET copied_from_id = NULL WHERE copied_from_id = ANY($1)', [ids]);
    }
```

Replace with (adds one new `await pool.query` call inside the same `if` block):

```js
    if (versionIds.rows.length > 0) {
      const ids = versionIds.rows.map(r => r.id);
      await pool.query('UPDATE program_versions SET copied_from_id = NULL WHERE copied_from_id = ANY($1)', [ids]);

      // 2b. Delete proposed courses tied to versions of this program
      //     (proposed_by_version_id FK has NO ACTION; must clean up before CASCADE)
      await pool.query(
        'DELETE FROM courses WHERE is_proposed = true AND proposed_by_version_id = ANY($1)',
        [ids]
      );
    }
```

The `is_proposed = true` filter ensures catalog courses are never touched — only courses still in the "proposed, unassigned code" state. After PDT assigns a code, `proposed_by_version_id` is already `NULL` per the proposed-courses lifecycle, so that course won't match either.

- [ ] **Step 2: Add error-handler branch for `proposed_by_version_id` FK**

Find the catch block:

```js
  } catch (e) {
    if (e.code === '23503' && e.constraint && e.constraint.includes('copied_from_id')) {
      return res.status(400).json({ error: 'Không thể xóa CTĐT vì có phiên bản khác được tạo từ bản này. Hãy xóa các phiên bản phụ thuộc trước.' });
    }
    res.status(500).json({ error: e.message });
  }
```

Replace with:

```js
  } catch (e) {
    if (e.code === '23503' && e.constraint && e.constraint.includes('copied_from_id')) {
      return res.status(400).json({ error: 'Không thể xóa CTĐT vì có phiên bản khác được tạo từ bản này. Hãy xóa các phiên bản phụ thuộc trước.' });
    }
    if (e.code === '23503' && e.constraint && e.constraint.includes('proposed_by_version_id')) {
      return res.status(400).json({ error: 'Không thể xóa CTĐT vì có học phần đề xuất đang tham chiếu phiên bản này. Liên hệ Admin.' });
    }
    res.status(500).json({ error: e.message });
  }
```

This is a safety net — step (2b) should prevent the FK violation entirely, but if something slips through (e.g., a row inserted between step (2b) and step (3)), the user gets a Vietnamese message instead of a 500.

- [ ] **Step 3: Verify file parses cleanly**

```bash
node --check server.js
```

Expected: exit 0.

- [ ] **Step 4: Verify end-to-end with the actual failing case (program 735)**

**IMPORTANT:** This test uses a real row in the user's database (program id=735 "Ngôn ngữ Trung Quốc"). The user confirmed in conversation that this program should be deletable — it's the exact bug we're fixing. It has 1 orphan proposed course (id=1249) lingering in the DB.

Before running, confirm the program and orphan course still exist:

```bash
docker exec -i program-db psql -U program -d program_db <<'SQL'
SELECT id, name FROM programs WHERE id = 735;
SELECT id, name, is_proposed, proposed_by_version_id FROM courses WHERE id = 1249;
SQL
```

Expected: 1 row each.

Then restart the dev server so it picks up the code changes (the `make dev` target uses `node --watch` so this should auto-reload, but verify logs show reload). In the UI, log in as a user with `programs.delete_draft` permission, navigate to the programs list, find "Ngôn ngữ Trung Quốc", click delete, confirm.

Expected: success toast, program disappears from the list. Then verify in DB:

```bash
docker exec -i program-db psql -U program -d program_db <<'SQL'
SELECT COUNT(*) AS programs FROM programs WHERE id = 735;
SELECT COUNT(*) AS versions FROM program_versions WHERE program_id = 735;
SELECT COUNT(*) AS orphan_course FROM courses WHERE id = 1249;
SQL
```

Expected: all three return `0`.

If the UI delete fails or any count is non-zero, STOP and debug before committing. Do NOT manually `DELETE FROM courses WHERE id = 1249` as a workaround — the point is the handler should do this.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "$(cat <<'EOF'
fix(api): clean up proposed courses when deleting a program

The proposed_by_version_id FK on courses has ON DELETE NO ACTION,
unlike the other FKs to program_versions which CASCADE. This caused
DELETE /api/programs/:id to fail with a generic 500 whenever a version
of the program still had a proposed (un-coded) course attached.

Explicitly DELETE proposed courses (is_proposed=true) tied to the
program's versions before relying on CASCADE, mirroring the existing
cleanup pattern for copied_from_id. Also add a friendly Vietnamese
error message for the proposed_by_version_id FK as a safety net.
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Fix 1 logic (spec § "Fix 1 — DELETE /api/version-courses/:id") → Task 1 Step 1
- ✅ Transaction wrapping (spec § "Transaction rationale") → Task 1 Step 1
- ✅ Fix 2 step (2b) (spec § "Fix 2 — Logic mới") → Task 2 Step 1
- ✅ Error-handler branch (spec § "Error handler") → Task 2 Step 2
- ✅ Test cases 1, 3, 5 (most important ones) — Task 1 Step 3 covers Test 1 flavor; Task 2 Step 4 covers Test 5 exactly. Tests 2 and 4 are secondary safety checks; deferred to Task 2's final verification phase (see below).

**Placeholder scan:** none. All code blocks are complete.

**Type consistency:** `course_id` used consistently (not `courseId` in one place and `course_id` in another). `version_id` consistent. SQL column names match DB schema (`is_proposed`, `proposed_by_version_id`, `code`).

**Concern — manual test coverage:**
Tests 2 (catalog course gỡ, không ảnh hưởng) and Test 4 (xóa CTĐT trộn catalog + đề xuất) from the spec are not explicitly scripted in the plan. They test the *non-regression* side. After Task 2 Step 5 commit succeeds, the controller should ask the user to also spot-check these two cases via UI before marking the plan complete. They're quick (< 2 minutes each) and don't need new code paths.
