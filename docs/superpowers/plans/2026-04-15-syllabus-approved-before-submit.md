# Syllabus Approved Before Program Submit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chặn submit CTĐT ở status `draft` → `submitted` khi có bất kỳ HP nào chưa có đề cương được Trưởng ngành duyệt (syllabus.status chưa đạt `approved_tbm`+), kèm UI hiển thị rõ 2 nhóm HP vi phạm.

**Architecture:** Backend thêm precondition check trong `POST /api/approval/submit` khi `entity_type='program_version'`. Frontend bắt response 400 có `details` và hiện modal tùy chỉnh.

**Tech Stack:** Node.js + Express + `pg`, PostgreSQL 15, vanilla JS frontend. Không test framework, không linter.

**Spec:** [docs/superpowers/specs/2026-04-15-syllabus-approved-before-submit-design.md](../specs/2026-04-15-syllabus-approved-before-submit-design.md)

---

## File Structure

**Modify (2 files):**
- `server.js` — thêm precondition check trong `POST /api/approval/submit`, vị trí chèn: trước dòng `UPDATE ... SET status='submitted'` (hiện tại ở line 2544), sau khối syllabus assignment check (kết thúc ở line 2542).
- `public/js/pages/version-editor.js` — sửa hàm `saveSubmit()` (line 1960-1973) để parse response body và gọi modal khi có `details`; thêm hàm `showSubmitBlockedModal(errorMsg, details)` hiển thị 2 nhóm.

Hai file độc lập logic nhưng phải ship cùng (frontend cần response format mới từ backend). Chia 2 task nhưng cả hai commit trước khi verify.

---

## Task 1: Backend precondition check in `POST /api/approval/submit`

**Files:**
- Modify: `server.js:2493-2557` (handler `POST /api/approval/submit`)

**Reference:** xem toàn handler hiện tại để đặt check đúng vị trí. Insertion point: sau line 2542 (`}` kết thúc `if (entity_type === 'syllabus')` kiểm tra assigned GV), trước line 2544 (`UPDATE ${table} SET ${statusField}='submitted' ...`).

- [ ] **Step 1: Chèn precondition check trước UPDATE**

Mở `server.js`, tìm đoạn:

```js
    // For syllabus: verify submitter is the assigned GV or has higher role
    if (entity_type === 'syllabus') {
      const assignCheck = await pool.query(
        'SELECT assigned_to FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2',
        [current.rows[0].version_id, current.rows[0].course_id]
      );
      if (assignCheck.rows.length && assignCheck.rows[0].assigned_to !== req.user.id) {
        const adminCheck = await isAdmin(req.user.id);
        const roles = await getUserRoles(req.user.id);
        const maxLvl = Math.max(...roles.map(r => r.level), 0);
        if (!adminCheck && maxLvl < 2) {
          return res.status(403).json({ error: 'Chỉ giảng viên được phân công mới có thể nộp đề cương' });
        }
      }
    }

    await pool.query(`UPDATE ${table} SET ${statusField}='submitted', is_rejected=false, updated_at=NOW() WHERE id=$1`, [entity_id]);
```

Chèn block mới **giữa** `}` đóng `if (entity_type === 'syllabus')` và dòng `await pool.query(`UPDATE ${table} ...`. Sau khi sửa, đoạn đó trông như sau:

```js
    // For syllabus: verify submitter is the assigned GV or has higher role
    if (entity_type === 'syllabus') {
      const assignCheck = await pool.query(
        'SELECT assigned_to FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2',
        [current.rows[0].version_id, current.rows[0].course_id]
      );
      if (assignCheck.rows.length && assignCheck.rows[0].assigned_to !== req.user.id) {
        const adminCheck = await isAdmin(req.user.id);
        const roles = await getUserRoles(req.user.id);
        const maxLvl = Math.max(...roles.map(r => r.level), 0);
        if (!adminCheck && maxLvl < 2) {
          return res.status(403).json({ error: 'Chỉ giảng viên được phân công mới có thể nộp đề cương' });
        }
      }
    }

    // For program_version: all courses must have a syllabus approved by Trưởng ngành or higher
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
        if (r.has_approved) continue;
        const label = r.code ? `${r.code} — ${r.name}` : `(Chờ cấp mã) ${r.name}`;
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

    await pool.query(`UPDATE ${table} SET ${statusField}='submitted', is_rejected=false, updated_at=NOW() WHERE id=$1`, [entity_id]);
