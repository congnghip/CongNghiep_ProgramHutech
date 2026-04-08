# Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent notification center for approval work and syllabus authoring assignments, surfaced as a sidebar bell with unread badge and a right-side drawer.

**Architecture:** Add a `notifications` table and backend helper functions that create idempotent read/unread notifications from assignment and approval workflow events. Expose notification list/count/read APIs, backfill currently actionable work on startup, and add a vanilla JS drawer in the existing app shell with 60-second unread-count polling.

**Tech Stack:** Express.js, PostgreSQL via `pg`, vanilla JavaScript SPA, Playwright tests.

---

## File Structure

- Modify `db.js`
  - Add the `notifications` table and indexes in `initDB()`.
  - Add an idempotent notification backfill function called from `seedData(client)`.
- Modify `server.js`
  - Add notification helper functions before `// ============ SYLLABUS ASSIGNMENTS ============`.
  - Add `/api/notifications` routes.
  - Hook assignment, submission, approval, and rejection flows.
- Modify `public/js/app.js`
  - Add sidebar notification trigger, unread badge, polling, drawer rendering, filter handling, read/read-all actions, and navigation from notification items.
- Modify `public/js/pages/version-editor.js`
  - Refresh the notification badge after assignment and CTĐT submission actions.
- Modify `public/js/pages/syllabus-editor.js`
  - Refresh the notification badge after syllabus submission.
- Modify `public/js/pages/approval.js`
  - Refresh the notification badge after approve/reject actions.
- Modify `public/css/styles.css`
  - Add sidebar badge and right-side drawer styles.
- Create `tests/notifications.spec.js`
  - Add focused Playwright coverage for unread count, read/read-all authorization, drawer behavior, and navigation.

---

### Task 1: Add Failing Notification API Tests

**Files:**
- Create: `tests/notifications.spec.js`

- [ ] **Step 1: Create the notification Playwright test file**

Create `tests/notifications.spec.js` with this content:

```js
const { test, expect } = require('@playwright/test');
const { pool } = require('../db');

async function login(page, username = 'admin', password = 'admin123') {
  await page.context().clearCookies();
  await page.goto('/');
  await page.locator('#login-user').fill(username);
  await page.locator('#login-pass').fill(password);
  await page.locator('#login-form button[type="submit"]').click();
  await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 10000 });
}

async function fetchJson(page, url, options = {}) {
  return await page.evaluate(async ({ url, options }) => {
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }, { url, options });
}

async function currentUserId(page) {
  return await page.evaluate(() => window.App.currentUser.id);
}

async function clearNotifications(userId) {
  await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
}

async function insertNotification(userId, overrides = {}) {
  const data = {
    type: overrides.type || 'approval_needed',
    title: overrides.title || 'Cần duyệt đề cương IT001',
    body: overrides.body || 'Đề cương IT001 đang chờ bạn phê duyệt.',
    entity_type: overrides.entity_type || 'syllabus',
    entity_id: overrides.entity_id || 999001,
    link_page: overrides.link_page || 'approval',
    link_params: overrides.link_params || {},
    dedupe_key: overrides.dedupe_key || `test:${userId}:${Date.now()}:${Math.random()}`
  };

  const result = await pool.query(`
    INSERT INTO notifications
      (user_id, type, title, body, entity_type, entity_id, link_page, link_params, dedupe_key)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `, [
    userId,
    data.type,
    data.title,
    data.body,
    data.entity_type,
    data.entity_id,
    data.link_page,
    JSON.stringify(data.link_params),
    data.dedupe_key
  ]);
  return result.rows[0];
}

test.describe.serial('Notifications', () => {
  test.afterAll(async () => {
    await pool.end();
  });

  test('TC_NOTIF_01: unread count counts only current user', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    await insertNotification(userId, { dedupe_key: `count:${userId}:one` });

    const response = await fetchJson(page, '/api/notifications/unread-count');

    expect(response.status).toBe(200);
    expect(response.body.unread).toBe(1);
  });

  test('TC_NOTIF_02: list endpoint returns newest notifications for current user', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    await insertNotification(userId, {
      title: 'Bạn được phân công soạn đề cương',
      type: 'assignment',
      link_page: 'my-assignments',
      dedupe_key: `list:${userId}:assignment`
    });

    const response = await fetchJson(page, '/api/notifications?filter=all');

    expect(response.status).toBe(200);
    expect(response.body.notifications.length).toBeGreaterThanOrEqual(1);
    expect(response.body.notifications[0].title).toContain('phân công');
  });

  test('TC_NOTIF_03: mark one notification as read', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    const notification = await insertNotification(userId, { dedupe_key: `read-one:${userId}` });

    const markRead = await fetchJson(page, `/api/notifications/${notification.id}/read`, { method: 'POST' });
    const count = await fetchJson(page, '/api/notifications/unread-count');

    expect(markRead.status).toBe(200);
    expect(markRead.body.success).toBe(true);
    expect(count.body.unread).toBe(0);
  });

  test('TC_NOTIF_07: cannot mark another user notification as read', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    const other = await pool.query('SELECT id FROM users WHERE id <> $1 ORDER BY id LIMIT 1', [userId]);
    expect(other.rows.length).toBe(1);
    await clearNotifications(other.rows[0].id);
    const notification = await insertNotification(other.rows[0].id, { dedupe_key: `other-user:${other.rows[0].id}` });

    const response = await fetchJson(page, `/api/notifications/${notification.id}/read`, { method: 'POST' });
    const stillUnread = await pool.query('SELECT is_read FROM notifications WHERE id=$1', [notification.id]);

    expect(response.status).toBe(404);
    expect(stillUnread.rows[0].is_read).toBe(false);
  });

  test('TC_NOTIF_10: read-all does not mutate another user notifications', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    const other = await pool.query('SELECT id FROM users WHERE id <> $1 ORDER BY id LIMIT 1', [userId]);
    expect(other.rows.length).toBe(1);
    await clearNotifications(userId);
    await clearNotifications(other.rows[0].id);
    await insertNotification(userId, { dedupe_key: `read-all-current:${userId}` });
    const otherNotification = await insertNotification(other.rows[0].id, { dedupe_key: `read-all-other:${other.rows[0].id}` });

    const response = await fetchJson(page, '/api/notifications/read-all', { method: 'POST' });
    const otherState = await pool.query('SELECT is_read FROM notifications WHERE id=$1', [otherNotification.id]);

    expect(response.status).toBe(200);
    expect(otherState.rows[0].is_read).toBe(false);
  });

  test('TC_NOTIF_04: read-all clears sidebar badge', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    await insertNotification(userId, { dedupe_key: `read-all:${userId}:one` });
    await insertNotification(userId, { dedupe_key: `read-all:${userId}:two` });

    await page.evaluate(() => window.App.refreshNotificationCount());
    await expect(page.locator('#notification-badge')).toContainText('2');

    const response = await fetchJson(page, '/api/notifications/read-all', { method: 'POST' });
    await page.evaluate(() => window.App.refreshNotificationCount());

    expect(response.status).toBe(200);
    await expect(page.locator('#notification-badge')).toBeHidden();
  });

  test('TC_NOTIF_05: sidebar bell opens drawer and clicking item navigates', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    await insertNotification(userId, {
      title: 'Cần duyệt hồ sơ',
      body: 'Có hồ sơ đang chờ xử lý.',
      link_page: 'approval',
      link_params: {},
      dedupe_key: `drawer:${userId}:approval`
    });

    await page.evaluate(() => window.App.refreshNotificationCount());
    await page.locator('#notification-nav').click();

    await expect(page.locator('#notification-drawer')).toHaveClass(/active/);
    await expect(page.locator('#notification-drawer')).toContainText('Cần duyệt hồ sơ');

    await page.locator('.notification-item').first().click();

    await expect(page.locator('#notification-drawer')).not.toHaveClass(/active/);
    await expect(page.locator('#page-content')).toContainText('Phê duyệt', { timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail before implementation**

Run:

```bash
npx playwright test tests/notifications.spec.js
```

Expected: the suite fails because `notifications` does not exist yet or `/api/notifications/unread-count` returns 404.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/notifications.spec.js
git commit -m "test: add notification center coverage"
```

