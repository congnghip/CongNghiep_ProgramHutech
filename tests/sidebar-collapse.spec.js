const path = require('path');
const { test, expect } = require('@playwright/test');

async function login(page, username = 'admin', password = 'admin123') {
  await page.context().clearCookies();
  await page.goto('/');
  await page.locator('#login-user').fill(username);
  await page.locator('#login-pass').fill(password);
  await page.locator('#login-form button[type="submit"]').click();
  await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('#page-content .spinner'), null, { timeout: 10000 });
}

test.describe.serial('Sidebar collapse', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/js/app.js', async route => {
      await route.fulfill({
        path: path.resolve(__dirname, '../public/js/app.js'),
        contentType: 'application/javascript',
      });
    });
    await page.route('**/css/styles.css', async route => {
      await route.fulfill({
        path: path.resolve(__dirname, '../public/css/styles.css'),
        contentType: 'text/css',
      });
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('hutech.sidebar.collapsed'));
  });

  test('TC_SIDEBAR_01: toggle collapses sidebar and keeps nav usable', async ({ page }) => {
    await login(page);

    const sidebar = page.locator('.sidebar');
    const layout = page.locator('.layout');
    const mainContent = page.locator('.main-content');

    await expect(sidebar).not.toHaveClass(/collapsed/);
    await expect(layout).not.toHaveClass(/sidebar-collapsed/);
    await expect(page.locator('.sidebar-user')).toBeVisible();

    const expandedMargin = await mainContent.evaluate(el => getComputedStyle(el).marginLeft);

    await page.locator('[data-sidebar-toggle]').click();

    await expect(sidebar).toHaveClass(/collapsed/);
    await expect(layout).toHaveClass(/sidebar-collapsed/);
    await expect(page.locator('.sidebar-user')).toBeHidden();

    const collapsedMargin = await mainContent.evaluate(el => getComputedStyle(el).marginLeft);
    expect(collapsedMargin).not.toBe(expandedMargin);

    await page.locator('.nav-item[data-page="programs"]').click();
    await expect(page.locator('.nav-item[data-page="programs"]')).toHaveClass(/active/);
    await expect
      .poll(() => page.evaluate(() => window.App.currentPage === window.ProgramsPage))
      .toBe(true);
  });

  test('TC_SIDEBAR_02: collapsed mode keeps tooltips and unread badge visible', async ({ page }) => {
    await login(page);

    await page.evaluate(() => {
      const badge = document.getElementById('notification-badge');
      badge.textContent = '7';
      badge.style.display = 'inline-flex';
    });

    await page.locator('[data-sidebar-toggle]').click();

    const navItems = page.locator('.sidebar .nav-item');
    const navItemCount = await navItems.count();

    expect(navItemCount).toBeGreaterThan(0);

    for (let i = 0; i < navItemCount; i += 1) {
      await expect(navItems.nth(i)).toHaveAttribute('title', /.+/);
    }

    await expect(page.locator('#notification-badge')).toBeVisible();

    await login(page, 'giangvien', 'admin123');
    await page.locator('[data-sidebar-toggle]').click();

    const myAssignments = page.locator('.nav-item[data-page="my-assignments"]');
    await expect(myAssignments).toBeVisible();
    await expect(myAssignments).toHaveAttribute('title', /.+/);
  });

  test('TC_SIDEBAR_03: collapsed preference persists after reload', async ({ page }) => {
    await login(page);

    await page.locator('[data-sidebar-toggle]').click();

    await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('hutech.sidebar.collapsed')))
      .toBe('true');

    await page.reload();
    await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
    await expect(page.locator('.layout')).toHaveClass(/sidebar-collapsed/);
    await page.waitForFunction(() => !document.querySelector('#page-content .spinner'), null, { timeout: 10000 });

    await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
    await expect(page.locator('.layout')).toHaveClass(/sidebar-collapsed/);
    await expect(page.locator('.sidebar-user')).toBeHidden();
  });
});
