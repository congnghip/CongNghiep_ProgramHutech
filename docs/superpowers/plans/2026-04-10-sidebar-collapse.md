# Sidebar Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent icon-only collapse mode for the left sidebar without changing routing or permission-based navigation behavior.

**Architecture:** Extend the existing global `window.App` shell state with a `sidebarCollapsed` flag, render collapse-aware markup directly from `renderApp()`, and drive the layout change with a `.collapsed` sidebar class plus a `.sidebar-collapsed` layout class. Cover the behavior with a dedicated Playwright spec that verifies toggle behavior, tooltips and badge visibility, navigation usability, and reload persistence.

**Tech Stack:** Vanilla JavaScript SPA shell, CSS, Playwright

---

## File Map

- Modify: `public/js/app.js`
  Responsibility: hold the sidebar collapse state, render the toggle button and nav labels, attach the toggle listener, and persist the preference in `localStorage`.
- Modify: `public/css/styles.css`
  Responsibility: define the collapsed width, animate the shell shift, hide labels and footer content in collapsed mode, and keep the notification badge readable in the narrower sidebar.
- Create: `tests/sidebar-collapse.spec.js`
  Responsibility: exercise the sidebar shell from the browser like a user would, including toggle, tooltip, badge, navigation, and reload persistence checks.

### Task 1: Add the Collapse Toggle and Core Layout State

**Files:**
- Create: `tests/sidebar-collapse.spec.js`
- Modify: `public/js/app.js`
- Modify: `public/css/styles.css`

- [ ] **Step 1: Write the failing test**

Create `tests/sidebar-collapse.spec.js` with the first regression only:

```js
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx playwright test tests/sidebar-collapse.spec.js --grep "TC_SIDEBAR_01"
```

Expected: FAIL because `[data-sidebar-toggle]` does not exist yet, and the app has no collapsed sidebar state or layout class.

- [ ] **Step 3: Write minimal implementation**

Update `public/js/app.js` to add in-memory collapse state, render a toggle button, and wrap nav text in label spans so CSS can hide the text without removing the clickable items.

Add the new state and helper methods near the top of the `App` object:

```js
const App = {
  currentUser: null,
  userRoles: [],
  userPerms: [],
  isAdmin: false,
  currentPage: null,
  notificationUnread: 0,
  notificationFilter: 'all',
  notificationPollTimer: null,
  sidebarCollapsed: false,

  applySidebarState() {
    document.querySelector('.layout')?.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
    document.querySelector('.sidebar')?.classList.toggle('collapsed', this.sidebarCollapsed);

    const toggle = document.querySelector('[data-sidebar-toggle]');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!this.sidebarCollapsed));
      toggle.setAttribute('aria-label', this.sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar');
      toggle.textContent = this.sidebarCollapsed ? '»' : '«';
    }
  },

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.applySidebarState();
  },
```

Replace the `renderApp()` shell markup with a collapse-aware version:

```js
renderApp() {
  const role = this.getHighestRole();
  document.getElementById('app').innerHTML = `
    <div class="layout ${this.sidebarCollapsed ? 'sidebar-collapsed' : ''}">
      <div class="sidebar ${this.sidebarCollapsed ? 'collapsed' : ''}">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <span class="sidebar-brand-icon">🎓</span>
            <h1>HUTECH Program</h1>
          </div>
          <button
            type="button"
            class="sidebar-toggle"
            data-sidebar-toggle
            aria-label="${this.sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}"
            aria-expanded="${String(!this.sidebarCollapsed)}"
          >${this.sidebarCollapsed ? '»' : '«'}</button>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-item active" data-page="dashboard">
            <span class="icon">📊</span>
            <span class="nav-label">Tổng quan</span>
          </div>
          <div class="nav-item" id="notification-nav" data-notification-trigger>
            <span class="icon">🔔</span>
            <span class="nav-label nav-label-grow">Thông báo</span>
            <span class="notification-badge" id="notification-badge" style="display:none;"></span>
          </div>

          <div class="nav-section">Đào tạo</div>
          ${(this.hasPerm('programs.view_published') || this.hasPerm('programs.view_draft')) ? `
          <div class="nav-item" data-page="programs">
            <span class="icon">📋</span>
            <span class="nav-label">Chương trình ĐT</span>
          </div>` : ''}
          ${this.hasPerm('courses.view') ? `
          <div class="nav-item" data-page="courses">
            <span class="icon">📚</span>
            <span class="nav-label">Học phần</span>
          </div>` : ''}
          ${this.userRoles.some(r => r.role_code === 'GIANG_VIEN') ? `
          <div class="nav-item" data-page="my-assignments">
            <span class="icon">📝</span>
            <span class="nav-label">Đề cương của tôi</span>
          </div>` : ''}
          <div class="nav-item" data-page="approval">
            <span class="icon">📬</span>
            <span class="nav-label">Phê duyệt</span>
          </div>

          ${this.isAdmin ? `
          <div class="nav-section">Cài đặt</div>
          <div class="nav-item" data-page="rbac-admin">
            <span class="icon">⚙️</span>
            <span class="nav-label">Phân quyền</span>
          </div>
          <div class="nav-item" data-page="audit-logs">
            <span class="icon">📜</span>
            <span class="nav-label">Nhật ký</span>
          </div>
          ` : ''}
        </nav>
        <div class="sidebar-user">
          <div class="user-info">
            <div class="user-name">${this.currentUser.display_name}</div>
            <div class="user-role">${role.role_name}</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="logout-btn" style="flex:1;" onclick="window.App.openChangePassword()">Đổi MK</button>
            <button class="logout-btn" style="flex:1;" onclick="window.App.logout()">Đăng xuất</button>
          </div>
        </div>
      </div>
      <main class="main-content" id="page-content"></main>
    </div>
  `;

  document.querySelector('[data-sidebar-toggle]')?.addEventListener('click', () => this.toggleSidebar());
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => this.navigate(item.dataset.page));
  });
  document.getElementById('notification-nav')?.addEventListener('click', () => this.openNotificationsDrawer());

  this.applySidebarState();
  this.startNotificationPolling();
  this.navigate('dashboard');
},
```