---

### Task 2: Add Notification Schema And Read APIs

**Files:**
- Modify: `db.js` in `initDB()` after the `approval_logs` table definition
- Modify: `server.js` before the dashboard stats routes
- Test: `tests/notifications.spec.js`

- [ ] **Step 1: Add the notifications table in `db.js`**

In `db.js`, inside `initDB()` after the `approval_logs` table definition and before `knowledge_blocks`, add:

```sql
      -- Notifications (approval and syllabus assignment inbox)
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        body TEXT,
        entity_type VARCHAR(50),
        entity_id INT,
        link_page VARCHAR(80),
        link_params JSONB DEFAULT '{}',
        dedupe_key VARCHAR(200),
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe ON notifications(user_id, dedupe_key);
```

- [ ] **Step 2: Add notification API routes in `server.js`**

In `server.js`, before `// ============ DASHBOARD STATS ============`, add:

```js
// ============ NOTIFICATIONS API ============
app.get('/api/notifications/unread-count', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id=$1 AND is_read=false',
      [req.user.id]
    );
    res.json({ unread: result.rows[0].unread });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const conditions = ['user_id = $1'];
    const params = [req.user.id];

    if (filter === 'unread') {
      conditions.push('is_read = false');
    } else if (filter === 'actionable') {
      conditions.push("type IN ('assignment','approval_needed')");
    } else if (filter !== 'all') {
      return res.status(400).json({ error: 'Bộ lọc thông báo không hợp lệ' });
    }

    const result = await pool.query(`
      SELECT id, type, title, body, entity_type, entity_id, link_page, link_params,
             is_read, read_at, created_at
      FROM notifications
      WHERE ${conditions.join(' AND ')}
      ORDER BY is_read ASC, created_at DESC
      LIMIT 50
    `, params);

    res.json({ notifications: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE notifications
      SET is_read=true, read_at=COALESCE(read_at, NOW())
      WHERE id=$1 AND user_id=$2
      RETURNING id
    `, [req.params.id, req.user.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Thông báo không tồn tại' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query(`
      UPDATE notifications
      SET is_read=true, read_at=COALESCE(read_at, NOW())
      WHERE user_id=$1 AND is_read=false
    `, [req.user.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Run the notification tests**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_01|TC_NOTIF_02|TC_NOTIF_03|TC_NOTIF_07|TC_NOTIF_10"
```

Expected: `TC_NOTIF_01`, `TC_NOTIF_02`, `TC_NOTIF_03`, `TC_NOTIF_07`, and `TC_NOTIF_10` pass. UI tests can still fail because the sidebar drawer has not been implemented.

- [ ] **Step 4: Commit schema and read API work**

```bash
git add db.js server.js
git commit -m "feat: add notification storage and read APIs"
```

---

### Task 3: Add Notification Creation Helpers

**Files:**
- Modify: `server.js` before `// ============ SYLLABUS ASSIGNMENTS ============`
- Test: `tests/notifications.spec.js`

- [ ] **Step 1: Add a helper for creating notifications**

In `server.js`, before `// ============ SYLLABUS ASSIGNMENTS ============`, add:

```js
async function createNotification({
  userId,
  type,
  title,
  body = null,
  entityType = null,
  entityId = null,
  linkPage = null,
  linkParams = {},
  dedupeKey
}) {
  if (!userId || !type || !title || !dedupeKey) return null;
  const result = await pool.query(`
    INSERT INTO notifications
      (user_id, type, title, body, entity_type, entity_id, link_page, link_params, dedupe_key)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      entity_type = EXCLUDED.entity_type,
      entity_id = EXCLUDED.entity_id,
      link_page = EXCLUDED.link_page,
      link_params = EXCLUDED.link_params
    RETURNING *
  `, [
    userId,
    type,
    title,
    body,
    entityType,
    entityId,
    linkPage,
    JSON.stringify(linkParams || {}),
    dedupeKey
  ]);
  return result.rows[0];
}
```

- [ ] **Step 2: Add a helper for permission-based notification recipients**

Immediately after `createNotification`, add:

```js
async function getUsersWithPermissionForNotification(permCode, deptId) {
  const result = await pool.query(`
    SELECT DISTINCT u.id
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE u.is_active = true
      AND (p.code = $1 OR r.code = 'ADMIN')
      AND (
        r.level >= 4
        OR ur.department_id = $2
        OR ur.department_id = (SELECT parent_id FROM departments WHERE id = $2)
      )
    ORDER BY u.id
  `, [permCode, parseInt(deptId)]);
  return result.rows.map(r => r.id);
}
```

- [ ] **Step 3: Add entity context helpers**

Immediately after `getUsersWithPermissionForNotification`, add:

```js
async function getProgramVersionNotificationContext(versionId) {
  const result = await pool.query(`
    SELECT pv.id, pv.academic_year, pv.status, pv.version_name,
           p.name as program_name, p.department_id
    FROM program_versions pv
    JOIN programs p ON pv.program_id = p.id
    WHERE pv.id = $1
  `, [versionId]);
  return result.rows[0] || null;
}

async function getSyllabusNotificationContext(syllabusId) {
  const result = await pool.query(`
    SELECT vs.id, vs.status, vs.author_id, vs.version_id, vs.course_id,
           c.code as course_code, c.name as course_name,
           p.name as program_name, p.department_id, pv.academic_year
    FROM version_syllabi vs
    JOIN courses c ON vs.course_id = c.id
    JOIN program_versions pv ON vs.version_id = pv.id
    JOIN programs p ON pv.program_id = p.id
    WHERE vs.id = $1
  `, [syllabusId]);
  return result.rows[0] || null;
}

async function getLatestSubmitterId(entityType, entityId) {
  const result = await pool.query(`
    SELECT reviewer_id
    FROM approval_logs
    WHERE entity_type=$1 AND entity_id=$2 AND action='submitted'
    ORDER BY created_at DESC
    LIMIT 1
  `, [entityType, entityId]);
  return result.rows[0]?.reviewer_id || null;
}
```

- [ ] **Step 4: Add `notifyApprovalNeeded`**

Immediately after the context helpers, add:

```js
async function notifyApprovalNeeded(entityType, entityId, status, eventId = 'backfill') {
  const programPermMap = {
    submitted: 'programs.approve_khoa',
    approved_khoa: 'programs.approve_pdt',
    approved_pdt: 'programs.approve_bgh'
  };
  const syllabusPermMap = {
    submitted: 'syllabus.approve_tbm',
    approved_tbm: 'syllabus.approve_khoa',
    approved_khoa: 'syllabus.approve_pdt',
    approved_pdt: 'syllabus.approve_bgh'
  };

  if (entityType === 'program_version') {
    const ctx = await getProgramVersionNotificationContext(entityId);
    if (!ctx) return;
    const perm = programPermMap[status];
    if (!perm) return;
    const userIds = await getUsersWithPermissionForNotification(perm, ctx.department_id);
    await Promise.all(userIds.map(userId => createNotification({
      userId,
      type: 'approval_needed',
      title: 'Có CTĐT cần phê duyệt',
      body: `${ctx.program_name} (${ctx.academic_year}) đang chờ bạn xử lý.`,
      entityType,
      entityId,
      linkPage: 'version-editor',
      linkParams: { versionId: entityId },
      dedupeKey: `approval:${entityType}:${entityId}:${status}:pending:${eventId}`
    })));
    return;
  }

  if (entityType === 'syllabus') {
    const ctx = await getSyllabusNotificationContext(entityId);
    if (!ctx) return;
    const perm = syllabusPermMap[status];
    if (!perm) return;
    const userIds = await getUsersWithPermissionForNotification(perm, ctx.department_id);
    await Promise.all(userIds.map(userId => createNotification({
      userId,
      type: 'approval_needed',
      title: 'Có đề cương cần phê duyệt',
      body: `${ctx.course_code} - ${ctx.course_name} đang chờ bạn xử lý.`,
      entityType,
      entityId,
      linkPage: 'syllabus-editor',
      linkParams: { syllabusId: entityId },
      dedupeKey: `approval:${entityType}:${entityId}:${status}:pending:${eventId}`
    })));
  }
}
```

- [ ] **Step 5: Add result and assignment notification helpers**

Immediately after `notifyApprovalNeeded`, add:

```js
async function notifyApprovalResult(entityType, entityId, newStatus, action, notes, eventId) {
  const statusLabel = {
    approved_khoa: 'đã được duyệt cấp Khoa',
    approved_pdt: 'đã được duyệt cấp Phòng Đào tạo',
    approved_tbm: 'đã được duyệt cấp Trưởng bộ môn',
    published: 'đã được công bố',
    draft: 'bị từ chối'
  }[newStatus] || `chuyển sang trạng thái ${newStatus}`;

  if (entityType === 'program_version') {
    const ctx = await getProgramVersionNotificationContext(entityId);
    if (!ctx) return;
    const submitterId = await getLatestSubmitterId(entityType, entityId);
    if (!submitterId) return;
    await createNotification({
      userId: submitterId,
      type: action === 'reject' ? 'rejection_result' : 'approval_result',
      title: action === 'reject' ? 'CTĐT bị từ chối' : 'CTĐT đã được phê duyệt',
      body: action === 'reject'
        ? `${ctx.program_name} (${ctx.academic_year}) bị từ chối: ${notes || 'Yêu cầu chỉnh sửa'}`
        : `${ctx.program_name} (${ctx.academic_year}) ${statusLabel}.`,
      entityType,
      entityId,
      linkPage: 'version-editor',
      linkParams: { versionId: entityId },
      dedupeKey: `result:${entityType}:${entityId}:${action}:${newStatus}:${eventId}`
    });
    return;
  }

  if (entityType === 'syllabus') {
    const ctx = await getSyllabusNotificationContext(entityId);
    if (!ctx) return;
    const submitterId = ctx.author_id || await getLatestSubmitterId(entityType, entityId);
    if (!submitterId) return;
    await createNotification({
      userId: submitterId,
      type: action === 'reject' ? 'rejection_result' : 'approval_result',
      title: action === 'reject' ? 'Đề cương bị từ chối' : 'Đề cương đã được phê duyệt',
      body: action === 'reject'
        ? `${ctx.course_code} - ${ctx.course_name} bị từ chối: ${notes || 'Yêu cầu chỉnh sửa'}`
        : `${ctx.course_code} - ${ctx.course_name} ${statusLabel}.`,
      entityType,
      entityId,
      linkPage: 'syllabus-editor',
      linkParams: { syllabusId: entityId },
      dedupeKey: `result:${entityType}:${entityId}:${action}:${newStatus}:${eventId}`
    });
  }
}

async function notifySyllabusAssignment(assignmentId) {
  const result = await pool.query(`
    SELECT sa.id, sa.assigned_to, sa.updated_at,
           c.code as course_code, c.name as course_name,
           p.name as program_name, pv.academic_year
    FROM syllabus_assignments sa
    JOIN courses c ON sa.course_id = c.id
    JOIN program_versions pv ON sa.version_id = pv.id
    JOIN programs p ON pv.program_id = p.id
    WHERE sa.id = $1
  `, [assignmentId]);
  const a = result.rows[0];
  if (!a) return;
  await createNotification({
    userId: a.assigned_to,
    type: 'assignment',
    title: 'Bạn được phân công soạn đề cương',
    body: `${a.course_code} - ${a.course_name} trong CTĐT ${a.program_name} (${a.academic_year}).`,
    entityType: 'syllabus_assignment',
    entityId: a.id,
    linkPage: 'my-assignments',
    linkParams: { assignmentId: a.id },
    dedupeKey: `assignment:${a.id}:assigned:${a.assigned_to}:${new Date(a.updated_at).getTime()}`
  });
}
```

- [ ] **Step 6: Run syntax check**

Run:

```bash
node --check server.js
```

Expected: no syntax errors.

- [ ] **Step 7: Commit helper functions**

```bash
git add server.js
git commit -m "feat: add notification helper functions"
```

---

### Task 4: Wire Notifications Into Assignment And Approval Events

**Files:**
- Modify: `server.js`
- Test: `tests/notifications.spec.js`

- [ ] **Step 1: Notify lecturers when an assignment is created or reassigned**

In `POST /api/versions/:vId/assignments`, update the existing assignment query to include `assigned_to`:

```js
    const existingRes = await pool.query(
      'SELECT id, assigner_role_level, assigned_to FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2',
      [vId, course_id]
    );
```

Before the upsert, store the previous assignee:

```js
    const previousAssignedTo = existingRes.rows[0]?.assigned_to || null;
```

After the `UPDATE version_syllabi SET author_id...` query and before `res.json(result.rows[0]);`, add:

```js
    if (previousAssignedTo !== assigned_to) {
      await notifySyllabusAssignment(result.rows[0].id);
    }
```

- [ ] **Step 2: Return approval log ids from submission**

In `POST /api/approval/submit`, replace the approval log insert with:

```js
    const logResult = await pool.query(
      'INSERT INTO approval_logs (entity_type, entity_id, step, action, reviewer_id, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [entity_type, entity_id, 'submit', 'submitted', req.user.id, 'Nộp duyệt']
    );
    await notifyApprovalNeeded(entity_type, entity_id, 'submitted', logResult.rows[0].id);
```

- [ ] **Step 3: Notify submitter and next approvers on rejection**

In `POST /api/approval/review`, inside the `if (action === 'reject')` block, replace the approval log insert with:

```js
      const logResult = await pool.query(
        'INSERT INTO approval_logs (entity_type, entity_id, step, action, reviewer_id, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [entity_type, entity_id, status, 'rejected', req.user.id, notes || 'Yêu cầu chỉnh sửa']
      );
      await notifyApprovalResult(entity_type, entity_id, nextState, 'reject', notes || 'Yêu cầu chỉnh sửa', logResult.rows[0].id);
```

- [ ] **Step 4: Notify submitter and next approvers on approval**

In `POST /api/approval/review`, replace the final approval log insert with:

```js
    const logResult = await pool.query(
      'INSERT INTO approval_logs (entity_type, entity_id, step, action, reviewer_id, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [entity_type, entity_id, status, 'approved', req.user.id, notes || 'Đã duyệt']
    );
    await notifyApprovalResult(entity_type, entity_id, nextStatus, 'approve', notes || 'Đã duyệt', logResult.rows[0].id);
    if (nextStatus !== 'published') {
      await notifyApprovalNeeded(entity_type, entity_id, nextStatus, logResult.rows[0].id);
    }
```

- [ ] **Step 5: Add a focused backend event test**

Append these tests inside `tests/notifications.spec.js` before `TC_NOTIF_04`:

```js
  test('TC_NOTIF_06: assignment endpoint creates lecturer notification', async ({ page }) => {
    await login(page);
    const created = await page.evaluate(async () => {
      const depts = await (await fetch('/api/departments')).json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const program = await (await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `NOTIF_${Date.now()}`,
          name: 'Notification Test Program',
          name_en: 'Notification Test Program',
          department_id: dept.id,
          degree: 'Đại học'
        })
      })).json();
      const version = await (await fetch(`/api/programs/${program.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: '2098-2099', version_name: 'Notification Test Version' })
      })).json();
      return { program, version };
    });

    const gv = await pool.query("SELECT id FROM users WHERE username='giangvien'");
    expect(gv.rows.length).toBe(1);
    await clearNotifications(gv.rows[0].id);
    const course = await pool.query('SELECT id FROM courses ORDER BY id LIMIT 1');
    await pool.query('INSERT INTO version_courses (version_id, course_id, semester) VALUES ($1,$2,1)', [created.version.id, course.rows[0].id]);

    const assign = await fetchJson(page, `/api/versions/${created.version.id}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: course.rows[0].id, assigned_to: gv.rows[0].id })
    });

    expect(assign.status).toBe(200);
    const notifications = await pool.query(
      "SELECT title FROM notifications WHERE user_id=$1 AND type='assignment'",
      [gv.rows[0].id]
    );
    expect(notifications.rows.length).toBe(1);
    expect(notifications.rows[0].title).toContain('phân công');

    await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
  });

  test('TC_NOTIF_08: submitting a CTĐT creates pending approval notification', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    const created = await page.evaluate(async () => {
      const depts = await (await fetch('/api/departments')).json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const program = await (await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `SUBMIT_${Date.now()}`,
          name: 'Submit Notification Program',
          name_en: 'Submit Notification Program',
          department_id: dept.id,
          degree: 'Đại học'
        })
      })).json();
      const version = await (await fetch(`/api/programs/${program.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: '2097-2098', version_name: 'Submit Notification Version' })
      })).json();
      return { program, version };
    });

    const submit = await fetchJson(page, '/api/approval/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id })
    });

    expect(submit.status).toBe(200);
    const notifications = await pool.query(
      "SELECT title FROM notifications WHERE user_id=$1 AND type='approval_needed'",
      [userId]
    );
    expect(notifications.rows.length).toBeGreaterThanOrEqual(1);
    expect(notifications.rows[0].title).toContain('CTĐT');

    await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
  });

  test('TC_NOTIF_09: approving a CTĐT creates submitter result notification', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    const created = await page.evaluate(async () => {
      const depts = await (await fetch('/api/departments')).json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const program = await (await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `APPROVE_${Date.now()}`,
          name: 'Approve Notification Program',
          name_en: 'Approve Notification Program',
          department_id: dept.id,
          degree: 'Đại học'
        })
      })).json();
      const version = await (await fetch(`/api/programs/${program.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: '2096-2097', version_name: 'Approve Notification Version' })
      })).json();
      return { program, version };
    });

    await fetchJson(page, '/api/approval/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id })
    });
    const approve = await fetchJson(page, '/api/approval/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id, action: 'approve' })
    });

    expect(approve.status).toBe(200);
    const notifications = await pool.query(
      "SELECT title FROM notifications WHERE user_id=$1 AND type='approval_result'",
      [userId]
    );
    expect(notifications.rows.length).toBeGreaterThanOrEqual(1);
    expect(notifications.rows[0].title).toContain('CTĐT');

    await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
  });
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_01|TC_NOTIF_02|TC_NOTIF_03|TC_NOTIF_06|TC_NOTIF_08|TC_NOTIF_09"
```

Expected: selected tests pass.

- [ ] **Step 7: Commit event hooks**

```bash
git add server.js tests/notifications.spec.js
git commit -m "feat: create notifications from workflow events"
```

---

### Task 5: Add Idempotent Backfill

**Files:**
- Modify: `db.js`

- [ ] **Step 1: Add `createSeedNotification` inside `seedData(client)`**

In `db.js`, inside `seedData(client)` after the admin user seed block and before the closing `}`, add:

```js
  async function createSeedNotification({ userId, type, title, body, entityType, entityId, linkPage, linkParams, dedupeKey }) {
    await client.query(`
      INSERT INTO notifications
        (user_id, type, title, body, entity_type, entity_id, link_page, link_params, dedupe_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (user_id, dedupe_key) DO NOTHING
    `, [userId, type, title, body, entityType, entityId, linkPage, JSON.stringify(linkParams || {}), dedupeKey]);
  }
```

- [ ] **Step 2: Add backfill for open syllabus assignments**

Immediately after `createSeedNotification`, add:

```js
  const openAssignments = await client.query(`
    SELECT sa.id, sa.assigned_to,
           c.code as course_code, c.name as course_name,
           p.name as program_name, pv.academic_year
    FROM syllabus_assignments sa
    JOIN courses c ON sa.course_id = c.id
    JOIN program_versions pv ON sa.version_id = pv.id
    JOIN programs p ON pv.program_id = p.id
    LEFT JOIN version_syllabi vs ON vs.version_id = sa.version_id AND vs.course_id = sa.course_id
    WHERE pv.is_locked = false
      AND COALESCE(vs.status, 'draft') != 'published'
  `);

  for (const a of openAssignments.rows) {
    await createSeedNotification({
      userId: a.assigned_to,
      type: 'assignment',
      title: 'Bạn được phân công soạn đề cương',
      body: `${a.course_code} - ${a.course_name} trong CTĐT ${a.program_name} (${a.academic_year}).`,
      entityType: 'syllabus_assignment',
      entityId: a.id,
      linkPage: 'my-assignments',
      linkParams: { assignmentId: a.id },
      dedupeKey: `backfill:assignment:${a.id}`
    });
  }
```

- [ ] **Step 3: Add backfill recipient query helper**

Immediately after the assignment backfill, add:

```js
  async function getSeedApprovalRecipients(permCode, deptId) {
    const result = await client.query(`
      SELECT DISTINCT u.id
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE u.is_active = true
        AND (p.code = $1 OR r.code = 'ADMIN')
        AND (
          r.level >= 4
          OR ur.department_id = $2
          OR ur.department_id = (SELECT parent_id FROM departments WHERE id = $2)
        )
      ORDER BY u.id
    `, [permCode, parseInt(deptId)]);
    return result.rows.map(r => r.id);
  }
```

- [ ] **Step 4: Add backfill for pending CTĐT approvals**

Immediately after `getSeedApprovalRecipients`, add:

```js
  const programApprovalPerms = {
    submitted: 'programs.approve_khoa',
    approved_khoa: 'programs.approve_pdt',
    approved_pdt: 'programs.approve_bgh'
  };
  const pendingPrograms = await client.query(`
    SELECT pv.id, pv.status, pv.academic_year,
           p.name as program_name, p.department_id
    FROM program_versions pv
    JOIN programs p ON pv.program_id = p.id
    WHERE pv.status IN ('submitted','approved_khoa','approved_pdt')
  `);

  for (const p of pendingPrograms.rows) {
    const recipients = await getSeedApprovalRecipients(programApprovalPerms[p.status], p.department_id);
    for (const userId of recipients) {
      await createSeedNotification({
        userId,
        type: 'approval_needed',
        title: 'Có CTĐT cần phê duyệt',
        body: `${p.program_name} (${p.academic_year}) đang chờ bạn xử lý.`,
        entityType: 'program_version',
        entityId: p.id,
        linkPage: 'version-editor',
        linkParams: { versionId: p.id },
        dedupeKey: `backfill:approval:program_version:${p.id}:${p.status}`
      });
    }
  }
```

- [ ] **Step 5: Add backfill for pending syllabus approvals**

Immediately after pending CTĐT backfill, add:

```js
  const syllabusApprovalPerms = {
    submitted: 'syllabus.approve_tbm',
    approved_tbm: 'syllabus.approve_khoa',
    approved_khoa: 'syllabus.approve_pdt',
    approved_pdt: 'syllabus.approve_bgh'
  };
  const pendingSyllabi = await client.query(`
    SELECT vs.id, vs.status,
           c.code as course_code, c.name as course_name,
           p.department_id
    FROM version_syllabi vs
    JOIN courses c ON vs.course_id = c.id
    JOIN program_versions pv ON vs.version_id = pv.id
    JOIN programs p ON pv.program_id = p.id
    WHERE vs.status IN ('submitted','approved_tbm','approved_khoa','approved_pdt')
  `);

  for (const s of pendingSyllabi.rows) {
    const recipients = await getSeedApprovalRecipients(syllabusApprovalPerms[s.status], s.department_id);
    for (const userId of recipients) {
      await createSeedNotification({
        userId,
        type: 'approval_needed',
        title: 'Có đề cương cần phê duyệt',
        body: `${s.course_code} - ${s.course_name} đang chờ bạn xử lý.`,
        entityType: 'syllabus',
        entityId: s.id,
        linkPage: 'syllabus-editor',
        linkParams: { syllabusId: s.id },
        dedupeKey: `backfill:approval:syllabus:${s.id}:${s.status}`
      });
    }
  }
```

- [ ] **Step 6: Run DB init twice to verify idempotency**

Run:

```bash
DB_HOST=localhost DB_PORT=5434 DB_NAME=program_db DB_USER=program DB_PASS=program123 node <<'NODE'
const { initDB, pool } = require('./db');
(async () => {
  await initDB();
  await initDB();
  const duplicates = await pool.query(`
    SELECT user_id, dedupe_key, COUNT(*)
    FROM notifications
    WHERE dedupe_key IS NOT NULL
    GROUP BY user_id, dedupe_key
    HAVING COUNT(*) > 1
  `);
  console.log({ duplicateCount: duplicates.rows.length });
  await pool.end();
})().catch(err => { console.error(err); process.exit(1); });
NODE
```

Expected: `duplicateCount: 0`.

- [ ] **Step 7: Commit backfill**

```bash
git add db.js
git commit -m "feat: backfill actionable notifications"
```

---

### Task 6: Add Sidebar Badge And Notification Drawer UI

**Files:**
- Modify: `public/js/app.js`
- Modify: `public/css/styles.css`
- Test: `tests/notifications.spec.js`

- [ ] **Step 1: Add notification state properties**

In `public/js/app.js`, in the `App` object after `currentPage: null,`, add:

```js
    notificationUnread: 0,
    notificationFilter: 'all',
    notificationPollTimer: null,
```

- [ ] **Step 2: Add the sidebar bell markup**

In `renderApp()`, immediately after the Tổng quan nav item, add:

```html
              <div class="nav-item" id="notification-nav" data-notification-trigger>
                <span class="icon">🔔</span>
                <span style="flex:1;">Thông báo</span>
                <span class="notification-badge" id="notification-badge" style="display:none;"></span>
              </div>
```

- [ ] **Step 3: Add the drawer markup**

In `renderApp()`, after the change password modal markup and before the closing wrapper template, add:

```html
        <div class="notification-drawer-backdrop" id="notification-drawer-backdrop" onclick="window.App.closeNotificationsDrawer()"></div>
        <aside class="notification-drawer" id="notification-drawer" aria-label="Thông báo">
          <div class="notification-drawer-header">
            <div>
              <h2>Thông báo</h2>
              <p id="notification-drawer-subtitle">Các việc cần bạn xử lý và kết quả phê duyệt.</p>
            </div>
            <button type="button" class="notification-close" onclick="window.App.closeNotificationsDrawer()">×</button>
          </div>
          <div class="notification-drawer-actions">
            <button type="button" class="notification-filter active" data-filter="all">Tất cả</button>
            <button type="button" class="notification-filter" data-filter="unread">Chưa đọc</button>
            <button type="button" class="notification-filter" data-filter="actionable">Cần xử lý</button>
          </div>
          <div class="notification-drawer-toolbar">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.App.markAllNotificationsRead()">Đánh dấu tất cả đã đọc</button>
          </div>
          <div class="notification-list" id="notification-list">
            <div class="spinner"></div>
          </div>
        </aside>
```

- [ ] **Step 4: Wire sidebar and filter event listeners**

In `renderApp()`, after the existing nav item listener setup, add:

```js
      document.getElementById('notification-nav')?.addEventListener('click', () => this.openNotificationsDrawer());
      document.querySelectorAll('.notification-filter').forEach(btn => {
        btn.addEventListener('click', () => this.setNotificationFilter(btn.dataset.filter));
      });
      this.refreshNotificationCount();
      this.startNotificationPolling();
```

- [ ] **Step 5: Add notification methods in `App`**

In `public/js/app.js`, before `async logout()`, add:

```js
    async refreshNotificationCount() {
      if (!this.currentUser) return;
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (!res.ok) throw new Error('Không thể tải số thông báo');
        const data = await res.json();
        this.notificationUnread = data.unread || 0;
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        if (this.notificationUnread > 0) {
          badge.textContent = this.notificationUnread > 99 ? '99+' : String(this.notificationUnread);
          badge.style.display = '';
        } else {
          badge.textContent = '';
          badge.style.display = 'none';
        }
      } catch (e) {}
    },

    startNotificationPolling() {
      this.stopNotificationPolling();
      this.notificationPollTimer = setInterval(() => this.refreshNotificationCount(), 60000);
    },

    stopNotificationPolling() {
      if (this.notificationPollTimer) {
        clearInterval(this.notificationPollTimer);
        this.notificationPollTimer = null;
      }
    },

    async openNotificationsDrawer() {
      document.getElementById('notification-drawer')?.classList.add('active');
      document.getElementById('notification-drawer-backdrop')?.classList.add('active');
      await this.loadNotifications();
    },

    closeNotificationsDrawer() {
      document.getElementById('notification-drawer')?.classList.remove('active');
      document.getElementById('notification-drawer-backdrop')?.classList.remove('active');
    },

    async setNotificationFilter(filter) {
      this.notificationFilter = filter || 'all';
      document.querySelectorAll('.notification-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === this.notificationFilter);
      });
      await this.loadNotifications();
    },

    async loadNotifications() {
      const list = document.getElementById('notification-list');
      if (!list) return;
      list.innerHTML = '<div class="spinner"></div>';
      try {
        const res = await fetch(`/api/notifications?filter=${encodeURIComponent(this.notificationFilter)}`);
        if (!res.ok) throw new Error((await res.json()).error || 'Không thể tải thông báo');
        const data = await res.json();
        const items = data.notifications || [];
        if (!items.length) {
          list.innerHTML = '<div class="notification-empty">Chưa có thông báo nào.</div>';
          return;
        }
        list.innerHTML = items.map(n => this.renderNotificationItem(n)).join('');
      } catch (e) {
        list.innerHTML = `<div class="notification-error">${e.message}</div>`;
      }
    },

    renderNotificationItem(n) {
      const created = n.created_at ? this.formatNotificationTime(n.created_at) : '';
      const readClass = n.is_read ? 'is-read' : 'is-unread';
      const body = n.body ? `<div class="notification-body">${this.escapeHtml(n.body)}</div>` : '';
      return `
        <button type="button" class="notification-item ${readClass}" onclick='window.App.openNotification(${JSON.stringify(n).replace(/'/g, '&apos;')})'>
          <span class="notification-dot"></span>
          <span class="notification-content">
            <span class="notification-title">${this.escapeHtml(n.title || 'Thông báo')}</span>
            ${body}
            <span class="notification-time">${created}</span>
          </span>
        </button>
      `;
    },

    async openNotification(notification) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: 'POST' });
      } catch (e) {}
      await this.refreshNotificationCount();
      this.closeNotificationsDrawer();
      if (notification.link_page) {
        this.navigate(notification.link_page, notification.link_params || {});
      }
    },

    async markAllNotificationsRead() {
      try {
        const res = await fetch('/api/notifications/read-all', { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error || 'Không thể đánh dấu đã đọc');
        await this.refreshNotificationCount();
        await this.loadNotifications();
      } catch (e) {
        window.toast.error(e.message);
      }
    },

    formatNotificationTime(date) {
      const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
      if (s < 60) return 'vừa xong';
      if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
      if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
      return `${Math.floor(s / 86400)} ngày trước`;
    },

    escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch]));
    },
```

