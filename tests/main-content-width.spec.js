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

  test('TC_LAYOUT_02: expanded sidebar keeps main content inside a narrower desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    const expanded = await page.locator('.main-content').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return {
        right: Math.ceil(rect.right),
        width: Math.round(rect.width),
        viewportWidth: window.innerWidth,
      };
    });

    expect(expanded.right).toBeLessThanOrEqual(expanded.viewportWidth);
    expect(expanded.width).toBeLessThanOrEqual(expanded.viewportWidth - 240);

    await page.locator('[data-sidebar-toggle]').click();

    const collapsed = await page.locator('.main-content').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return {
        right: Math.ceil(rect.right),
        width: Math.round(rect.width),
        viewportWidth: window.innerWidth,
      };
    });

    expect(collapsed.right).toBeLessThanOrEqual(collapsed.viewportWidth);
    expect(collapsed.width).toBeLessThanOrEqual(collapsed.viewportWidth - 72);
  });

  test('TC_LAYOUT_03: wide editor tabs scroll inside main content instead of widening the shell', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 800 });
    await login(page);

    await page.locator('.main-content').evaluate(el => {
      el.innerHTML = `
        <div class="tab-bar" id="editor-tabs">
          ${[
            'Thông tin',
            'Mục tiêu PO',
            'Chuẩn đầu ra PLO',
            'Chỉ số PI',
            'PO ↔ PLO',
            'Khối KT',
            'Học phần',
            'Mô tả HP',
            'Kế hoạch GD',
            'Sơ đồ tiến trình',
            'HP ↔ PLO',
            'HP ↔ PI',
            'Đánh giá CĐR',
            'Đề cương',
          ].map(label => `<div class="tab-item">${label}</div>`).join('')}
        </div>
      `;
    });

    const expanded = await page.evaluate(() => {
      const mainRect = document.querySelector('.main-content').getBoundingClientRect();
      const tabs = document.querySelector('#editor-tabs');
      return {
        mainRight: Math.ceil(mainRect.right),
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        tabsScrollWidth: tabs.scrollWidth,
        tabsClientWidth: tabs.clientWidth,
      };
    });

    expect(expanded.mainRight).toBeLessThanOrEqual(expanded.viewportWidth);
    expect(expanded.documentWidth).toBeLessThanOrEqual(expanded.viewportWidth);
    expect(expanded.tabsScrollWidth).toBeGreaterThan(expanded.tabsClientWidth);
  });
});
