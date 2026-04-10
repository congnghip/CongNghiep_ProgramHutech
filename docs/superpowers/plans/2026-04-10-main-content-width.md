# Main Content Width Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the shared `.main-content` shell so desktop pages get substantially more horizontal space while preserving the existing sidebar offset behavior.

**Architecture:** Keep this change scoped to the global layout shell by updating `.main-content` in `public/css/styles.css` instead of touching individual page modules. Add one dedicated Playwright regression that measures the computed shell styles before and after collapsing the sidebar, so the wider layout and the existing sidebar margin logic are both protected.

**Tech Stack:** Vanilla CSS, Playwright

---

## File Map

- Modify: `public/css/styles.css`
  Responsibility: define the wider shared desktop content shell by increasing `.main-content` `max-width` and reducing horizontal padding while preserving existing sidebar offsets.
- Create: `tests/main-content-width.spec.js`
  Responsibility: verify the shared content shell uses the new width and padding values, and that those values remain stable when the sidebar toggles between expanded and collapsed states.

### Task 1: Widen the Shared Main Content Shell

**Files:**
- Create: `tests/main-content-width.spec.js`
- Modify: `public/css/styles.css`

- [ ] **Step 1: Write the failing test**

Create `tests/main-content-width.spec.js` with this regression:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx playwright test tests/main-content-width.spec.js --grep "TC_LAYOUT_01"
```

Expected: FAIL because `.main-content` still uses `max-width: 1100px` and `padding: 32px 48px`, so the computed width and padding values do not match the new target.

- [ ] **Step 3: Write minimal implementation**

Update `.main-content` in `public/css/styles.css` to widen the shared shell:

```css
.main-content {
  margin-left: var(--sidebar-w);
  flex: 1;
  padding: 32px 32px;
  max-width: 1440px;
  min-height: 100vh;
}

.layout.sidebar-collapsed .main-content {
  margin-left: var(--sidebar-collapsed-w);
}
```

Do not change page-specific widths, modal `max-width` values, or any component-level spacing in this task.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx playwright test tests/main-content-width.spec.js
```

Expected: PASS with the shared content shell reporting `max-width: 1440px`, `padding-left/right: 32px`, `margin-left: 240px` in expanded mode, and `margin-left: 72px` in collapsed mode.

- [ ] **Step 5: Commit**

```bash
git add tests/main-content-width.spec.js public/css/styles.css
git commit -m "style: widen main content layout"
```