- [ ] **Step 6: Stop polling on logout**

In `async logout()`, before `await fetch('/api/auth/logout'...`, add:

```js
      this.stopNotificationPolling();
```

- [ ] **Step 7: Add drawer and badge CSS**

In `public/css/styles.css`, after `.nav-item .icon`, add:

```css
.notification-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}
```

After the modal styles, add:

```css
.notification-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.12);
  opacity: 0;
  pointer-events: none;
  z-index: 180;
  transition: opacity 0.15s ease;
}
.notification-drawer-backdrop.active {
  opacity: 1;
  pointer-events: auto;
}
.notification-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100vw);
  background: var(--bg);
  border-left: 1px solid var(--border);
  z-index: 181;
  transform: translateX(100%);
  transition: transform 0.2s ease;
  display: flex;
  flex-direction: column;
}
.notification-drawer.active {
  transform: translateX(0);
}
.notification-drawer-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid var(--border);
}
.notification-drawer-header h2 {
  font-size: 18px;
  margin: 0 0 4px;
}
.notification-drawer-header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}
.notification-close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}
.notification-drawer-actions,
.notification-drawer-toolbar {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
}
.notification-filter {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: var(--radius);
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
}
.notification-filter.active {
  background: var(--primary-bg);
  color: var(--primary);
  border-color: var(--primary-bg);
}
.notification-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.notification-item {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  gap: 10px;
  text-align: left;
  padding: 12px;
  border-radius: var(--radius);
  cursor: pointer;
  color: var(--text);
  font-family: inherit;
}
.notification-item:hover {
  background: var(--bg-hover);
}
.notification-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary);
  margin-top: 6px;
  flex-shrink: 0;
}
.notification-item.is-read .notification-dot {
  background: transparent;
}
.notification-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
.notification-body {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}
.notification-time {
  display: block;
  color: var(--text-light);
  font-size: 11px;
  margin-top: 6px;
}
.notification-empty,
.notification-error {
  color: var(--text-muted);
  font-size: 13px;
  padding: 24px 12px;
  text-align: center;
}
.notification-error {
  color: var(--danger);
}
```