Update `public/css/styles.css` with the base collapsed-shell styles:

```css
:root {
  --sidebar-w: 240px;
  --sidebar-collapsed-w: 72px;
}

.sidebar {
  width: var(--sidebar-w);
  transition: width 0.18s ease;
}

.sidebar-header {
  padding: 16px 14px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.sidebar-brand-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.sidebar-toggle {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: background 0.15s ease, color 0.15s ease;
}

.sidebar-toggle:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.nav-label {
  min-width: 0;
}

.nav-label-grow {
  flex: 1;
}

.main-content {
  margin-left: var(--sidebar-w);
  transition: margin-left 0.18s ease;
}

.layout.sidebar-collapsed .main-content {
  margin-left: var(--sidebar-collapsed-w);
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed-w);
}

.sidebar.collapsed .sidebar-header h1,
.sidebar.collapsed .nav-section,
.sidebar.collapsed .nav-label,
.sidebar.collapsed .sidebar-user {
  display: none;
}

.sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding-inline: 8px;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 8px 0;
}

.sidebar.collapsed .nav-item .icon {
  width: auto;
  margin: 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx playwright test tests/sidebar-collapse.spec.js --grep "TC_SIDEBAR_01"
```

Expected: PASS with the sidebar gaining the `.collapsed` class, `.layout` gaining `.sidebar-collapsed`, the footer hiding, and the `programs` nav item still navigating.

- [ ] **Step 5: Commit**

```bash
git add tests/sidebar-collapse.spec.js public/js/app.js public/css/styles.css
git commit -m "feat: add sidebar collapse toggle"
```

### Task 2: Add Tooltips and Collapsed Notification Badge Layout

**Files:**
- Modify: `tests/sidebar-collapse.spec.js`
- Modify: `public/js/app.js`
- Modify: `public/css/styles.css`

- [ ] **Step 1: Write the failing test**

Append a second regression to `tests/sidebar-collapse.spec.js`:

```js
  test('TC_SIDEBAR_02: collapsed mode keeps tooltips and unread badge visible', async ({ page }) => {
    await login(page);

    await page.evaluate(() => {
      const badge = document.getElementById('notification-badge');
      badge.textContent = '7';
      badge.style.display = 'inline-flex';
    });

    await page.locator('[data-sidebar-toggle]').click();

    await expect(page.locator('.nav-item[data-page="dashboard"]')).toHaveAttribute('title', 'Tổng quan');
    await expect(page.locator('#notification-nav')).toHaveAttribute('title', 'Thông báo');
    await expect(page.locator('#notification-badge')).toBeVisible();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx playwright test tests/sidebar-collapse.spec.js --grep "TC_SIDEBAR_02"
```

Expected: FAIL because the collapsed nav items do not expose tooltip text through `title`, and the notification badge has not been positioned for the narrow layout yet.

- [ ] **Step 3: Write minimal implementation**

Update every sidebar item in `public/js/app.js` to expose the tooltip text via `title` so the browser can show it when the labels are hidden:

```js
<div class="nav-item active" data-page="dashboard" title="Tổng quan">
  <span class="icon">📊</span>
  <span class="nav-label">Tổng quan</span>
</div>
<div class="nav-item" id="notification-nav" data-notification-trigger title="Thông báo">
  <span class="icon">🔔</span>
  <span class="nav-label nav-label-grow">Thông báo</span>
  <span class="notification-badge" id="notification-badge" style="display:none;"></span>
</div>
<div class="nav-item" data-page="programs" title="Chương trình ĐT">
  <span class="icon">📋</span>
  <span class="nav-label">Chương trình ĐT</span>
</div>
<div class="nav-item" data-page="courses" title="Học phần">
  <span class="icon">📚</span>
  <span class="nav-label">Học phần</span>
</div>
<div class="nav-item" data-page="my-assignments" title="Đề cương của tôi">
  <span class="icon">📝</span>
  <span class="nav-label">Đề cương của tôi</span>
</div>
<div class="nav-item" data-page="approval" title="Phê duyệt">
  <span class="icon">📬</span>
  <span class="nav-label">Phê duyệt</span>
</div>
<div class="nav-item" data-page="rbac-admin" title="Phân quyền">
  <span class="icon">⚙️</span>
  <span class="nav-label">Phân quyền</span>
</div>
<div class="nav-item" data-page="audit-logs" title="Nhật ký">
  <span class="icon">📜</span>
  <span class="nav-label">Nhật ký</span>
</div>
```

Extend the collapsed notification styles in `public/css/styles.css` so the unread badge stays visible instead of overlapping the icon:

```css
.sidebar.collapsed #notification-nav {
  position: relative;
}

.sidebar.collapsed #notification-nav .notification-badge {
  position: absolute;
  top: 3px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx playwright test tests/sidebar-collapse.spec.js --grep "TC_SIDEBAR_0(1|2)"
```

Expected: PASS with `title` attributes available on collapsed items and the notification badge still visible after forcing unread content into it.

- [ ] **Step 5: Commit**

```bash
git add tests/sidebar-collapse.spec.js public/js/app.js public/css/styles.css
git commit -m "feat: add collapsed sidebar tooltips"
```

### Task 3: Persist the Sidebar Preference Across Reloads

**Files:**
- Modify: `tests/sidebar-collapse.spec.js`
- Modify: `public/js/app.js`

- [ ] **Step 1: Write the failing test**

Append the reload-persistence regression to `tests/sidebar-collapse.spec.js`:

```js
  test('TC_SIDEBAR_03: collapsed preference persists after reload', async ({ page }) => {
    await login(page);

    await page.locator('[data-sidebar-toggle]').click();

    await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('hutech.sidebar.collapsed')))
      .toBe('true');

    await page.reload();
    await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector('#page-content .spinner'), null, { timeout: 10000 });

    await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
    await expect(page.locator('.layout')).toHaveClass(/sidebar-collapsed/);
    await expect(page.locator('.sidebar-user')).toBeHidden();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx playwright test tests/sidebar-collapse.spec.js --grep "TC_SIDEBAR_03"
```

Expected: FAIL because the app keeps sidebar collapse only in memory, so reload restores the default expanded layout and the `localStorage` key is missing.

- [ ] **Step 3: Write minimal implementation**

Persist the preference in `public/js/app.js` with a guarded `localStorage` read/write path:

```js
const App = {
  currentUser: null,
  userRoles: [],
  userPerms: [],
  isAdmin: false,
  currentPage: null,
  notificationUnread: 0,
  notificationFilter: 'all',
  notificationPollTimer: null,
  sidebarCollapsed: false,
  sidebarStorageKey: 'hutech.sidebar.collapsed',

  loadSidebarPreference() {
    try {
      this.sidebarCollapsed = localStorage.getItem(this.sidebarStorageKey) === 'true';
    } catch (e) {
      this.sidebarCollapsed = false;
    }
  },

  persistSidebarPreference() {
    try {
      localStorage.setItem(this.sidebarStorageKey, String(this.sidebarCollapsed));
    } catch (e) {
      return;
    }
  },

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.persistSidebarPreference();
    this.applySidebarState();
  },
```

Load the saved value before the shell is rendered:

```js
async init() {
  this.initToast();
  this.initDialog();
  this.initModalScrollLock();
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      this.currentUser = data.user;
      this.userRoles = data.roles;
      this.userPerms = data.permissions;
      this.isAdmin = data.isAdmin;
      this.loadSidebarPreference();
      this.renderApp();
    } else {
      this.renderLogin();
    }
  } catch (e) { this.renderLogin(); }
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx playwright test tests/sidebar-collapse.spec.js
```

Expected: PASS for all three regressions, confirming toggle behavior, collapsed-mode tooltips and badge, and reload persistence.

- [ ] **Step 5: Commit**

```bash
git add tests/sidebar-collapse.spec.js public/js/app.js public/css/styles.css
git commit -m "feat: persist sidebar collapse preference"
```
