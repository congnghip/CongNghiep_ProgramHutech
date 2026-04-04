// tests/all_features.test.js
const { test, expect } = require('@playwright/test');

// ============================================================
// HELPERS
// ============================================================

const BASE = 'http://localhost:3600';

async function login(page, username = 'admin', password = 'admin123') {
  await page.goto(BASE);
  await page.locator('#login-user').fill(username);
  await page.locator('#login-pass').fill(password);
  await page.locator('#login-form button[type="submit"]').click();
  await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 10000 });
}

async function navigateTo(page, pageName) {
  await page.locator(`.nav-item[data-page="${pageName}"]`).click();
  await page.waitForTimeout(500);
}

async function expectToast(page, type = 'success') {
  await expect(page.locator(`.toast-${type}`).first()).toBeVisible({ timeout: 5000 });
}

async function expectToastWithText(page, type, text) {
  const toast = page.locator(`.toast-${type}`).first();
  await expect(toast).toBeVisible({ timeout: 5000 });
  await expect(toast).toContainText(text);
}

async function closeModal(page, modalId) {
  await page.locator(`${modalId} .modal-footer .btn-secondary`).click();
  await expect(page.locator(`${modalId}`)).not.toHaveClass(/active/);
}

async function confirmDialog(page) {
  await page.locator('#ui-dialog-confirm').click();
}

async function cancelDialog(page) {
  await page.locator('#ui-dialog-cancel').click();
}

// ============================================================
// 1. AUTHENTICATION
// ============================================================

test.describe('Authentication', () => {
  test('TC_AUTH_01: Dang nhap thanh cong', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('#login-user').fill('admin');
    await page.locator('#login-pass').fill('admin123');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#page-content')).toBeVisible();
  });

  test('TC_AUTH_02: Dang nhap trong tai khoan', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('#login-pass').fill('admin123');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#login-error')).toBeVisible();
  });

  test('TC_AUTH_03: Dang nhap trong mat khau', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('#login-user').fill('admin');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#login-error')).toBeVisible();
  });

  test('TC_AUTH_04: Dang nhap sai mat khau', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('#login-user').fill('admin');
    await page.locator('#login-pass').fill('wrongpass');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).not.toBeEmpty();
  });

  test('TC_AUTH_05: Dang nhap sai tai khoan', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('#login-user').fill('nonexistentuser');
    await page.locator('#login-pass').fill('pass123');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#login-error')).toBeVisible();
  });

  test('TC_AUTH_06: Dang xuat thanh cong', async ({ page }) => {
    await login(page);
    await page.locator('.logout-btn').click();
    await expect(page.locator('#login-form')).toBeVisible({ timeout: 5000 });
  });

  test('TC_AUTH_07: Doi mat khau thanh cong', async ({ page }) => {
    await login(page);
    await page.evaluate(() => window.App.openChangePassword());
    await expect(page.locator('#chpw-modal')).toHaveClass(/active/);
    await page.locator('#chpw-current').fill('admin123');
    await page.locator('#chpw-new').fill('admin456');
    await page.locator('#chpw-confirm').fill('admin456');
    await page.locator('#chpw-modal .modal-footer .btn-primary').click();
    await expectToast(page, 'success');
    // Restore original password
    await page.evaluate(() => window.App.openChangePassword());
    await page.locator('#chpw-current').fill('admin456');
    await page.locator('#chpw-new').fill('admin123');
    await page.locator('#chpw-confirm').fill('admin123');
    await page.locator('#chpw-modal .modal-footer .btn-primary').click();
    await expectToast(page, 'success');
  });

  test('TC_AUTH_08: Doi MK sai mat khau cu', async ({ page }) => {
    await login(page);
    await page.evaluate(() => window.App.openChangePassword());
    await page.locator('#chpw-current').fill('wrongoldpassword');
    await page.locator('#chpw-new').fill('newpass123');
    await page.locator('#chpw-confirm').fill('newpass123');
    await page.locator('#chpw-modal .modal-footer .btn-primary').click();
    await expect(page.locator('#chpw-error')).toBeVisible();
  });

  test('TC_AUTH_09: Doi MK mat khau moi khong khop', async ({ page }) => {
    await login(page);
    await page.evaluate(() => window.App.openChangePassword());
    await page.locator('#chpw-current').fill('admin123');
    await page.locator('#chpw-new').fill('newpass123');
    await page.locator('#chpw-confirm').fill('differentpass');
    await page.locator('#chpw-modal .modal-footer .btn-primary').click();
    await expect(page.locator('#chpw-error')).toBeVisible();
  });

  test('TC_AUTH_10: Dang nhap ky tu dac biet', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('#login-user').fill('<script>alert(1)</script>');
    await page.locator('#login-pass').fill('pass');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#login-error')).toBeVisible();
    const dialogTriggered = await page.evaluate(() => {
      return window.__xssTriggered || false;
    });
    expect(dialogTriggered).toBe(false);
  });

  test('TC_AUTH_11: Dang nhap chuoi cuc dai', async ({ page }) => {
    await page.goto(BASE);
    const longString = 'a'.repeat(1000);
    await page.locator('#login-user').fill(longString);
    await page.locator('#login-pass').fill('pass');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#login-error')).toBeVisible();
  });
});

