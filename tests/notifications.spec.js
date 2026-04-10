const { test, expect } = require('@playwright/test');
const { pool, initDB } = require('../db');

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

async function createProgramVersion(page, { codePrefix, academicYear, versionName }) {
  return await page.evaluate(async ({ codePrefix, academicYear, versionName }) => {
    const depts = await (await fetch('/api/departments')).json();
    const dept = depts.find(d => d.type === 'KHOA') || depts[0];
    const now = Date.now();
    const program = await (await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `${codePrefix}_${now}`,
        name: `${codePrefix} Program`,
        name_en: `${codePrefix} Program`,
        department_id: dept.id,
        degree: 'Đại học'
      })
    })).json();
    const version = await (await fetch(`/api/programs/${program.id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academic_year: academicYear, version_name: versionName })
    })).json();
    return { program, version };
  }, { codePrefix, academicYear, versionName });
}

async function clearNotifications(userId) {
  await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
}

async function clearNotificationsForEntity(entityType, entityId) {
  await pool.query('DELETE FROM notifications WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);
}

async function clearApprovalLogs(entityType, entityId) {
  await pool.query('DELETE FROM approval_logs WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);
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

  test('TC_NOTIF_03A: malformed notification id returns validation error', async ({ page }) => {
    await login(page);

    const response = await fetchJson(page, '/api/notifications/not-a-number/read', { method: 'POST' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ID thông báo không hợp lệ');
  });

  test('TC_NOTIF_03B: out-of-range notification id returns validation error', async ({ page }) => {
    await login(page);

    const response = await fetchJson(page, '/api/notifications/2147483648/read', { method: 'POST' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ID thông báo không hợp lệ');
  });

  test('TC_NOTIF_03C: non-canonical numeric notification id returns validation error', async ({ page }) => {
    await login(page);

    const response = await fetchJson(page, '/api/notifications/1e3/read', { method: 'POST' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ID thông báo không hợp lệ');
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

  test('TC_NOTIF_06: assignment endpoint creates lecturer notification', async ({ page }) => {
    await login(page);
    let created;
    let assignmentId;
    const gv = await pool.query("SELECT id FROM users WHERE username='giangvien'");
    expect(gv.rows.length).toBe(1);
    await clearNotifications(gv.rows[0].id);

    try {
      created = await page.evaluate(async () => {
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

      const course = await pool.query('SELECT id FROM courses ORDER BY id LIMIT 1');
      await pool.query('INSERT INTO version_courses (version_id, course_id, semester) VALUES ($1,$2,1)', [created.version.id, course.rows[0].id]);

      const assign = await fetchJson(page, `/api/versions/${created.version.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: course.rows[0].id, assigned_to: gv.rows[0].id })
      });

      expect(assign.status).toBe(200);
      assignmentId = assign.body.id;
      const notifications = await pool.query(
        "SELECT title FROM notifications WHERE user_id=$1 AND type='assignment' AND entity_type='syllabus_assignment' AND entity_id=$2",
        [gv.rows[0].id, assignmentId]
      );
      expect(notifications.rows.length).toBe(1);
      expect(notifications.rows[0].title).toContain('phân công');
    } finally {
      if (assignmentId) {
        await clearNotificationsForEntity('syllabus_assignment', assignmentId);
      }
      if (created?.version?.id) {
        await clearNotificationsForEntity('program_version', created.version.id);
        await clearApprovalLogs('program_version', created.version.id);
      }
      if (created?.program?.id) {
        await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
      }
    }
  });

  test('TC_NOTIF_08: submitting a CTĐT creates pending approval notification', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    let created;
    try {
      created = await page.evaluate(async () => {
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
        "SELECT title FROM notifications WHERE user_id=$1 AND type='approval_needed' AND entity_type='program_version' AND entity_id=$2",
        [userId, created.version.id]
      );
      expect(notifications.rows.length).toBeGreaterThanOrEqual(1);
      expect(notifications.rows[0].title).toContain('CTĐT');
    } finally {
      if (created?.version?.id) {
        await clearNotificationsForEntity('program_version', created.version.id);
        await clearApprovalLogs('program_version', created.version.id);
      }
      if (created?.program?.id) {
        await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
      }
    }
  });

  test('TC_NOTIF_09: approving a CTĐT creates submitter result notification', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    let created;
    try {
      created = await page.evaluate(async () => {
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
        "SELECT title FROM notifications WHERE user_id=$1 AND type='approval_result' AND entity_type='program_version' AND entity_id=$2",
        [userId, created.version.id]
      );
      expect(notifications.rows.length).toBeGreaterThanOrEqual(1);
      expect(notifications.rows[0].title).toContain('CTĐT');
    } finally {
      if (created?.version?.id) {
        await clearNotificationsForEntity('program_version', created.version.id);
        await clearApprovalLogs('program_version', created.version.id);
      }
      if (created?.program?.id) {
        await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
      }
    }
  });

  test('TC_NOTIF_11: advancing approval retires prior actionable notification for the same entity', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    let created;
    try {
      created = await createProgramVersion(page, {
        codePrefix: 'ADVANCE_NOTIF',
        academicYear: '2095-2096',
        versionName: 'Advance Notification Version'
      });

      const submit = await fetchJson(page, '/api/approval/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id })
      });
      expect(submit.status).toBe(200);

      const approve = await fetchJson(page, '/api/approval/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id, action: 'approve' })
      });
      expect(approve.status).toBe(200);

      const notificationRows = await pool.query(
        `SELECT dedupe_key, is_read
         FROM notifications
         WHERE user_id = $1
           AND type = 'approval_needed'
           AND entity_type = 'program_version'
           AND entity_id = $2
         ORDER BY created_at ASC, id ASC`,
        [userId, created.version.id]
      );

      expect(notificationRows.rows.length).toBe(2);
      expect(notificationRows.rows.filter(row => !row.is_read)).toHaveLength(1);
      expect(notificationRows.rows.find(row => row.dedupe_key.includes(':submitted:'))?.is_read).toBe(true);
      expect(notificationRows.rows.find(row => row.dedupe_key.includes(':approved_khoa:'))?.is_read).toBe(false);

      const actionable = await fetchJson(page, '/api/notifications?filter=actionable');
      const actionableForEntity = actionable.body.notifications.filter(notification =>
        notification.entity_type === 'program_version' && notification.entity_id === created.version.id
      );

      expect(actionable.status).toBe(200);
      expect(actionableForEntity).toHaveLength(1);
      expect(actionableForEntity[0].is_read).toBe(false);
    } finally {
      if (created?.version?.id) {
        await clearNotificationsForEntity('program_version', created.version.id);
        await clearApprovalLogs('program_version', created.version.id);
      }
      if (created?.program?.id) {
        await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
      }
    }
  });

  test('TC_NOTIF_12: startup backfill recreates the current approval-needed step when only a stale prior step remains', async ({ page }) => {
    await login(page);
    const userId = await currentUserId(page);
    await clearNotifications(userId);
    let created;
    try {
      created = await createProgramVersion(page, {
        codePrefix: 'BACKFILL_NOTIF',
        academicYear: '2094-2095',
        versionName: 'Backfill Notification Version'
      });

      const submit = await fetchJson(page, '/api/approval/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id })
      });
      expect(submit.status).toBe(200);

      const approve = await fetchJson(page, '/api/approval/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id, action: 'approve' })
      });
      expect(approve.status).toBe(200);

      await pool.query(
        `UPDATE notifications
         SET is_read = true, read_at = NOW()
         WHERE user_id = $1
           AND type = 'approval_needed'
           AND entity_type = 'program_version'
           AND entity_id = $2
           AND dedupe_key LIKE $3`,
        [userId, created.version.id, '%:submitted:%']
      );
      await pool.query(
        `DELETE FROM notifications
         WHERE user_id = $1
           AND type = 'approval_needed'
           AND entity_type = 'program_version'
           AND entity_id = $2
           AND (
             dedupe_key LIKE $3
             OR dedupe_key = $4
           )`,
        [
          userId,
          created.version.id,
          '%:approved_khoa:%',
          `backfill:approval:program_version:${created.version.id}:approved_khoa`
        ]
      );

      await initDB();

      const notificationRows = await pool.query(
        `SELECT dedupe_key, is_read
         FROM notifications
         WHERE user_id = $1
           AND type = 'approval_needed'
           AND entity_type = 'program_version'
           AND entity_id = $2
         ORDER BY created_at ASC, id ASC`,
        [userId, created.version.id]
      );

      expect(notificationRows.rows.find(row => row.dedupe_key.includes(':submitted:'))?.is_read).toBe(true);
      expect(notificationRows.rows.some(row => row.dedupe_key === `backfill:approval:program_version:${created.version.id}:approved_khoa`)).toBe(true);
    } finally {
      if (created?.version?.id) {
        await clearNotificationsForEntity('program_version', created.version.id);
        await clearApprovalLogs('program_version', created.version.id);
      }
      if (created?.program?.id) {
        await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
      }
    }
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

  test('TC_NOTIF_13: approval notification opens version editor with inline approve actions', async ({ page }) => {
    const approver = await pool.query("SELECT id FROM users WHERE username='lanhdaokhoa'");
    expect(approver.rows.length).toBe(1);
    await clearNotifications(approver.rows[0].id);
    let created;

    try {
      const dept = await pool.query("SELECT id FROM departments WHERE type='KHOA' ORDER BY id LIMIT 1");
      expect(dept.rows.length).toBe(1);
      const program = await pool.query(
        `INSERT INTO programs (name, name_en, code, department_id, degree)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          'Inline Approval Open Version',
          'Inline Approval Open Version',
          `IAO${Date.now()}`,
          dept.rows[0].id,
          'Đại học'
        ]
      );
      const version = await pool.query(
        `INSERT INTO program_versions (program_id, academic_year, version_name, status, completion_pct, is_rejected, is_locked)
         VALUES ($1, $2, $3, 'draft', 0, false, false)
         RETURNING *`,
        [program.rows[0].id, '2093-2094', 'Inline Approval Open Version']
      );
      created = { program: program.rows[0], version: version.rows[0] };

      await login(page);
      const submit = await fetchJson(page, '/api/approval/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id })
      });
      expect(submit.status).toBe(200);

      await login(page, 'lanhdaokhoa', 'admin123');
      await page.evaluate(() => window.App.refreshNotificationCount());
      await expect(page.locator('#notification-badge')).toContainText('1');

      await page.locator('#notification-nav').click();
      await expect(page.locator('#notification-drawer')).toHaveClass(/active/);
      await expect(page.locator('.notification-item')).toHaveCount(1);

      await page.locator('.notification-item').first().click();

      await expect(page.locator('#notification-drawer')).not.toHaveClass(/active/);
      await expect(page.locator('.page-title')).toContainText('2093-2094');
      await expect(page.locator('.breadcrumb-current')).toContainText('2093-2094');
      await expect(page.locator('#page-content button[onclick*="approveInline"]')).toBeVisible();
      await expect(page.locator('#page-content button[onclick*="showRejectModal"]')).toBeVisible();
    } finally {
      if (created?.version?.id) {
        await clearNotificationsForEntity('program_version', created.version.id);
        await clearApprovalLogs('program_version', created.version.id);
      }
      if (created?.program?.id) {
        await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
      }
    }
  });

  test('TC_NOTIF_14: approving inline from version editor updates status and notification badge', async ({ page }) => {
    const approver = await pool.query("SELECT id FROM users WHERE username='lanhdaokhoa'");
    expect(approver.rows.length).toBe(1);
    await clearNotifications(approver.rows[0].id);
    let created;

    try {
      const dept = await pool.query("SELECT id FROM departments WHERE type='KHOA' ORDER BY id LIMIT 1");
      expect(dept.rows.length).toBe(1);
      const program = await pool.query(
        `INSERT INTO programs (name, name_en, code, department_id, degree)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          'Inline Approval Run Version',
          'Inline Approval Run Version',
          `IAR${Date.now()}`,
          dept.rows[0].id,
          'Đại học'
        ]
      );
      const version = await pool.query(
        `INSERT INTO program_versions (program_id, academic_year, version_name, status, completion_pct, is_rejected, is_locked)
         VALUES ($1, $2, $3, 'draft', 0, false, false)
         RETURNING *`,
        [program.rows[0].id, '2092-2093', 'Inline Approval Run Version']
      );
      created = { program: program.rows[0], version: version.rows[0] };

      await login(page);
      const submit = await fetchJson(page, '/api/approval/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: created.version.id })
      });
      expect(submit.status).toBe(200);

      await login(page, 'lanhdaokhoa', 'admin123');
      await page.evaluate(() => window.App.refreshNotificationCount());
      await page.locator('#notification-nav').click();
      await expect(page.locator('.notification-item')).toHaveCount(1);
      await page.locator('.notification-item').first().click();

      await page.locator('#page-content button[onclick*="approveInline"]').click();
      await page.getByRole('button', { name: 'Phê duyệt' }).click();

      await expect(page.locator('.toast-success')).toContainText('Đã phê duyệt');

      const versionRes = await fetchJson(page, `/api/versions/${created.version.id}`);
      expect(versionRes.status).toBe(200);
      expect(versionRes.body.status).toBe('approved_khoa');

      await page.evaluate(() => window.App.refreshNotificationCount());
      await expect(page.locator('#notification-badge')).toBeHidden();
    } finally {
      if (created?.version?.id) {
        await clearNotificationsForEntity('program_version', created.version.id);
        await clearApprovalLogs('program_version', created.version.id);
      }
      if (created?.program?.id) {
        await pool.query('DELETE FROM programs WHERE id=$1', [created.program.id]);
      }
    }
  });
});
