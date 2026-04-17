# Propose Course — Cascading Khoa → Ngành Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat single-dropdown department selector in the "Đề xuất học phần mới" modal with cascading Khoa → Ngành dropdowns, allowing the proposer to leave Ngành empty (faculty-wide course).

**Architecture:** Frontend-only change in `public/js/pages/version-editor.js`. Port the exact cascading pattern already present in `public/js/pages/courses.js:120-147` and `:164` into the propose-course modal. No backend, schema, or API changes — `POST /api/versions/:vId/proposed-courses` already accepts a single `department_id`.

**Tech Stack:** Vanilla JS, Express.js, PostgreSQL (no test framework — manual verification per CLAUDE.md).

**Spec:** [docs/superpowers/specs/2026-04-15-propose-course-cascading-dept-design.md](../specs/2026-04-15-propose-course-cascading-dept-design.md)

---

## File Structure

**Modify (only file touched):**
- `public/js/pages/version-editor.js` — three localized changes inside the `VersionEditorPage` object:
  - `showProposeCourseModal()` HTML (lines 816-821): replace the single `pc-dept` `<select>` with a Khoa+Ngành pair.
  - `showProposeCourseModal()` populate logic (lines 841-846): replace flat populate with cascading filter + onchange handler.
  - `saveProposedCourse()` payload (line 871): read `department_id` from `pc-nganh || pc-khoa || null`.

All three edits live inside the same function or its sibling and must ship together — changing the HTML IDs without updating the save payload would break submission.

---

## Task 1: Implement cascading Khoa → Ngành in propose-course modal

**Files:**
- Modify: `public/js/pages/version-editor.js:816-821` (modal HTML)
- Modify: `public/js/pages/version-editor.js:840-846` (department fetch + populate)
- Modify: `public/js/pages/version-editor.js:871` (save payload)

**Reference pattern (do not modify):** `public/js/pages/courses.js:120-147` and `:164` show the working cascading implementation. Match the filter lists, default-option labels, and `||` fallback in the save payload exactly so behaviour stays consistent across both forms.

- [ ] **Step 1: Replace the modal HTML for the department selector**

In `public/js/pages/version-editor.js`, find this block (lines 816-821):

```html
            <div class="flex-row">
              <div class="input-group" style="flex:1;margin:0;">
                <label>Khoa/Viện</label>
                <select id="pc-dept"><option value="">— Chọn —</option></select>
              </div>
            </div>
```

Replace it with two cascading dropdowns inside the same `flex-row`:

```html
            <div class="flex-row">
              <div class="input-group" style="flex:1;margin:0;">
                <label>Khoa/Viện</label>
                <select id="pc-khoa"><option value="">— Chọn —</option></select>
              </div>
              <div class="input-group" style="flex:1;margin:0;">
                <label>Ngành</label>
                <select id="pc-nganh"><option value="">— Toàn khoa —</option></select>
              </div>
            </div>
```

- [ ] **Step 2: Replace the flat department fetch with cascading populate logic**

In the same function (`showProposeCourseModal`), find this block (lines 840-846):

```js
    // Load departments into dropdown
    fetch('/api/departments').then(r => r.json()).then(depts => {
      const sel = document.getElementById('pc-dept');
      let opts = '';
      (Array.isArray(depts) ? depts : []).forEach(d => { opts += `<option value="${d.id}">${d.name}</option>`; });
      sel.insertAdjacentHTML('beforeend', opts);
    });
```

Replace it with cascading populate logic (mirroring `courses.js:120-147`):

```js
    // Load departments into cascading Khoa → Ngành dropdowns
    fetch('/api/departments').then(r => r.json()).then(depts => {
      const list = Array.isArray(depts) ? depts : [];
      const khoaSel = document.getElementById('pc-khoa');
      const nganhSel = document.getElementById('pc-nganh');

      const khoaList = list.filter(d => ['KHOA', 'VIEN', 'TRUNG_TAM', 'PHONG'].includes(d.type));
      khoaSel.innerHTML = '<option value="">— Chọn —</option>' +
        khoaList.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

      const populateNganh = (khoaId) => {
        const children = list.filter(d => d.parent_id == khoaId && d.type === 'BO_MON');
        nganhSel.innerHTML = '<option value="">— Toàn khoa —</option>' +
          children.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      };
      khoaSel.onchange = () => { populateNganh(khoaSel.value); nganhSel.value = ''; };
      populateNganh(null);
    });
```

Note: `d.parent_id == khoaId` uses `==` (not `===`) intentionally — this matches `courses.js:128` and tolerates string/number coercion since `<select>` values are strings while `parent_id` from the API is a number.

- [ ] **Step 3: Update the save payload to read from the new fields**

In `saveProposedCourse()`, find this line (line 871):

```js
      department_id: document.getElementById('pc-dept').value || null,
```

Replace it with:

```js
      department_id: document.getElementById('pc-nganh').value || document.getElementById('pc-khoa').value || null,
```

This matches `courses.js:164` — Ngành takes precedence; if Ngành is empty, fall back to Khoa; if both empty, `null`.

- [ ] **Step 4: Sanity check — no JS errors, modal renders correctly**

If a dev server is not already running, start it:

```bash
make dev
```