```

Quan trọng:
- Vị trí: trước `UPDATE ... SET status='submitted' ...` và sau khối syllabus assign check.
- Không đụng bất kỳ phần nào khác của handler.
- Indentation: 4 spaces inside route (như surrounding code).

- [ ] **Step 2: Verify parse**

```bash
node --check server.js
```

Expected: exit 0.

- [ ] **Step 3: Quick logic sanity test via psql (no UI required)**

Mục đích: xác nhận câu SQL trả đúng cấu trúc. Dùng `docker exec` query trực tiếp:

```bash
docker exec -i program-db psql -U program -d program_db <<'SQL'
-- Pick any draft version for test
SELECT id, program_id, status FROM program_versions WHERE status='draft' ORDER BY id LIMIT 1;
SQL
```

Note ID (gọi là `$VID`). Rồi chạy query kiểm tra cấu trúc:

```bash
docker exec -i program-db psql -U program -d program_db <<SQL
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
WHERE vc.version_id = $VID
ORDER BY c.code NULLS LAST, c.name;
SQL
```

Replace `$VID` với id vừa note. Expected: returns rows mỗi row có 5 column, không syntax error. Nếu version không có HP nào, returns 0 rows — vẫn hợp lệ.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "$(cat <<'EOF'
feat(api): require Trưởng ngành-approved syllabus before submitting CTĐT

POST /api/approval/submit now blocks the draft → submitted transition
for a program_version when any course in it either has no syllabus
row or has a syllabus whose status is below approved_tbm.

Returns 400 with details.missing (courses with no syllabus) and
details.not_approved (courses with syllabus still pending approval),
each a list of human-readable labels "<code> — <name>" or
"(Chờ cấp mã) <name>" for proposed courses.

Uses EXISTS subqueries so duplicate syllabus rows per (version, course)
do not produce duplicate course entries in the error output and a
course passes if any of its syllabus rows has been approved.
EOF
)"
```

---

## Task 2: Frontend — parse `details` response and show blocked modal

**Files:**
- Modify: `public/js/pages/version-editor.js` — `saveSubmit()` (line 1960-1973) and add new method `showSubmitBlockedModal(errorMsg, details)` near it.

**Reference pattern:** modal dynamic-append pattern như `showProposeCourseModal()` ở line 783. Nó tạo `div.modal-overlay`, append vào body, `requestAnimationFrame` add `.active`, đóng bằng backdrop click + button.

- [ ] **Step 1: Sửa `saveSubmit()` để parse `details`**

Tìm đoạn (quanh line 1960-1973):

```js
  async saveSubmit() {
    try {
      const res = await fetch('/api/approval/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: this.versionId })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã nộp');
      if (window.App.refreshNotificationCount) window.App.refreshNotificationCount();
      this.version.status = 'submitted';
      this.version.is_rejected = false;
      this.render(document.getElementById('page-content'), this.versionId);
    } catch (e) { window.toast.error(e.message); }
  },
```

Thay bằng:

```js
  async saveSubmit() {
    try {
      const res = await fetch('/api/approval/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: this.versionId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.details && (Array.isArray(body.details.missing) || Array.isArray(body.details.not_approved))) {
          this.showSubmitBlockedModal(body.error || 'Chưa đủ điều kiện nộp CTĐT', body.details);
          return;
        }
        throw new Error(body.error || 'Có lỗi xảy ra');
      }
      window.toast.success('Đã nộp');
      if (window.App.refreshNotificationCount) window.App.refreshNotificationCount();
      this.version.status = 'submitted';
      this.version.is_rejected = false;
      this.render(document.getElementById('page-content'), this.versionId);
    } catch (e) { window.toast.error(e.message); }
  },
```

Quan trọng:
- Dùng `.catch(() => ({}))` để phòng response không phải JSON (không đổi hành vi cho JSON hợp lệ).
- Kiểm tra cả `Array.isArray` cho 2 trường — defensive parsing.
- Return sớm sau khi mở modal, không throw để tránh double-toast.
- Fallback path: throw → catch → `window.toast.error(e.message)` như cũ.

- [ ] **Step 2: Thêm method `showSubmitBlockedModal` ngay sau `saveSubmit()`**

Chèn ngay sau hàm `saveSubmit` (trước `showRejectModal` ở line 1975), method mới:

```js
  showSubmitBlockedModal(errorMsg, details) {
    const missing = Array.isArray(details.missing) ? details.missing : [];
    const notApproved = Array.isArray(details.not_approved) ? details.not_approved : [];
    const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const renderSection = (title, items) => items.length
      ? `<div style="margin-top:14px;">
           <div style="font-weight:600;margin-bottom:6px;">${escape(title)} (${items.length})</div>
           <ul style="margin:0;padding-left:20px;color:var(--text-secondary);font-size:13px;">
             ${items.map(i => `<li>${escape(i)}</li>`).join('')}
           </ul>
         </div>`
      : '';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'submit-blocked-modal';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h2>Chưa thể nộp CTĐT</h2></div>
        <div class="modal-body">
          <p style="margin:0;">${escape(errorMsg)}</p>
          ${renderSection('Chưa soạn đề cương', missing)}
          ${renderSection('Đề cương chưa được Trưởng ngành duyệt', notApproved)}
          <div class="modal-footer" style="margin-top:18px;">
            <button type="button" class="btn btn-primary" onclick="window.VersionEditorPage.closeSubmitBlockedModal()">Đóng</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) window.VersionEditorPage.closeSubmitBlockedModal(); });
  },

  closeSubmitBlockedModal() {
    const modal = document.getElementById('submit-blocked-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => modal.remove(), 200);
  },
```

Quan trọng:
- Dùng `escape()` để phòng XSS (course names nằm trong DB, về lý thuyết trusted, nhưng defensive).
- Ẩn section nếu mảng rỗng (`renderSection` trả về '').
- Pattern close giống `closeProposeCourseModal` — `.active` → `setTimeout(remove, 200)` để giữ transition animation.
- Không sửa gì khác — không thêm dependency, không import module, không thay đổi layout tab.

- [ ] **Step 3: Verify parse (browser-file, chỉ check brace/bracket)**

```bash
node --check public/js/pages/version-editor.js
```

Expected: exit 0. Nó có thể complain về browser globals (window, document, fetch, requestAnimationFrame) — ignore, chỉ cần không lỗi cú pháp.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/version-editor.js
git commit -m "$(cat <<'EOF'
feat(frontend): show blocked-submit modal when syllabi not approved

When POST /api/approval/submit returns 400 with details.missing /
details.not_approved, the version-editor now opens a dedicated modal
listing the two groups separately instead of dumping a raw toast.

Falls back to the existing toast.error for other 400 responses.
EOF
)"
```

---

## Final Verification (Controller + User)

Sau khi cả 2 task commit, controller sẽ handoff cho user để verify bằng UI theo 7 test case trong spec § "Manual Test Plan". Key cases:

- **Test 1** (happy path): version với mọi HP approved_tbm+ → submit success.
- **Test 2** (missing): version có HP không có syllabus → modal hiện, HP trong "Chưa soạn đề cương".
- **Test 3** (not approved): version có HP syllabus `draft` → modal hiện, HP trong "Đề cương chưa được Trưởng ngành duyệt".
- **Test 4** (mixed): cả 2 section hiện đồng thời.
- **Test 5** (0 HP): submit pass.

---

## Self-Review Notes

**Spec coverage:**
- ✅ Server check logic (spec § "Logic check") → Task 1 Step 1
- ✅ 2 EXISTS subquery (spec § "Vì sao dùng 2 subquery EXISTS") → Task 1 Step 1, exact SQL
- ✅ Label format (spec § "Label HP") → Task 1 Step 1, ternary on `r.code`
- ✅ Insertion point (spec § "Vị trí") → Task 1 Step 1, exact before/after context
- ✅ Frontend `saveSubmit` sửa (spec § "Client Changes > Logic") → Task 2 Step 1
- ✅ Modal UI (spec § "Modal UI") → Task 2 Step 2, exact layout với section rỗng ẩn
- ✅ Fallback toast (spec § "Client Changes") → Task 2 Step 1, `throw new Error` path giữ nguyên
- ✅ Edge cases (spec § "Edge cases table") — tất cả đều auto-handled bởi SQL + labeling logic

**Placeholder scan:** none. Tất cả code blocks hoàn chỉnh. `$VID` trong Task 1 Step 3 là placeholder hướng dẫn cho người chạy, không phải trong code commit.

**Type/ID consistency:** 
- Response field `details.not_approved` (snake_case) ↔ client đọc `body.details.not_approved` — khớp.
- Response field `details.missing` ↔ client đọc `body.details.missing` — khớp.
- SQL column `has_approved`, `has_any` ↔ JS đọc `r.has_approved`, `r.has_any` — khớp.
