# Simplify Syllabus Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đơn giản hoá vòng duyệt đề cương về 1 bước (Trưởng ngành duyệt → published), fix bug `is_locked does not exist` cho syllabus, migrate legacy syllabi ở trạng thái trung gian.

**Architecture:** Bug fix + simplification trong handler review (`server.js`), migration trong `initDB()`, dọn UI label maps ở 5 file frontend.

**Tech Stack:** Node.js + Express + PostgreSQL 15, vanilla JS frontend. Không test framework.

**Spec:** [docs/superpowers/specs/2026-04-15-simplify-syllabus-approval-design.md](../specs/2026-04-15-simplify-syllabus-approval-design.md)

---

## File Structure

**Modify (7 files):**
- `db.js` — thêm migration UPDATE syllabi vào `initDB()`.
- `server.js` — 3 edits trong handler `POST /api/approval/review` (bug fix + 2 maps simplification) + 1 edit ở submit-block check.
- `public/js/pages/my-assignments.js` — bỏ 3 trạng thái trung gian khỏi syllabus statusLabels.
- `public/js/pages/version-editor.js` — bỏ 3 trạng thái trung gian khỏi syllabus statusLabels (line 1760).
- `public/js/pages/dashboard.js` — bỏ 3 trạng thái trung gian khỏi map syllabus (line 37).
- `public/js/pages/syllabus-editor.js` — bỏ 3 trạng thái trung gian khỏi statusLabels (line 65).
- `public/js/pages/approval.js` — bỏ `approved_tbm` khỏi shared statusLabels + đơn giản hoá `getRequiredPerm` syllabus branch + đơn giản hoá `hasAnyApproval` syllabus list.

3 task:
- **Task 1**: server + DB (bug fix + workflow simplification + migration).
- **Task 2**: Frontend cleanup (5 files).

---

## Task 1: Server + DB changes

**Files:**
- Modify: `server.js` — 4 edits in `POST /api/approval/review` handler (around line 2598-2716) + 1 edit in `POST /api/approval/submit` handler (around line 2548-2553).
- Modify: `db.js` — append migration to `initDB()`.

- [ ] **Step 1: Bug fix — guard `is_locked` cho program_version**

Trong `server.js`, tìm đoạn (line 2712-2716):

```js
    const isLocking = (nextStatus === 'published');
    await pool.query(
      `UPDATE ${table} SET status=$1, is_rejected=false, rejection_reason=NULL, updated_at=NOW() ${isLocking ? ', is_locked=true' : ''} WHERE id=$2`,
      [nextStatus, entity_id]
    );
```

Sửa thành:

```js
    const isLocking = (nextStatus === 'published' && entity_type === 'program_version');
    await pool.query(
      `UPDATE ${table} SET status=$1, is_rejected=false, rejection_reason=NULL, updated_at=NOW() ${isLocking ? ', is_locked=true' : ''} WHERE id=$2`,
      [nextStatus, entity_id]
    );
```

Chỉ sửa biểu thức `isLocking` — thêm `&& entity_type === 'program_version'`.

- [ ] **Step 2: Đơn giản hoá syllabus permission map**

Tìm đoạn (line 2634-2642):

```js
    } else {
      const perms = {
        submitted: 'syllabus.approve_tbm',
        approved_tbm: 'syllabus.approve_khoa',
        approved_khoa: 'syllabus.approve_pdt',
        approved_pdt: 'syllabus.approve_bgh'
      };
      requiredPerm = perms[status];
    }
```

Thay bằng:

```js
    } else {
      const perms = {
        submitted: 'syllabus.approve_tbm'
      };
      requiredPerm = perms[status];
    }
```

- [ ] **Step 3: Đơn giản hoá syllabus flow map**

Tìm đoạn (line 2686-2694):

```js
    } else {
      const flow = {
        submitted: 'approved_tbm',
        approved_tbm: 'approved_khoa',
        approved_khoa: 'approved_pdt',
        approved_pdt: 'published'
      };
      nextStatus = flow[status];
    }
```

Thay bằng:

```js
    } else {
      const flow = {
        submitted: 'published'
      };
      nextStatus = flow[status];
    }
```

- [ ] **Step 4: Đơn giản hoá submit-CTĐT block check**