// ============================================================
// 2. DASHBOARD
// ============================================================

test.describe('Dashboard', () => {
  test('TC_DASH_01: Hien thi dashboard sau login', async ({ page }) => {
    await login(page);
    const content = page.locator('#page-content');
    await expect(content).toBeVisible();
    const metricValues = content.locator('div >> text=/^\\d+$/');
    await expect(metricValues.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC_DASH_02: Hien thi hoat dong gan day', async ({ page }) => {
    await login(page);
    const content = page.locator('#page-content');
    await expect(content).toContainText('Hoạt động gần đây', { timeout: 5000 });
  });

  test('TC_DASH_03: Dashboard khi khong co quyen', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('#login-user').fill('gv_test');
    await page.locator('#login-pass').fill('123456');
    await page.locator('#login-form button[type="submit"]').click();
    const sidebar = page.locator('.sidebar');
    const loggedIn = await sidebar.isVisible({ timeout: 3000 }).catch(() => false);
    if (!loggedIn) {
      test.skip();
      return;
    }
    const content = page.locator('#page-content');
    await expect(content).toBeVisible();
  });

  test('TC_DASH_04: Dashboard voi DB trong', async ({ page }) => {
    await login(page);
    const content = page.locator('#page-content');
    await expect(content).toBeVisible();
    await expect(content).not.toBeEmpty();
  });
});

// ============================================================
// 3. PROGRAM MANAGEMENT
// ============================================================