- [ ] **Step 8: Run notification UI tests**

Run:

```bash
npx playwright test tests/notifications.spec.js -g "TC_NOTIF_04|TC_NOTIF_05"
```

Expected: `TC_NOTIF_04` and `TC_NOTIF_05` pass.

- [ ] **Step 9: Commit UI shell**

```bash
git add public/js/app.js public/css/styles.css
git commit -m "feat: add notification drawer UI"
```

---

### Task 7: Refresh Notification Badge After Workflow Actions

**Files:**
- Modify: `public/js/pages/version-editor.js`
- Modify: `public/js/pages/syllabus-editor.js`
- Modify: `public/js/pages/approval.js`

- [ ] **Step 1: Refresh badge after assignment actions**

In `public/js/pages/version-editor.js`, inside `assignSyllabus(courseId)`, after the existing success toast and before/after `await this.renderSyllabiTab();`, add:

```js
      if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
```

In `confirmReassign()`, after the existing success toast and before/after `await this.renderSyllabiTab();`, add:

```js
      if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
```

- [ ] **Step 2: Refresh badge after CTĐT submit**

In `public/js/pages/version-editor.js`, inside the submit function that calls `fetch('/api/approval/submit', ...)`, after the success toast, add:

```js
      if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
```

- [ ] **Step 3: Refresh badge after syllabus submit**