Tìm đoạn trong handler `POST /api/approval/submit` (around line 2548-2553):

```js
               EXISTS(
                 SELECT 1 FROM version_syllabi vs
                 WHERE vs.version_id = vc.version_id
                   AND vs.course_id = vc.course_id
                   AND vs.status IN ('approved_tbm','approved_khoa','approved_pdt','published')
               ) AS has_approved,
```

Thay `IN (...)` bằng `=`:

```js
               EXISTS(
                 SELECT 1 FROM version_syllabi vs
                 WHERE vs.version_id = vc.version_id
                   AND vs.course_id = vc.course_id
                   AND vs.status = 'published'
               ) AS has_approved,
```

Chỉ đổi 1 dòng (line `AND vs.status IN (...)` → `AND vs.status = 'published'`).

- [ ] **Step 5: Thêm migration vào `initDB()`**

Trong `db.js`, tìm đoạn migration đã có ở Task trước (xung quanh line 355-362):

```js
    `);

    // Migration: chuẩn hoá academic_year từ "YYYY-YYYY" sang "YYYY" (lấy 4 chữ số đầu).
    // Idempotent: row đã đúng định dạng hoặc format lạ không match regex sẽ skip.
    await client.query(`
      UPDATE program_versions
         SET academic_year = SUBSTRING(academic_year FROM 1 FOR 4)
       WHERE academic_year ~ '^\\d{4}-\\d{4}$'
    `);

    console.log('  ✅ Database schema initialized');
```

Thêm 1 migration nữa NGAY SAU migration academic_year (cùng style, trước `console.log`):

```js
    `);

    // Migration: chuẩn hoá academic_year từ "YYYY-YYYY" sang "YYYY" (lấy 4 chữ số đầu).
    // Idempotent: row đã đúng định dạng hoặc format lạ không match regex sẽ skip.
    await client.query(`
      UPDATE program_versions
         SET academic_year = SUBSTRING(academic_year FROM 1 FOR 4)
       WHERE academic_year ~ '^\\d{4}-\\d{4}$'
    `);

    // Migration: syllabi đã qua bất kỳ bước duyệt cũ (approved_tbm/khoa/pdt) → published.
    // Workflow syllabus đã đơn giản hoá: chỉ Trưởng ngành duyệt là thông qua.
    // Idempotent: row đã ở trạng thái khác sẽ skip.
    await client.query(`
      UPDATE version_syllabi
         SET status = 'published', updated_at = NOW()
       WHERE status IN ('approved_tbm', 'approved_khoa', 'approved_pdt')
    `);

    console.log('  ✅ Database schema initialized');
```

- [ ] **Step 6: Verify parse**

```bash
node --check server.js && node --check db.js && echo OK
```

Expected: `OK`.

- [ ] **Step 7: Verify migration runs end-to-end**

Snapshot trước:

```bash
docker exec -i program-db psql -U program -d program_db -c "
SELECT status, COUNT(*) FROM version_syllabi GROUP BY status ORDER BY status;
"
```

Note kết quả (kỳ vọng có rows ở `approved_pdt` theo screenshot user — 4 rows).

Restart server (file watch sẽ trigger). Nếu không tiện start `make dev`, simulate bằng SQL trực tiếp:

```bash
docker exec -i program-db psql -U program -d program_db -c "
UPDATE version_syllabi SET status = 'published', updated_at = NOW()
WHERE status IN ('approved_tbm','approved_khoa','approved_pdt');
"
```

Query lại:

```bash
docker exec -i program-db psql -U program -d program_db -c "
SELECT status, COUNT(*) FROM version_syllabi GROUP BY status ORDER BY status;
"
```

Expected: không còn row ở `approved_tbm/khoa/pdt`. Các row đó giờ ở `published`.

- [ ] **Step 8: Commit**

```bash
git add server.js db.js
git commit -m "$(cat <<'EOF'
feat(api): simplify syllabus approval to single-step + fix is_locked bug

Syllabus approval flow is now a single transition: submitted → published,
gated by the syllabus.approve_tbm permission. The old intermediate states
(approved_tbm, approved_khoa, approved_pdt) are no longer reachable for
new syllabi, and a migration in initDB promotes any legacy rows in those
states to published.

Also fix a bug where the review handler tried to set is_locked=true on
version_syllabi (which has no such column) when promoting to published.
The is_locked update now only applies to program_version.

The submit-CTĐT precondition check is simplified accordingly: a syllabus
counts as approved iff status='published'.
EOF
)"
```

