# Hide syllabus assignments from locked program versions

**Date:** 2026-04-06
**Type:** Bug fix (minor)
**Scope:** Single endpoint, single SQL change

## Context

A lecturer reported that the "Đề cương được phân công" (My Assigned Syllabi) page still
shows a row for course `GE001 — Triết học Mác-Lênin` on program `7480201 (2025-2026)`
even though that program version has been **published** and is therefore locked. The row
displays status **"Chưa tạo"** (Not created) because no syllabus was ever created for the
assignment. Clicking the row triggers the server-side lock check and returns the error
**"Phiên bản đã bị khóa"**, which surfaces as a toast — leaving the lecturer with a stale
row they can neither open nor dismiss.

The assignment is dead work: the window to create a syllabus closed when the version was
published. It should not be visible in the lecturer's active task list.

## Root Cause

`GET /api/my-assignments` in [server.js:1765-1787](../../../server.js#L1765-L1787) selects
every `syllabus_assignments` row for the current user without any filter on the parent
program version's lock state:

```sql
SELECT sa.id, sa.version_id, ..., pv.status as version_status, vs.status as syllabus_status
FROM syllabus_assignments sa
JOIN program_versions pv ON sa.version_id = pv.id
LEFT JOIN version_syllabi vs ON vs.version_id = sa.version_id AND vs.course_id = sa.course_id
WHERE sa.assigned_to = $1
ORDER BY sa.deadline ASC NULLS LAST, sa.created_at DESC
```

Meanwhile the mutation endpoint `POST /api/my-assignments/:assignmentId/create-syllabus`
correctly blocks locked versions in [server.js:1810-1812](../../../server.js#L1810-L1812):

```js
const verRes = await pool.query('SELECT is_locked FROM program_versions WHERE id=$1', [assignment.version_id]);
if (verRes.rows.length && verRes.rows[0].is_locked) {
  return res.status(400).json({ error: 'Phiên bản đã bị khóa' });
}
```

So the two endpoints disagree: the list endpoint shows work items the user cannot act on.

## Decision

**Hide every assignment whose parent version is locked, regardless of syllabus state.**

Filter by `program_versions.is_locked = false` (not by `status != 'published'`) because
`is_locked` also flips to `true` when a version is **copied to create a new version**
(see [server.js:638](../../../server.js#L638)), and in that case the old assignments are
also dead work. One filter correctly covers both lock causes.

### Alternatives considered

| Option | Why rejected |
| --- | --- |
| Hide only rows where `syllabus_id IS NULL` and version is locked | Keeps "completed" assignments visible, but the lecturer can already see those syllabi via the Programs page. Extra rule for no real benefit. |
| Keep rows visible but disable click + show "Đã khóa" badge | Adds visual clutter and per-row dead state for items that can never become actionable again. User explicitly chose to hide. |
| Auto-delete stale `syllabus_assignments` rows on publish | Destructive, loses audit trail of who was originally assigned and why. |

## Implementation

Single change in [server.js](../../../server.js) on the `GET /api/my-assignments` query
(around line 1782): add `AND pv.is_locked = false` to the `WHERE` clause.

```diff
       LEFT JOIN version_syllabi vs ON vs.version_id = sa.version_id AND vs.course_id = sa.course_id
-      WHERE sa.assigned_to = $1
+      WHERE sa.assigned_to = $1
+        AND pv.is_locked = false
       ORDER BY sa.deadline ASC NULLS LAST, sa.created_at DESC
```

No other file needs to change.

### Explicitly out of scope

- `GET /api/versions/:vId/assignments` at
  [server.js:1662-1680](../../../server.js#L1662-L1680): used by the in-version assignment
  panel. It is contextual to a specific version, so showing assignments for a locked
  version there is intentional (historical / read-only view).
- Frontend changes in [public/js/pages/my-assignments.js](../../../public/js/pages/my-assignments.js):
  none needed. The existing "Chưa có phân công nào." empty state at line 56 covers the
  case where a lecturer only had assignments on locked versions.
- Cleanup migration on existing `syllabus_assignments` rows: not needed. Filter applies at
  query time; nothing to backfill.
- The "4 duplicate toasts" in the bug report screenshot: not a bug. `createAndOpen` at
  [my-assignments.js:109-124](../../../public/js/pages/my-assignments.js#L109-L124) fires
  exactly one toast per call; the four toasts come from four clicks.

## Verification

1. Start the app locally with `make dev`.
2. **Positive test — row is hidden when locked:**
   - In `psql`, find a `program_versions` row with `is_locked = true` that has at least
     one matching `syllabus_assignments.assigned_to = <test user id>`.
   - Log in as that test user → navigate to "Đề cương được phân công" →
     **expected:** the row no longer appears.
3. **Negative test — non-locked assignments still visible:**
   - Ensure the same test user has an assignment on a `draft` or `submitted` version
     (`is_locked = false`).
   - Reload the page → **expected:** that row still appears with its correct status.
4. **Regression — version editor assignments still work:**
   - Open a locked version in the version editor → open the assignments tab →
     **expected:** assignments still list (unchanged behaviour from this endpoint).
5. **Regression — mutation guard still fires:**
   - Hit `POST /api/my-assignments/:assignmentId/create-syllabus` directly (e.g. via
     `curl` with the auth cookie) for an assignment on a locked version →
     **expected:** HTTP 400 with body `{"error":"Phiên bản đã bị khóa"}` from the guard
     at [server.js:1810-1812](../../../server.js#L1810-L1812). This confirms the
     defense-in-depth mutation check is unchanged.