In `public/js/pages/syllabus-editor.js`, inside the submit function that calls `fetch('/api/approval/submit', ...)`, after the success toast, add:

```js
      if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
```

- [ ] **Step 4: Refresh badge after approval/rejection actions**

In `public/js/pages/approval.js`, inside `approve(id, type)` after `window.toast.success('Đã phê duyệt');`, add:

```js
      if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
```

Inside `confirmReject()` after `window.toast.success('Đã từ chối');`, add:

```js
      if (window.App.refreshNotificationCount) await window.App.refreshNotificationCount();
```

- [ ] **Step 5: Run syntax checks**

Run:

```bash
node --check public/js/pages/version-editor.js
node --check public/js/pages/syllabus-editor.js
node --check public/js/pages/approval.js
```

Expected: no syntax errors.

- [ ] **Step 6: Commit refresh hooks**

```bash
git add public/js/pages/version-editor.js public/js/pages/syllabus-editor.js public/js/pages/approval.js
git commit -m "feat: refresh notifications after workflow actions"
```

---

### Task 8: Final Verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run notification test suite**

Run:

```bash
npx playwright test tests/notifications.spec.js
```

Expected: all notification tests pass.

- [ ] **Step 2: Run existing smoke tests for touched areas**

Run:

```bash
npx playwright test tests/all_features.test.js -g "Dashboard|Approval|Assignments"
```

Expected: selected smoke tests pass. If `Assignments` does not match the existing describe/test names, run:

```bash
npx playwright test tests/all_features.test.js -g "Dashboard|Approval|ASSIGN"
```

Expected: selected smoke tests pass.

- [ ] **Step 3: Run syntax checks**

Run:

```bash
node --check db.js
node --check server.js
node --check public/js/app.js
node --check public/js/pages/version-editor.js
node --check public/js/pages/syllabus-editor.js
node --check public/js/pages/approval.js
```

Expected: all commands exit 0.

- [ ] **Step 4: Inspect git status and diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only intentional notification-center files are modified or committed. Do not revert unrelated pre-existing changes such as `.codex` or the earlier `db.js` seed removal unless the user explicitly asks.

- [ ] **Step 5: Commit final fixes if any**

When verification produces code fixes, commit them:

```bash
git add db.js server.js public/js/app.js public/js/pages/version-editor.js public/js/pages/syllabus-editor.js public/js/pages/approval.js public/css/styles.css tests/notifications.spec.js
git commit -m "fix: stabilize notification center"
```

When no fixes were needed, skip this commit.