---

## Task 2: Frontend label cleanup

**Files:**
- Modify: `public/js/pages/my-assignments.js` (1 edit)
- Modify: `public/js/pages/version-editor.js` (1 edit)
- Modify: `public/js/pages/dashboard.js` (1 edit)
- Modify: `public/js/pages/syllabus-editor.js` (1 edit)
- Modify: `public/js/pages/approval.js` (3 edits)

Tất cả là rút gọn label maps / permission maps. Không đổi logic.

- [ ] **Step 1: `my-assignments.js` (line ~51-52)**

Tìm:

```js
      draft: 'Nháp', submitted: 'Đã nộp', approved_tbm: 'TBM ✓',
      approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố'
```

Thay bằng:

```js
      draft: 'Nháp', submitted: 'Đã nộp', published: 'Công bố'
```

(Bỏ 3 entry trung gian. Map này chỉ dùng cho syllabus assignments.)

- [ ] **Step 2: `version-editor.js` (line ~1760)**

Tìm:

```js
    const statusLabels = { draft: 'Nháp', submitted: 'Đã nộp', approved_tbm: 'TBM ✓', approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố' };
```

Thay bằng:

```js
    const statusLabels = { draft: 'Nháp', submitted: 'Đã nộp', published: 'Công bố' };
```

(Map này render cột status trong tab Đề cương — chỉ dùng cho syllabus.)

- [ ] **Step 3: `dashboard.js` (line ~37)**

Tìm:

```js
              draft: 'Nháp', submitted: 'Đã nộp', approved_tbm: 'TBM ✓', approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố'
```

Thay bằng:

```js
              draft: 'Nháp', submitted: 'Đã nộp', published: 'Công bố'
```

(Map này dùng cho syllabus card trong dashboard. Map khác ở line 31 — không có `approved_tbm` — là cho program_version, KHÔNG đụng.)

- [ ] **Step 4: `syllabus-editor.js` (line ~65)**

Tìm:

```js
    const statusLabels = { draft:'Nháp', submitted:'Đã nộp', approved_tbm:'TBM duyệt', approved_khoa:'Khoa duyệt', approved_pdt:'PĐT duyệt', published:'Công bố' };
```

Thay bằng:

```js
    const statusLabels = { draft:'Nháp', submitted:'Đã nộp', published:'Công bố' };
```

- [ ] **Step 5: `approval.js` — 3 edits**

**Edit 5.1** — line 7-13 (shared statusLabels — chỉ bỏ `approved_tbm`, GIỮ `approved_khoa`/`approved_pdt` cho program_version):

Tìm:

```js
      const statusLabels = {
        draft: 'Nháp',
        submitted: 'Đã nộp',
        approved_tbm: 'TBM ✓',
        approved_khoa: 'Khoa ✓',
        approved_pdt: 'PĐT ✓'
      };
```

Thay bằng:

```js
      const statusLabels = {
        draft: 'Nháp',
        submitted: 'Đã nộp',
        approved_khoa: 'Khoa ✓',
        approved_pdt: 'PĐT ✓'
      };
```

(Chỉ bỏ dòng `approved_tbm`.)

**Edit 5.2** — line 23-30 (`getRequiredPerm` syllabus branch):

Tìm:

```js
        } else {
          return {
            submitted: 'syllabus.approve_tbm',
            approved_tbm: 'syllabus.approve_khoa',
            approved_khoa: 'syllabus.approve_pdt',
            approved_pdt: 'syllabus.approve_bgh'
          }[status];
        }
```

Thay bằng:

```js
        } else {
          return {
            submitted: 'syllabus.approve_tbm'
          }[status];
        }
```

**Edit 5.3** — line 35-37 (`hasAnyApproval` syllabus branch):

Tìm:

