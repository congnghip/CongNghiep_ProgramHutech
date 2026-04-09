# Inline Approval In Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let approvers review CTDT versions and syllabi directly inside `version-editor` and `syllabus-editor` after opening an approval-needed notification.

**Architecture:** Reuse the existing approval workflow and `POST /api/approval/review` endpoint. Add a compact inline approval block plus reject modal behavior to each editor, deriving actionability from the loaded entity status and the current user's permissions. Keep the Approval page unchanged as the global queue.

**Tech Stack:** Vanilla JS SPA, existing page objects in `public/js/pages`, existing approval API in Express/Postgres backend, Playwright end-to-end tests.

---

## File Map

- Modify: `public/js/pages/version-editor.js`
  - Add current-step approval mapping for CTDT versions.
  - Render inline approval block and reject modal in the page header area.
  - Add approve/reject handlers that reuse `/api/approval/review`.
- Modify: `public/js/pages/syllabus-editor.js`
  - Add current-step approval mapping for syllabi.
  - Render the same inline approval block and reject modal pattern.
  - Add approve/reject handlers that reuse `/api/approval/review`.
- Modify: `tests/notifications.spec.js`
  - Cover notification-driven navigation into each editor and inline approval visibility/actions.
- Optional verify only: `public/js/pages/approval.js`
  - Reference for existing status-to-permission mapping and reject modal behavior. No planned code change.

### Task 1: Add Inline Approval To CTDT Version Editor

**Files:**
- Modify: `public/js/pages/version-editor.js`
- Test: `tests/notifications.spec.js`

- [ ] **Step 1: Write the failing CTDT inline-approval tests**

Add two tests in `tests/notifications.spec.js` near the existing notification navigation cases:

```js
test('TC_NOTIF_13: approval notification opens version editor with inline approve actions', async ({ page }) => {
  await login(page, 'lanhdaokhoa', 'admin123');
  // create submitted version, seed approval_needed notification that links to version-editor
  // open drawer, click item
  // expect page title/version breadcrumb visible
  // expect buttons "Duyệt" and "Từ chối" inside inline approval block
});

test('TC_NOTIF_14: approving inline from version editor updates status and notification badge', async ({ page }) => {
  await login(page, 'lanhdaokhoa', 'admin123');
  // create submitted version + notification
  // click notification, approve inline, expect success toast
  // verify /api/versions/:id returns approved_khoa
  // refresh notification count and assert badge changed or hidden
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_13|TC_NOTIF_14"
```

Expected:
- FAIL because `version-editor` does not render inline approval actions yet.

- [ ] **Step 3: Add approval-step helpers to `version-editor`**

In `public/js/pages/version-editor.js`, add focused helpers near `getStatusEditPerm`:

```js
  getApprovalPerm(status) {
    return {
      submitted: 'programs.approve_khoa',
      approved_khoa: 'programs.approve_pdt',
      approved_pdt: 'programs.approve_bgh'
    }[status] || null;
  },

  getApprovalStepLabel(status) {
    return {
      submitted: 'cấp Khoa',
      approved_khoa: 'cấp Phòng Đào tạo',
      approved_pdt: 'cấp Ban Giám hiệu'
    }[status] || '';
  },

  canCurrentUserApprove() {
    if (!this.version || this.version.is_rejected) return false;
    const perm = this.getApprovalPerm(this.version.status);
    return !!perm && window.App.hasPerm(perm);
  },
```

- [ ] **Step 4: Render the inline approval block in the version header**

Update the main header template in `render(container, versionId)` to append a compact block under the rejection banner / header:

```js
      ${this.canCurrentUserApprove() ? `
        <div class="card" style="margin-bottom:16px;padding:16px;">
          <div class="flex-between" style="align-items:flex-start;gap:16px;">
            <div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Phê duyệt hồ sơ</div>
              <div style="font-size:14px;font-weight:600;margin-bottom:6px;">CTĐT đang chờ bạn duyệt ở ${this.getApprovalStepLabel(this.version.status)}</div>
              <div class="page-header-meta">
                <span class="badge badge-info">${this.version.status}</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.approveInline()">Duyệt</button>
              <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.VersionEditorPage.showRejectModal()">Từ chối</button>
            </div>
          </div>
        </div>
      ` : ''}
```

