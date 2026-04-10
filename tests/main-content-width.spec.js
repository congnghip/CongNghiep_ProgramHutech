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

test.describe.serial('Main content width', () => {
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

  test('TC_LAYOUT_01: main content is wider and keeps shell spacing in both sidebar states', async ({ page }) => {
    await login(page);

    const mainContent = page.locator('.main-content');

    const expanded = await mainContent.evaluate(el => {
      const styles = getComputedStyle(el);
      return {
        maxWidth: styles.maxWidth,
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight,
        marginLeft: styles.marginLeft,
      };
    });

    expect(expanded.maxWidth).toBe('1440px');
    expect(expanded.paddingLeft).toBe('32px');
    expect(expanded.paddingRight).toBe('32px');
    expect(expanded.marginLeft).toBe('240px');

    await page.locator('[data-sidebar-toggle]').click();

    const collapsed = await mainContent.evaluate(el => {
      const styles = getComputedStyle(el);
      return {
        maxWidth: styles.maxWidth,
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight,
        marginLeft: styles.marginLeft,
      };
    });

    expect(collapsed.maxWidth).toBe('1440px');
    expect(collapsed.paddingLeft).toBe('32px');
    expect(collapsed.paddingRight).toBe('32px');
    expect(collapsed.marginLeft).toBe('72px');
  });
});