```js
        const perms = type === 'program_version'
          ? ['programs.approve_khoa', 'programs.approve_pdt', 'programs.approve_bgh']
          : ['syllabus.approve_tbm', 'syllabus.approve_khoa', 'syllabus.approve_pdt', 'syllabus.approve_bgh'];
```

Thay bằng:

```js
        const perms = type === 'program_version'
          ? ['programs.approve_khoa', 'programs.approve_pdt', 'programs.approve_bgh']
          : ['syllabus.approve_tbm'];
```

(Chỉ đổi nhánh else — danh sách syllabus permissions. Nhánh program_version giữ nguyên.)

- [ ] **Step 6: Verify parse 5 file**

```bash
node --check public/js/pages/my-assignments.js && \
  node --check public/js/pages/version-editor.js && \
  node --check public/js/pages/dashboard.js && \
  node --check public/js/pages/syllabus-editor.js && \
  node --check public/js/pages/approval.js && echo OK
```

Expected: `OK`.

- [ ] **Step 7: Sanity grep — không còn syllabus-specific label cũ ở những chỗ vừa sửa**

```bash
grep -nE "approved_tbm|syllabus\.approve_(khoa|pdt|bgh)" public/js/pages/my-assignments.js public/js/pages/version-editor.js public/js/pages/dashboard.js public/js/pages/syllabus-editor.js public/js/pages/approval.js
```

Expected: chỉ còn `approved_khoa`/`approved_pdt` trong `approval.js` shared statusLabels (line 11-12 sau edit) — vì các status đó vẫn dùng cho program_version. Không còn `approved_tbm` hay `syllabus.approve_khoa/pdt/bgh` reference.

- [ ] **Step 8: Commit**

```bash
git add public/js/pages/my-assignments.js public/js/pages/version-editor.js public/js/pages/dashboard.js public/js/pages/syllabus-editor.js public/js/pages/approval.js
git commit -m "$(cat <<'EOF'
refactor(frontend): drop syllabus intermediate-status labels and perms

After simplifying the syllabus approval to a single Trưởng-ngành step
on the server, intermediate statuses (approved_tbm, approved_khoa,
approved_pdt) can no longer occur for syllabi. Drop them from the
syllabus-only label maps and from approval.js getRequiredPerm /
hasAnyApproval syllabus branches.

The shared statusLabels in approval.js keeps approved_khoa / approved_pdt
because the program_version flow still uses them.
EOF
)"
```

---

## Final Verification (Controller + User)

After both tasks commit, controller hands off to user. Key verifications:

1. **Migration:** query `SELECT status, COUNT(*) FROM version_syllabi GROUP BY status;` — không còn row ở `approved_tbm/khoa/pdt` (4 row đó giờ là `published`).
2. **Bug fix:** vào syllabus-editor hoặc approval của 1 syllabus đang `submitted`, click Duyệt → expect success, status → `published`. Không còn lỗi `is_locked`.
3. **Single-step:** sau Duyệt, không còn nút Duyệt nữa (terminal).
4. **Submit-CTĐT block:** test lại flow trước (CTĐT có HP syllabus draft → modal block hiện đúng).
5. **Tab Đề cương:** badges chỉ còn "Nháp" / "Đã nộp" / "Công bố" / "Chưa tạo".
6. **Program_version flow:** không bị ảnh hưởng — duyệt CTĐT vẫn 4 bước (submitted → approved_khoa → approved_pdt → published).

---

## Self-Review Notes

**Spec coverage:**
- ✅ Bug fix `is_locked` → Task 1 Step 1
- ✅ Permission map simplification → Task 1 Step 2
- ✅ Flow map simplification → Task 1 Step 3
- ✅ Submit-CTĐT check simplification → Task 1 Step 4
- ✅ Migration → Task 1 Step 5
- ✅ Frontend label cleanup (5 files) → Task 2 Steps 1-5
- ✅ Out of scope (DB permission cleanup) — explicitly noted in spec, no task

**Placeholder scan:** none.

**Type/ID consistency:**
- `entity_type === 'program_version'` (string literal) used consistently in both Task 1 Step 1 (new guard) and existing handler.
- All UPDATE / INSERT column names match db.js schema.
- Frontend status string values (`'submitted'`, `'published'`, etc.) match server-side flow.