- [ ] **Step 5: Add the version-editor reject modal and action handlers**

Reuse the Approval page workflow directly in `public/js/pages/version-editor.js`:

```js
  showRejectModal() {
    document.getElementById('version-reject-notes').value = '';
    document.getElementById('version-reject-error').textContent = '';
    document.getElementById('version-reject-modal').classList.add('active');
    App.modalGuard('version-reject-modal', () => this.confirmRejectInline());
  },

  async approveInline() {
    const confirmed = await window.ui.confirm({
      title: 'Phê duyệt CTĐT',
      eyebrow: 'Xác nhận thao tác',
      message: 'Bạn có chắc muốn phê duyệt CTĐT này?',
      confirmText: 'Phê duyệt',
      cancelText: 'Hủy'
    });
    if (!confirmed) return;
    await this.reviewInline('approve');
  },

  async confirmRejectInline() {
    await this.reviewInline('reject', document.getElementById('version-reject-notes').value.trim());
  },

  async reviewInline(action, notes = '') {
    const res = await fetch('/api/approval/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'program_version', entity_id: this.versionId, action, notes })
    });
    if (!res.ok) throw new Error((await res.json()).error);
    if (action === 'reject') document.getElementById('version-reject-modal').classList.remove('active');
    window.toast.success(action === 'approve' ? 'Đã phê duyệt' : 'Đã từ chối');
    if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
    await this.render(document.getElementById('page-content'), this.versionId);
  },
```

Render the modal markup next to the header/footer in the page template:

```js
      <div class="modal-overlay" id="version-reject-modal">
        <div class="modal">
          <div class="modal-header"><h2>Từ chối phê duyệt CTĐT</h2></div>
          <div class="modal-body">
            <div class="input-group"><label>Lý do từ chối</label><textarea id="version-reject-notes" rows="3" placeholder="Nhập lý do..."></textarea></div>
            <div class="modal-error" id="version-reject-error"></div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('version-reject-modal').classList.remove('active')">Hủy</button>
              <button class="btn btn-danger" onclick="window.VersionEditorPage.confirmRejectInline()">Từ chối</button>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 6: Run the targeted CTDT tests to verify they pass**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_13|TC_NOTIF_14"
```

Expected:
- PASS

- [ ] **Step 7: Commit the version-editor slice**

```bash
git add public/js/pages/version-editor.js tests/notifications.spec.js
git commit -m "feat: add inline CTDT approval in version editor"
```

### Task 2: Add Inline Approval To Syllabus Editor

**Files:**
- Modify: `public/js/pages/syllabus-editor.js`
- Test: `tests/notifications.spec.js`

- [ ] **Step 1: Write the failing syllabus inline-approval tests**

Extend `tests/notifications.spec.js` with two syllabus-focused cases:

```js
test('TC_NOTIF_15: approval notification opens syllabus editor with inline approve actions', async ({ page }) => {
  await login(page, 'truongbomon', 'admin123');
  // create draft syllabus, submit it, seed approval notification to syllabus-editor
  // open notification and assert inline block with Duyệt/Từ chối
});

test('TC_NOTIF_16: rejecting inline from syllabus editor keeps workflow in editor and refreshes notifications', async ({ page }) => {
  await login(page, 'truongbomon', 'admin123');
  // open notification, click Từ chối, submit notes
  // expect rejection toast, reloaded rejection banner, notification count refresh
});
```