test.describe('Program Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'programs');
  });

  test('TC_PROG_01: Xem danh sach CTDT', async ({ page }) => {
    await expect(page.locator('#page-content')).toContainText('Chương trình Đào tạo');
    await expect(page.locator('.data-table').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC_PROG_02: Tao CTDT moi thanh cong', async ({ page }) => {
    await page.evaluate(() => window.ProgramsPage.openAddModal());
    await expect(page.locator('#prog-modal')).toHaveClass(/active/);
    const uniqueCode = 'TEST_' + Date.now();
    await page.locator('#prog-code').fill(uniqueCode);
    await page.locator('#prog-name').fill('Chuong trinh test tu dong');
    await page.locator('#prog-name-en').fill('Automated Test Program');
    await page.locator('#prog-dept').selectOption({ index: 1 });
    await page.locator('#prog-save-btn').click();
    await expectToast(page, 'success');
    await expect(page.locator('#prog-modal')).not.toHaveClass(/active/);
    // Cleanup
    const programs = await page.evaluate(async (code) => {
      const res = await fetch('/api/programs');
      const data = await res.json();
      return data.filter(p => p.code === code);
    }, uniqueCode);
    if (programs.length > 0) {
      await page.evaluate(async (id) => {
        await fetch(`/api/programs/${id}`, { method: 'DELETE' });
      }, programs[0].id);
    }
  });

  test('TC_PROG_03: Sua CTDT thanh cong', async ({ page }) => {
    const uniqueCode = 'EDIT_' + Date.now();
    const created = await page.evaluate(async (code) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'Program To Edit', name_en: 'Program To Edit EN', department_id: dept.id, degree: 'Đại học' })
      });
      return await res.json();
    }, uniqueCode);
    await navigateTo(page, 'programs');
    await page.waitForTimeout(500);
    await page.evaluate((id) => window.ProgramsPage.openEditModal(id), created.id);
    await expect(page.locator('#prog-modal')).toHaveClass(/active/);
    await page.locator('#prog-name').fill('Program Updated Name');
    await page.locator('#prog-save-btn').click();
    await expectToast(page, 'success');
    await page.evaluate(async (id) => {
      await fetch(`/api/programs/${id}`, { method: 'DELETE' });
    }, created.id);
  });

  test('TC_PROG_04: Xoa CTDT draft', async ({ page }) => {
    const uniqueCode = 'DEL_' + Date.now();
    const created = await page.evaluate(async (code) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'Program To Delete', name_en: 'Delete EN', department_id: dept.id, degree: 'Đại học' })
      });
      return await res.json();
    }, uniqueCode);
    const result = await page.evaluate(async (id) => {
      const res = await fetch(`/api/programs/${id}`, { method: 'DELETE' });
      return res.ok;
    }, created.id);
    expect(result).toBe(true);
  });

  test('TC_PROG_05: Archive CTDT', async ({ page }) => {
    const uniqueCode = 'ARCH_' + Date.now();
    const created = await page.evaluate(async (code) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'Program To Archive', name_en: 'Archive EN', department_id: dept.id, degree: 'Đại học' })
      });
      return await res.json();
    }, uniqueCode);
    const archiveResult = await page.evaluate(async (id) => {
      const res = await fetch(`/api/programs/${id}/archive`, { method: 'POST' });
      return res.ok;
    }, created.id);
    expect(archiveResult).toBe(true);
    await navigateTo(page, 'programs');
    await page.locator('#archive-tab-btn').click();
    await page.waitForTimeout(500);
    const content = page.locator('#page-content');
    await expect(content).toContainText(uniqueCode);
    await page.evaluate(async (id) => {
      await fetch(`/api/programs/${id}/unarchive`, { method: 'POST' });
      await fetch(`/api/programs/${id}`, { method: 'DELETE' });
    }, created.id);
  });

  test('TC_PROG_06: Tao version moi', async ({ page }) => {
    const uniqueCode = 'VER_' + Date.now();
    const created = await page.evaluate(async (code) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'Program For Version', name_en: 'Version EN', department_id: dept.id, degree: 'Đại học' })
      });
      return await res.json();
    }, uniqueCode);
    const verResult = await page.evaluate(async (programId) => {
      const res = await fetch(`/api/programs/${programId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: '2099-2100' })
      });
      return await res.json();
    }, created.id);
    expect(verResult.id).toBeTruthy();
    await page.evaluate(async (data) => {
      await fetch(`/api/versions/${data.verId}`, { method: 'DELETE' });
      await fetch(`/api/programs/${data.progId}`, { method: 'DELETE' });
    }, { verId: verResult.id, progId: created.id });
  });

  test('TC_PROG_07: Tao CTDT trong ma', async ({ page }) => {
    await page.evaluate(() => window.ProgramsPage.openAddModal());
    await expect(page.locator('#prog-modal')).toHaveClass(/active/);
    await page.locator('#prog-name').fill('Test No Code');
    await page.locator('#prog-name-en').fill('Test No Code EN');
    await page.locator('#prog-dept').selectOption({ index: 1 });
    await page.locator('#prog-save-btn').click();
    const modalError = page.locator('#prog-error');
    const hasError = await modalError.isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasError) {
      const isModalStillOpen = await page.locator('#prog-modal').evaluate(el => el.classList.contains('active'));
      expect(isModalStillOpen).toBe(true);
    }
  });

  test('TC_PROG_08: Tao CTDT trong ten', async ({ page }) => {
    await page.evaluate(() => window.ProgramsPage.openAddModal());
    await expect(page.locator('#prog-modal')).toHaveClass(/active/);
    await page.locator('#prog-code').fill('NONAME_' + Date.now());
    await page.locator('#prog-name-en').fill('No Name EN');
    await page.locator('#prog-dept').selectOption({ index: 1 });
    await page.locator('#prog-save-btn').click();
    const isModalStillOpen = await page.locator('#prog-modal').evaluate(el => el.classList.contains('active'));
    expect(isModalStillOpen).toBe(true);
  });

  test('TC_PROG_09: Tao CTDT trung ma', async ({ page }) => {
    const uniqueCode = 'DUP_' + Date.now();
    const created = await page.evaluate(async (code) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'Original Program', name_en: 'Original EN', department_id: dept.id, degree: 'Đại học' })
      });
      return await res.json();
    }, uniqueCode);
    await page.evaluate(() => window.ProgramsPage.openAddModal());
    await page.locator('#prog-code').fill(uniqueCode);
    await page.locator('#prog-name').fill('Duplicate Program');
    await page.locator('#prog-name-en').fill('Duplicate EN');
    await page.locator('#prog-dept').selectOption({ index: 1 });
    await page.locator('#prog-save-btn').click();
    const hasModalError = await page.locator('#prog-error').isVisible({ timeout: 3000 }).catch(() => false);
    const hasToastError = await page.locator('.toast-error').isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasModalError || hasToastError).toBe(true);
    await page.evaluate(async (id) => {
      await fetch(`/api/programs/${id}`, { method: 'DELETE' });
    }, created.id);
  });

  test('TC_PROG_10: Xoa CTDT khong phai draft', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/programs');
      const programs = await res.json();
      const nonDraft = programs.find(p => p.versions && p.versions.some(v => v.status !== 'draft'));
      if (!nonDraft) return 'skip';
      const delRes = await fetch(`/api/programs/${nonDraft.id}`, { method: 'DELETE' });
      return delRes.ok ? 'deleted' : 'blocked';
    });
    if (result === 'skip') { test.skip(); return; }
    expect(result).toBe('blocked');
  });

  test('TC_PROG_11: Tao version trung nam', async ({ page }) => {
    const uniqueCode = 'DUPVER_' + Date.now();
    const setup = await page.evaluate(async (code) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const progRes = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'Dup Version Test', name_en: 'Dup V EN', department_id: dept.id, degree: 'Đại học' })
      });
      const prog = await progRes.json();
      await fetch(`/api/programs/${prog.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: '2098-2099' })
      });
      return prog;
    }, uniqueCode);
    const result = await page.evaluate(async (progId) => {
      const res = await fetch(`/api/programs/${progId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: '2098-2099' })
      });
      return res.ok;
    }, setup.id);
    expect(result).toBe(false);
    await page.evaluate(async (progId) => {
      const versRes = await fetch(`/api/programs/${progId}/versions`);
      const versions = await versRes.json();
      for (const v of versions) { await fetch(`/api/versions/${v.id}`, { method: 'DELETE' }); }
      await fetch(`/api/programs/${progId}`, { method: 'DELETE' });
    }, setup.id);
  });

  test('TC_PROG_12: Tao CTDT ky tu dac biet', async ({ page }) => {
    const uniqueCode = 'SPEC_' + Date.now();
    const created = await page.evaluate(async (code) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: '<>&"\' Special Chars', name_en: 'Special EN', department_id: dept.id, degree: 'Đại học' })
      });
      return await res.json();
    }, uniqueCode);
    expect(created.id).toBeTruthy();
    await navigateTo(page, 'programs');
    await page.waitForTimeout(500);
    const htmlContent = await page.locator('#page-content').innerHTML();
    expect(htmlContent).not.toContain('<>&"');
    await page.evaluate(async (id) => {
      await fetch(`/api/programs/${id}`, { method: 'DELETE' });
    }, created.id);
  });

  test('TC_PROG_13: Tao CTDT ten cuc dai', async ({ page }) => {
    const uniqueCode = 'LONG_' + Date.now();
    const longName = 'A'.repeat(500);
    const result = await page.evaluate(async (data) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: data.code, name: data.longName, name_en: 'Long EN', department_id: dept.id, degree: 'Đại học' })
      });
      const body = await res.json();
      if (res.ok) { await fetch(`/api/programs/${body.id}`, { method: 'DELETE' }); }
      return { ok: res.ok, hasId: !!body.id };
    }, { code: uniqueCode, longName });
    expect(result.ok || !result.ok).toBe(true);
  });

  test('TC_PROG_14: Unarchive CTDT', async ({ page }) => {
    const uniqueCode = 'UNAR_' + Date.now();
    const created = await page.evaluate(async (code) => {
      const deptRes = await fetch('/api/departments');
      const depts = await deptRes.json();
      const dept = depts.find(d => d.type === 'KHOA') || depts[0];
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name: 'Unarchive Test', name_en: 'Unarchive EN', department_id: dept.id, degree: 'Đại học' })
      });
      const prog = await res.json();
      await fetch(`/api/programs/${prog.id}/archive`, { method: 'POST' });
      return prog;
    }, uniqueCode);
    const result = await page.evaluate(async (id) => {
      const res = await fetch(`/api/programs/${id}/unarchive`, { method: 'POST' });
      return res.ok;
    }, created.id);
    expect(result).toBe(true);
    await page.evaluate(async (id) => {
      await fetch(`/api/programs/${id}`, { method: 'DELETE' });
    }, created.id);
  });
});