In a browser, log in with a user that has `courses.propose` permission, navigate to a Program Version in `draft` status, open tab "Học phần", and click "Đề xuất HP mới".

Expected:
- The modal opens without console errors.
- Two side-by-side dropdowns appear: "Khoa/Viện" (default `— Chọn —`) and "Ngành" (default `— Toàn khoa —`).
- The Khoa dropdown lists only departments of type KHOA / VIEN / TRUNG_TAM / PHONG (no Bộ môn, no ROOT).
- Selecting a Khoa repopulates Ngành with that Khoa's BO_MON children; selecting a different Khoa resets Ngành back to `— Toàn khoa —`.

If any expected behaviour fails, do NOT proceed to commit — fix and re-verify.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/version-editor.js
git commit -m "$(cat <<'EOF'
feat(frontend): cascading Khoa→Ngành in propose-course modal

Replace flat department dropdown in "Đề xuất HP mới" with cascading
Khoa → Ngành selectors, matching the pattern in the master Courses
page. Ngành defaults to "— Toàn khoa —" so a proposed course can be
attached to a faculty without selecting a specific major.
EOF
)"
```

---

## Task 2: Manual end-to-end verification per behaviour matrix

**Files:** none modified. This task verifies persistence end-to-end against the spec's behaviour matrix.

**Reference:** spec section "Behaviour Matrix" and "Manual Test Plan".

- [ ] **Step 1: Verify Case A — chỉ chọn Khoa, để Ngành = "— Toàn khoa —"**

In the running app, open "Đề xuất HP mới":
- Tên: `TEST Case A — toàn khoa`
- Khoa: pick any (e.g. "Khoa Công nghệ thông tin")
- Ngành: leave at `— Toàn khoa —`
- Submit.

Verify in DB:

```bash
make db-shell
```

Then in psql:

```sql
SELECT id, name, department_id, is_proposed
FROM courses
WHERE name = 'TEST Case A — toàn khoa';
```

Expected: one row, `department_id` equals the ID of the chosen Khoa (verify with `SELECT id, name, type FROM departments WHERE id = <department_id>;` — `type` should be `KHOA` or similar, not `BO_MON`).

- [ ] **Step 2: Verify Case B — chọn cả Khoa + Ngành**

Open "Đề xuất HP mới" again:
- Tên: `TEST Case B — có ngành`
- Khoa: pick a Khoa that has at least one BO_MON child.
- Ngành: pick a specific Ngành.
- Submit.

Verify in DB:

```sql
SELECT id, name, department_id
FROM courses
WHERE name = 'TEST Case B — có ngành';
```

Expected: `department_id` equals the ID of the chosen Ngành. Confirm:

```sql
SELECT id, name, type FROM departments WHERE id = <department_id>;
```

Expected: `type = 'BO_MON'`.

- [ ] **Step 3: Verify Case C — không chọn gì**

Open "Đề xuất HP mới" again:
- Tên: `TEST Case C — không khoa không ngành`
- Khoa: leave at `— Chọn —`
- Ngành: leave at `— Toàn khoa —`
- Submit.

Verify in DB:

```sql
SELECT id, name, department_id
FROM courses
WHERE name = 'TEST Case C — không khoa không ngành';
```

Expected: `department_id IS NULL`.

- [ ] **Step 4: Verify display in tab Học phần**

Back in the Version Editor tab "Học phần", verify all three test rows appear with:
- Mã column showing `Chờ cấp mã` (warning text).
- Tên column showing the test name + a yellow `Đề xuất` badge.

- [ ] **Step 5: Cleanup test rows**

In psql:

```sql
DELETE FROM version_courses
WHERE course_id IN (
  SELECT id FROM courses WHERE name LIKE 'TEST Case % — %'
);
DELETE FROM courses WHERE name LIKE 'TEST Case % — %';
```

Verify zero rows remain:

```sql
SELECT COUNT(*) FROM courses WHERE name LIKE 'TEST Case % — %';
```

Expected: `0`.

- [ ] **Step 6: Final report**

If all three cases passed and the UI shows the expected badges, mark verification complete. If any step failed, document the failure (which case, expected vs actual `department_id`) and stop — do not silently fix; the implementation likely has a bug that needs investigation per superpowers:systematic-debugging.

---

## Self-Review Notes

**Spec coverage:**
- ✅ HTML change (spec § "UI Changes" → Task 1 Step 1)
- ✅ Populate logic (spec § "Logic populate" → Task 1 Step 2)
- ✅ Save payload (spec § "Save payload" → Task 1 Step 3)
- ✅ All 5 behaviour-matrix rows verified (spec § "Behaviour Matrix" → Task 2 Steps 1-3 cover Cases A/B/C; Step 1 implicitly checks "Đổi Khoa giữa chừng" via the sanity check in Task 1 Step 4; "Khoa không có BO_MON con" is exercised whenever the user picks such a Khoa — covered as a free observation in Task 1 Step 4).

**Placeholder scan:** none.

**Type/ID consistency:** `pc-khoa` and `pc-nganh` IDs used identically in HTML (Task 1 Step 1), populate (Task 1 Step 2), and save payload (Task 1 Step 3). Filter list `['KHOA','VIEN','TRUNG_TAM','PHONG']` matches `courses.js:123` exactly. `BO_MON` filter and `parent_id ==` (loose equality) match `courses.js:128`.