- [ ] **Step 2: Run the targeted syllabus test to verify it fails**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_15|TC_NOTIF_16"
```

Expected:
- FAIL because `syllabus-editor` has no inline approval UI yet.

- [ ] **Step 3: Add approval-step helpers to `syllabus-editor`**

Add focused helpers near the page object state:

```js
  getApprovalPerm(status) {
    return {
      submitted: 'syllabus.approve_tbm',
      approved_tbm: 'syllabus.approve_khoa',
      approved_khoa: 'syllabus.approve_pdt',
      approved_pdt: 'syllabus.approve_bgh'
    }[status] || null;
  },

  getApprovalStepLabel(status) {
    return {
      submitted: 'cấp Trưởng bộ môn',
      approved_tbm: 'cấp Khoa',
      approved_khoa: 'cấp Phòng Đào tạo',
      approved_pdt: 'cấp Ban Giám hiệu'
    }[status] || '';
  },

  canCurrentUserApprove() {
    if (!this.syllabus || this.syllabus.is_rejected) return false;
    const perm = this.getApprovalPerm(this.syllabus.status);
    return !!perm && window.App.hasPerm(perm);
  },
```

- [ ] **Step 4: Render the inline block and reject modal in `syllabus-editor`**

Insert a block below the header with the same visual structure as the CTDT version:

```js
      ${this.canCurrentUserApprove() ? `
        <div class="card" style="margin-bottom:16px;padding:16px;">
          <div class="flex-between" style="align-items:flex-start;gap:16px;">
            <div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Phê duyệt hồ sơ</div>
              <div style="font-size:14px;font-weight:600;margin-bottom:6px;">Đề cương đang chờ bạn duyệt ở ${this.getApprovalStepLabel(this.syllabus.status)}</div>
              <div class="page-header-meta">
                <span class="badge badge-info">${statusLabels[s.status] || s.status}</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.approveInline()">Duyệt</button>
              <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.SyllabusEditorPage.showRejectModal()">Từ chối</button>
            </div>
          </div>
        </div>
      ` : ''}
```

Add matching modal markup:

```js
      <div class="modal-overlay" id="syllabus-reject-modal">
        <div class="modal">
          <div class="modal-header"><h2>Từ chối phê duyệt đề cương</h2></div>
          <div class="modal-body">
            <div class="input-group"><label>Lý do từ chối</label><textarea id="syllabus-reject-notes" rows="3" placeholder="Nhập lý do..."></textarea></div>
            <div class="modal-error" id="syllabus-reject-error"></div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('syllabus-reject-modal').classList.remove('active')">Hủy</button>
              <button class="btn btn-danger" onclick="window.SyllabusEditorPage.confirmRejectInline()">Từ chối</button>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 5: Add syllabus inline approve/reject handlers**

Implement the handlers by mirroring Task 1 with `entity_type: 'syllabus'`:

```js
  async approveInline() {
    const confirmed = await window.ui.confirm({
      title: 'Phê duyệt đề cương',
      eyebrow: 'Xác nhận thao tác',
      message: 'Bạn có chắc muốn phê duyệt đề cương này?',
      confirmText: 'Phê duyệt',
      cancelText: 'Hủy'
    });
    if (!confirmed) return;
    await this.reviewInline('approve');
  },

  showRejectModal() {
    document.getElementById('syllabus-reject-notes').value = '';
    document.getElementById('syllabus-reject-error').textContent = '';
    document.getElementById('syllabus-reject-modal').classList.add('active');
    App.modalGuard('syllabus-reject-modal', () => this.confirmRejectInline());
  },

  async confirmRejectInline() {
    await this.reviewInline('reject', document.getElementById('syllabus-reject-notes').value.trim());
  },

  async reviewInline(action, notes = '') {
    const res = await fetch('/api/approval/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'syllabus', entity_id: this.syllabusId, action, notes })
    });
    if (!res.ok) throw new Error((await res.json()).error);
    if (action === 'reject') document.getElementById('syllabus-reject-modal').classList.remove('active');
    window.toast.success(action === 'approve' ? 'Đã phê duyệt' : 'Đã từ chối');
    if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
    await this.render(document.getElementById('page-content'), this.syllabusId);
  },
```

- [ ] **Step 6: Run the targeted syllabus tests to verify they pass**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_15|TC_NOTIF_16"
```

Expected:
- PASS

- [ ] **Step 7: Commit the syllabus-editor slice**

```bash
git add public/js/pages/syllabus-editor.js tests/notifications.spec.js
git commit -m "feat: add inline syllabus approval in editor"
```

### Task 3: Cover Permission Gating And Shared Notification Refresh

**Files:**
- Modify: `tests/notifications.spec.js`
- Modify: `public/js/pages/version-editor.js`
- Modify: `public/js/pages/syllabus-editor.js`

- [ ] **Step 1: Add a failing permission-gating regression test**

Add one negative-path Playwright case:

```js
test('TC_NOTIF_17: users without current-step approval permission do not see inline actions in editors', async ({ page }) => {
  await login(page, 'giangvien', 'admin123');
  // open a submitted version-editor and a submitted syllabus-editor
  // assert no "Phê duyệt hồ sơ", no Duyệt button, no Từ chối button
});
```

- [ ] **Step 2: Run the negative-path test to verify current behavior**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_17"
```

Expected:
- PASS only after both editors gate on exact current-step approval permission.

- [ ] **Step 3: Normalize success/failure refresh behavior in both editors**

Ensure both editors use the same pattern after approve/reject:

```js
    if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
    await this.render(document.getElementById('page-content'), this.versionId); // or syllabusId
```

And on failure:

```js
    window.toast.error(e.message);
    await this.render(document.getElementById('page-content'), this.versionId); // or syllabusId
```

This keeps stale inline approval blocks from lingering after a race with another reviewer.

- [ ] **Step 4: Run the expanded notification suite**

Run:

```bash
npx playwright test tests/notifications.spec.js
```

Expected:
- PASS
- Existing notification drawer cases still pass.

- [ ] **Step 5: Commit the gating/polish slice**

```bash
git add public/js/pages/version-editor.js public/js/pages/syllabus-editor.js tests/notifications.spec.js
git commit -m "test: cover inline approval permissions and refresh"
```

### Task 4: Final Regression Verification

**Files:**
- Verify: `public/js/pages/version-editor.js`
- Verify: `public/js/pages/syllabus-editor.js`
- Verify: `tests/notifications.spec.js`
- Verify: `tests/all_features.test.js`

- [ ] **Step 1: Run syntax checks on changed files**

Run:

```bash
node --check public/js/pages/version-editor.js
node --check public/js/pages/syllabus-editor.js
node --check tests/notifications.spec.js
```

Expected:
- All commands exit `0`

- [ ] **Step 2: Run focused approval/editor regression tests**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_13|TC_NOTIF_14|TC_NOTIF_15|TC_NOTIF_16|TC_NOTIF_17"
```

Expected:
- PASS

- [ ] **Step 3: Run broader workflow regression**

Run:

```bash
npx playwright test tests/all_features.test.js -g "Approval|Assignments"
```

Expected:
- PASS
- Existing approval and assignment flows remain intact.

- [ ] **Step 4: Check worktree cleanliness and review diff**

Run:

```bash
git status --short
git diff --stat
```

Expected:
- Only intended editor/test changes remain before final integration.

- [ ] **Step 5: Commit final verification-safe adjustments**

```bash
git add public/js/pages/version-editor.js public/js/pages/syllabus-editor.js tests/notifications.spec.js
git commit -m "fix: finalize inline approval editor workflow"
```

## Self-Review

- **Spec coverage:** The plan covers inline approve/reject in both editors, exact-step permission gating, reuse of existing approval API, notification refresh, and regression tests. No task changes notification routing or replaces the Approval page.
- **Placeholder scan:** No `TBD`, `TODO`, or deferred “write tests later” steps remain.
- **Type consistency:** The plan keeps existing entity types (`program_version`, `syllabus`) and reuses `POST /api/approval/review`, `window.App.refreshNotificationCount()`, and page-local `render(...)` refresh patterns consistently.
