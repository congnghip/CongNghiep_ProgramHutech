# Notion-like UI Refactor — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the CSS design system with new variables, button variants, utility classes, and component classes — then refactor 4 core JS pages (dashboard, programs, version-editor, syllabus-editor) to replace inline styles with these CSS classes.

**Architecture:** Single-file CSS approach — all additions go into `public/css/styles.css`. JS changes are style-attribute replacements only; no logic, ID, or class-name changes that would break existing JavaScript.

**Tech Stack:** Vanilla CSS, vanilla JS (no frameworks, no build tools)

**Design spec:** `docs/superpowers/specs/2026-04-05-notion-ui-refactor-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `public/css/styles.css` | Modify | Add new CSS variables, button variants, utility classes, component classes |
| `public/js/pages/dashboard.js` | Modify | Replace inline styles with CSS classes |
| `public/js/pages/programs.js` | Modify | Replace inline styles and hardcoded colors with CSS classes |
| `public/js/pages/version-editor.js` | Modify | Replace breadcrumb, title, and rejection-box inline styles with CSS classes |
| `public/js/pages/syllabus-editor.js` | Modify | Same patterns as version-editor |

No new files are created. No files are deleted.

---

### Task 1: Add new CSS variables to `:root`

**Files:**
- Modify: `public/css/styles.css:4-34`

- [ ] **Step 1: Add spacing scale, button outline, warning-hover, and row-divider variables**

Add these variables inside the existing `:root` block, after line 33 (`--shadow-md`), before the closing `}`:

```css
  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Button outline */
  --outline-border: rgba(55, 53, 47, 0.16);
  --outline-border-hover: rgba(55, 53, 47, 0.3);

  /* Warning hover */
  --warning-hover: #c76b0a;

  /* Table row divider (lighter than --divider) */
  --row-divider: rgba(55, 53, 47, 0.05);
```

- [ ] **Step 2: Verify the app still loads**

Run: `make dev` (or check localhost:3600 in browser)
Expected: App loads normally, no visual changes yet.

- [ ] **Step 3: Commit**

```bash
git add public/css/styles.css
git commit -m "style: add spacing scale, button outline, and row-divider CSS variables"
```

---

### Task 2: Add new button variant classes

**Files:**
- Modify: `public/css/styles.css` (after the `.btn:disabled` block, around line 220)

- [ ] **Step 1: Add `.btn-outline-primary`, `.btn-outline-secondary`, `.btn-warning`, `.btn-ghost` classes**

Insert after the `.btn:disabled` rule (line 220):

```css
.btn-outline-primary {
  background: var(--bg);
  color: var(--primary);
  border: 1px solid var(--outline-border);
}
.btn-outline-primary:hover {
  background: var(--primary-bg);
  border-color: var(--outline-border-hover);
}
.btn-outline-secondary {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--outline-border);
}
.btn-outline-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--outline-border-hover);
}
.btn-warning {
  background: var(--warning);
  color: #fff;
}
.btn-warning:hover {
  background: var(--warning-hover);
}
.btn-ghost {
  background: transparent;
  color: var(--text);
  border: none;
}
.btn-ghost:hover {
  background: var(--bg-hover);
}
```

- [ ] **Step 2: Verify buttons render correctly**

Open the app, navigate to Programs page. The existing `.btn-outline-primary` and `.btn-outline-secondary` classes used in programs.js should now pick up the CSS styles instead of relying on inline styles.

- [ ] **Step 3: Commit**

```bash
git add public/css/styles.css
git commit -m "style: add btn-outline-primary, btn-outline-secondary, btn-warning, btn-ghost classes"
```

---

### Task 3: Update table row divider and sidebar transitions

**Files:**
- Modify: `public/css/styles.css`

- [ ] **Step 1: Change table `td` border-bottom to use `--row-divider`**

In `.data-table td` (line ~430), change:
```css
  border-bottom: 1px solid var(--divider);
```
to:
```css
  border-bottom: 1px solid var(--row-divider);
```

- [ ] **Step 2: Update `.nav-item` transition from `0.1s` to `0.15s ease`**

In `.nav-item` (line ~100), change:
```css
  transition: all 0.1s ease;
```
to:
```css
  transition: all 0.15s ease;
```

- [ ] **Step 3: Update `.tree-node` transition from `0.1s` to `0.15s ease`**

In `.tree-node` (line ~596), change:
```css
  transition: background 0.1s;
```
to:
```css
  transition: background 0.15s ease;
```

- [ ] **Step 4: Verify visually**

Check a table page (e.g., Users) — row dividers should be lighter. Sidebar nav hover should still feel smooth.

- [ ] **Step 5: Commit**

```bash
git add public/css/styles.css
git commit -m "style: lighten table row dividers, sync nav/tree hover transitions to 0.15s"
```

---

### Task 4: Add typography classes

**Files:**
- Modify: `public/css/styles.css` (add after the TABS section, before TREE section, around line 590)

- [ ] **Step 1: Add `.page-title`, `.section-title`, `.label-upper` classes**

Insert before the `/* ===== TREE / LIST ITEM ===== */` comment:

```css
/* ===== TYPOGRAPHY ===== */
.page-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--text);
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.label-upper {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}
```

- [ ] **Step 2: Commit**

```bash
git add public/css/styles.css
git commit -m "style: add page-title, section-title, label-upper typography classes"
```

---

### Task 5: Add layout utility classes

**Files:**
- Modify: `public/css/styles.css` (add to the UTILITY section, after line ~761)

- [ ] **Step 1: Add `.flex-row`, `.flex-between`, `.grid-2col`, `.grid-3col` classes**

Insert after `.mb-4` in the UTILITY section:

```css
.flex-row { display: flex; align-items: center; gap: var(--space-2); }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.grid-3col { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
```

- [ ] **Step 2: Commit**

```bash
git add public/css/styles.css
git commit -m "style: add flex-row, flex-between, grid-2col, grid-3col layout utilities"
```

---

### Task 6: Add component classes and spacing utilities

**Files:**
- Modify: `public/css/styles.css`

- [ ] **Step 1: Add component classes after the typography section**

Insert after the typography classes (after `.label-upper`):

```css
/* ===== COMPONENTS ===== */
.stat-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text);
}
.stat-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
}
.breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  flex-wrap: wrap;
}
.breadcrumb-link {
  color: var(--text-muted);
  text-decoration: none;
  cursor: pointer;
}
.breadcrumb-link:hover {
  text-decoration: underline;
}
.breadcrumb-sep {
  color: var(--text-muted);
}
.breadcrumb-current {
  color: var(--text);
  font-weight: 600;
}
.required-mark {
  color: var(--danger);
}
.rejection-banner {
  background: rgba(227, 179, 65, 0.12);
  border: 1px solid var(--warning);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.rejection-banner-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.rejection-banner-label {
  font-size: 13px;
  color: #92600a;
  font-weight: 500;
}
.rejection-panel {
  display: none;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}
.page-header {
  margin-bottom: var(--space-6);
}
.page-header-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-1);
}
.page-header-meta .text-muted-sm {
  color: var(--text-muted);
  font-size: 12px;
}
.page-header-actions {
  display: flex;
  gap: var(--space-2);
}
```

- [ ] **Step 2: Add spacing utilities**

Add to the UTILITY section (after `.grid-3col`):

```css
.mt-2 { margin-top: var(--space-2); }
.mt-3 { margin-top: var(--space-3); }
.mt-6 { margin-top: var(--space-6); }
.mt-8 { margin-top: var(--space-8); }
.mb-2 { margin-bottom: var(--space-2); }
.mb-3 { margin-bottom: var(--space-3); }
.mb-6 { margin-bottom: var(--space-6); }
.mb-8 { margin-bottom: var(--space-8); }
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }
.gap-3 { gap: var(--space-3); }
```

- [ ] **Step 3: Verify the app loads**

Reload the app — no visual changes should be visible yet (classes are defined but not yet used in JS).

- [ ] **Step 4: Commit**

```bash
git add public/css/styles.css
git commit -m "style: add component classes (stat-card, breadcrumb, rejection-banner) and spacing utilities"
```

---

### Task 7: Refactor dashboard.js — replace inline styles with CSS classes

**Files:**
- Modify: `public/js/pages/dashboard.js`

- [ ] **Step 1: Replace the greeting header (lines 13-16)**

Change:
```js
        <div style="margin-bottom:32px;">
          <h1 style="font-size:28px;font-weight:700;letter-spacing:-0.5px;">Xin chào, ${window.App.currentUser.display_name}</h1>
          <p style="color:var(--text-muted);margin-top:4px;">${role.role_name} · ${role.dept_name || 'HUTECH'}</p>
        </div>
```
to:
```js
        <div class="mb-8">
          <h1 class="page-title" style="font-size:28px;letter-spacing:-0.5px;">Xin chào, ${window.App.currentUser.display_name}</h1>
          <p class="text-muted mt-2">${role.role_name} · ${role.dept_name || 'HUTECH'}</p>
        </div>
```

Note: We keep `style="font-size:28px;letter-spacing:-0.5px;"` as an override because the dashboard greeting is intentionally larger than the standard `.page-title` (28px vs 24px).

- [ ] **Step 2: Replace metrics grid (line 18)**

Change:
```js
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:32px;">
```
to:
```js
        <div class="grid-3col mb-8" style="gap:0;">
```

- [ ] **Step 3: Replace the metric() helper (lines 66-69)**

Change:
```js
  metric(label, value) {
    return `<div style="padding:16px 0;border-bottom:1px solid var(--divider);">
      <div style="font-size:28px;font-weight:700;color:var(--text);letter-spacing:-0.5px;">${value}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${label}</div>
    </div>`;
  },
```
to:
```js
  metric(label, value) {
    return `<div style="padding:16px 0;border-bottom:1px solid var(--row-divider);">
      <div class="stat-value" style="font-size:28px;">${value}</div>
      <div class="stat-label mt-2">${label}</div>
    </div>`;
  },
```

- [ ] **Step 4: Replace the two-column status grid (line 27)**

Change:
```js
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:32px;">
```
to:
```js
        <div class="grid-2col mb-8" style="gap:40px;">
```

- [ ] **Step 5: Replace section titles (lines 29, 35, 43)**

Change each:
```js
            <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">
```
to:
```js
            <h3 class="section-title mb-3">
```

- [ ] **Step 6: Replace muted text paragraphs (lines 45, 75)**

Change:
```js
            ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có hoạt động nào.</p>'
```
to:
```js
            ? '<p class="text-muted" style="font-size:13px;">Chưa có hoạt động nào.</p>'
```

And change:
```js
    if (total === 0) return '<p style="color:var(--text-muted);font-size:13px;">Chưa có dữ liệu</p>';
```
to:
```js
    if (total === 0) return '<p class="text-muted" style="font-size:13px;">Chưa có dữ liệu</p>';
```

- [ ] **Step 7: Replace activity row layout (line 48)**

Change:
```js
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--divider);font-size:13px;">
```
to:
```js
                <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--row-divider);font-size:13px;">
```

- [ ] **Step 8: Replace statusList row layout (line 78)**

Change:
```js
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
        <span style="color:var(--text-muted);">${label}</span>
```
to:
```js
      return `<div class="flex-between" style="padding:4px 0;font-size:13px;">
        <span class="text-muted">${label}</span>
```

- [ ] **Step 9: Verify dashboard renders correctly**

Open http://localhost:3600, log in, check the dashboard page. All metrics, status lists, and activity rows should look the same as before.

- [ ] **Step 10: Commit**

```bash
git add public/js/pages/dashboard.js
git commit -m "refactor(dashboard): replace inline styles with CSS utility classes"
```

---

### Task 8: Refactor programs.js — replace inline styles with CSS classes

**Files:**
- Modify: `public/js/pages/programs.js`

- [ ] **Step 1: Replace header button container (line 13)**

Change:
```js
            <div style="display:flex;gap:8px;align-items:center;">
```
to:
```js
            <div class="flex-row">
```

- [ ] **Step 2: Remove inline button styles that are now covered by CSS classes**

The buttons on line 14-15 already use class names `btn-warning`, `btn-outline-secondary`, `btn-outline-primary` — these will now pick up the CSS we added in Task 2. No JS changes needed for these buttons specifically.

- [ ] **Step 3: Replace `<span style="color:var(--danger);">*</span>` with `.required-mark`**

Throughout the file, replace all occurrences of:
```js
<span style="color:var(--danger);">*</span>
```
with:
```js
<span class="required-mark">*</span>
```

These appear on lines 33, 37, 53, 55, 111, 138.

- [ ] **Step 4: Replace form grid layouts with `.grid-2col`**

Change line 31:
```js
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
```
to:
```js
              <div class="grid-2col">
```

Do the same for lines 69, 136 (same pattern).

- [ ] **Step 5: Replace section divider lines**

Change the `<hr>` on line 66:
```js
              <hr style="border:none;border-top:2px dashed var(--border);margin:16px 0;">
```
Keep as-is — this is a unique dashed divider style that doesn't match any utility class. Same for line 181.

- [ ] **Step 6: Replace section header text styles (lines 29-30, 67-68)**

Change:
```js
              <p style="font-weight:600;margin-bottom:8px;">Thông tin cơ bản</p>
              <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Các trường có dấu * là bắt buộc.</p>
```
to:
```js
              <p class="section-title mb-2" style="font-size:14px;">Thông tin cơ bản</p>
              <p class="text-muted mb-3" style="font-size:12px;">Các trường có dấu * là bắt buộc.</p>
```

And similarly for lines 67-68:
```js
              <p class="section-title mb-2" style="font-size:14px;">Thông tin bổ sung</p>
              <p class="text-muted mb-3" style="font-size:12px;">Cung cấp thêm thông tin để đội ngũ tuyển sinh và đào tạo nắm rõ đặc điểm chương trình.</p>
```

- [ ] **Step 7: Replace `renderProg` tree node — remove inline hover handlers**

Change lines 308-330. The `renderProg` function currently uses inline `onmouseenter`/`onmouseleave` handlers. Replace with the existing `.tree-node` class which already has `:hover` in CSS:

Change:
```js
    const renderProg = (p) => `
      <div class="tree-node" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:10px 12px;border-radius:8px;transition:background .15s;"
           onmouseenter="this.style.background='var(--bg-hover, #f5f5f5)'"
           onmouseleave="this.style.background=''"
           onclick="window.ProgramsPage.viewVersions(${p.id},'${p.name.replace(/'/g,"\\'")}')">
        <div style="flex:1;min-width:0;">
```
to:
```js
    const renderProg = (p) => `
      <div class="tree-node flex-between" style="cursor:pointer;"
           onclick="window.ProgramsPage.viewVersions(${p.id},'${p.name.replace(/'/g,"\\'")}')">
        <div style="flex:1;min-width:0;">
```

Note: `.tree-node` already has `padding:10px 12px`, `border-radius: var(--radius)`, `transition: background 0.15s ease`, and `:hover { background: var(--bg-hover) }`. We add `.flex-between` for the flex layout.

- [ ] **Step 8: Replace action button inline styles in `renderProg` (lines 320-327)**

Change:
```js
        <div style="display:flex;gap:6px;flex-shrink:0;" onclick="event.stopPropagation()">
```
to:
```js
        <div class="flex-row" style="flex-shrink:0;" onclick="event.stopPropagation()">
```

Replace the inline-styled edit button:
```js
            ${window.App.hasPerm('programs.edit') ? `<button class="btn btn-sm" style="background:none;border:1px solid var(--border);color:var(--text);font-size:12px;" onclick="...">Chỉnh sửa</button>` : ''}
```
to:
```js
            ${window.App.hasPerm('programs.edit') ? `<button class="btn btn-sm btn-outline-secondary" onclick="...">Chỉnh sửa</button>` : ''}
```

Replace the inline-styled delete button:
```js
            ${window.App.hasPerm('programs.delete_draft') ? `<button class="btn btn-sm" style="background:none;border:none;color:var(--danger);font-size:12px;font-weight:500;" onclick="...">Xóa</button>` : ''}
```
to:
```js
            ${window.App.hasPerm('programs.delete_draft') ? `<button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="...">Xóa</button>` : ''}
```

Replace the inline-styled archive button:
```js
            ${window.App.isAdmin && parseInt(p.version_count) > 0 ? `<button class="btn btn-sm" style="background:none;border:none;color:var(--warning, #e67e22);font-size:12px;font-weight:500;" onclick="...">Lưu trữ</button>` : ''}
```
to:
```js
            ${window.App.isAdmin && parseInt(p.version_count) > 0 ? `<button class="btn btn-sm btn-ghost" style="color:var(--warning);" onclick="...">Lưu trữ</button>` : ''}
```

- [ ] **Step 9: Replace khoa group headers (lines 332-345)**

Change:
```js
        <h3 style="font-size:15px;font-weight:700;margin-bottom:10px;color:var(--text);border-bottom:2px solid var(--border);padding-bottom:6px;">${khoa}</h3>
```
to:
```js
        <h3 class="section-title" style="font-weight:700;margin-bottom:10px;border-bottom:2px solid var(--border);padding-bottom:6px;">${khoa}</h3>
```

Change nganh header:
```js
            <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-muted);">${nganh}</h4>
```
to:
```js
            <h4 style="font-size:13px;font-weight:600;color:var(--text-muted);" class="mb-2">${nganh}</h4>
```

- [ ] **Step 10: Replace version list tree nodes (lines 590-611)**

Same pattern as renderProg — replace inline hover handlers with `.tree-node` class:

Change:
```js
              <div class="tree-node" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:10px 12px;border-radius:8px;transition:background .15s;${v.is_locked ? 'opacity:0.7;' : ''}"
                   onmouseenter="this.style.background='var(--bg-hover, #f5f5f5)'"
                   onmouseleave="this.style.background=''"
```
to:
```js
              <div class="tree-node flex-between" style="cursor:pointer;${v.is_locked ? 'opacity:0.7;' : ''}"
```

Replace version action buttons (lines 607-610) with the same patterns from Step 8:
- Edit button → `.btn-outline-secondary`
- Delete button → `.btn-ghost` with `color:var(--danger)`

- [ ] **Step 11: Replace version list header (line 582-584)**

Change:
```js
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
```
to:
```js
        <div class="flex-row mb-4" style="gap:10px;">
```

And:
```js
          <h3 style="font-size:15px;font-weight:600;">Phiên bản: ${programName}</h3>
```
to:
```js
          <h3 class="section-title">Phiên bản: ${programName}</h3>
```

- [ ] **Step 12: Replace error messages**

Change line 272:
```js
      document.getElementById('programs-content').innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
```
to:
```js
      document.getElementById('programs-content').innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
```
(Keep as-is — this is a one-off error display, not worth a class.)

- [ ] **Step 13: Verify programs page renders correctly**

Navigate to Programs, check:
- Program tree renders with hover effects
- Buttons display correct colors (outline blue, outline gray, warning yellow)
- Version list renders correctly
- Modal forms display correctly
- All click handlers still work (create, edit, delete, archive)

- [ ] **Step 14: Commit**

```bash
git add public/js/pages/programs.js
git commit -m "refactor(programs): replace inline styles with CSS classes, remove hover handlers"
```

---

### Task 9: Refactor version-editor.js — replace inline styles with CSS classes

**Files:**
- Modify: `public/js/pages/version-editor.js`

- [ ] **Step 1: Replace breadcrumb navigation (lines 55-63)**

Change:
```js
        <nav style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:12px;flex-wrap:wrap;">
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs')" style="color:var(--text-muted);text-decoration:none;cursor:pointer;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">Chương trình Đào tạo</a>
          <span style="color:var(--text-muted);">›</span>
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs',{deptId:${this.version.department_id || 'null'},deptName:'${(this.version.dept_name || '').replace(/'/g, "\\'")}'})  " style="color:var(--text-muted);text-decoration:none;cursor:pointer;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">${this.version.dept_name || ''}</a>
          <span style="color:var(--text-muted);">›</span>
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs',{programId:${this.version.program_id},programName:'${(this.version.program_name || '').replace(/'/g, "\\'")}'})  " style="color:var(--text-muted);text-decoration:none;cursor:pointer;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">${this.version.program_name}</a>
          <span style="color:var(--text-muted);">›</span>
          <span style="color:var(--text);font-weight:600;">${this.version.academic_year}</span>
        </nav>
```
to:
```js
        <nav class="breadcrumb-nav mb-3">
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs')" class="breadcrumb-link">Chương trình Đào tạo</a>
          <span class="breadcrumb-sep">›</span>
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs',{deptId:${this.version.department_id || 'null'},deptName:'${(this.version.dept_name || '').replace(/'/g, "\\'")}'})  " class="breadcrumb-link">${this.version.dept_name || ''}</a>
          <span class="breadcrumb-sep">›</span>
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs',{programId:${this.version.program_id},programName:'${(this.version.program_name || '').replace(/'/g, "\\'")}'})  " class="breadcrumb-link">${this.version.program_name}</a>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">${this.version.academic_year}</span>
        </nav>
```

- [ ] **Step 2: Replace page header (lines 55, 65-78)**

Change outer container:
```js
      <div style="margin-bottom:24px;">
```
to:
```js
      <div class="page-header">
```

Change title/status layout:
```js
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;">${this.version.academic_year}</h1>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
```
to:
```js
        <div class="flex-between">
          <div>
            <h1 class="page-title">${this.version.academic_year}</h1>
            <div class="page-header-meta">
```

Change:
```js
              <span style="color:var(--text-muted);font-size:12px;">Hoàn thành ${this.version.completion_pct || 0}%</span>
```
to:
```js
              <span class="text-muted-sm">Hoàn thành ${this.version.completion_pct || 0}%</span>
```

Change actions container:
```js
          <div style="display:flex;gap:6px;">
```
to:
```js
          <div class="page-header-actions">
```

- [ ] **Step 3: Replace rejection banner (lines 81-91)**

Change:
```js
        <div style="background:rgba(227, 179, 65, 0.12);border:1px solid #e3a008;border-radius:var(--radius-lg);padding:16px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="badge badge-warning" style="padding:4px 8px;font-weight:600;">Bị từ chối</span>
            <div style="font-size:13px;color:#92600a;font-weight:500;">Yêu cầu chỉnh sửa từ người phê duyệt</div>
          </div>
          <button class="btn btn-sm" style="background:#e3a008;color:#fff;border:none;" onclick="window.VersionEditorPage.showRejectionReason()">Lý do từ chối</button>
        </div>
        <div id="rejection-panel" style="display:none;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px;">
          <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Lý do chi tiết:</h4>
          <div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${rejectionReason || 'Chưa có lý do cụ thể.'}</div>
        </div>
```
to:
```js
        <div class="rejection-banner">
          <div class="rejection-banner-content">
            <span class="badge badge-warning" style="padding:4px 8px;font-weight:600;">Bị từ chối</span>
            <div class="rejection-banner-label">Yêu cầu chỉnh sửa từ người phê duyệt</div>
          </div>
          <button class="btn btn-sm btn-warning" onclick="window.VersionEditorPage.showRejectionReason()">Lý do từ chối</button>
        </div>
        <div id="rejection-panel" class="rejection-panel">
          <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Lý do chi tiết:</h4>
          <div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${rejectionReason || 'Chưa có lý do cụ thể.'}</div>
        </div>
```

- [ ] **Step 4: Verify version editor renders correctly**

Navigate to a program → open a version. Check:
- Breadcrumb navigation displays and links work (hover underline from CSS)
- Page title and status badges display correctly
- If version is rejected, rejection banner displays with working button
- Tab bar still works
- All tab content loads correctly

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/version-editor.js
git commit -m "refactor(version-editor): replace breadcrumb, header, and rejection inline styles with CSS classes"
```

---

### Task 10: Refactor syllabus-editor.js — replace inline styles with CSS classes

**Files:**
- Modify: `public/js/pages/syllabus-editor.js`

- [ ] **Step 1: Replace breadcrumb navigation (lines 69-76)**

Change:
```js
        <nav style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:12px;flex-wrap:wrap;">
          ${s.author_id === window.App.currentUser?.id
            ? `<a href="#" onclick="event.preventDefault();window.App.navigate('my-assignments')" style="color:var(--text-muted);text-decoration:none;cursor:pointer;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">Đề cương của tôi</a>`
            : `<a href="#" onclick="event.preventDefault();window.App.navigate('approval')" style="color:var(--text-muted);text-decoration:none;cursor:pointer;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">Phê duyệt</a>`
          }
          <span style="color:var(--text-muted);">›</span>
          <span style="color:var(--text);font-weight:600;">${s.course_code} — ${s.course_name}</span>
        </nav>
```
to:
```js
        <nav class="breadcrumb-nav mb-3">
          ${s.author_id === window.App.currentUser?.id
            ? `<a href="#" onclick="event.preventDefault();window.App.navigate('my-assignments')" class="breadcrumb-link">Đề cương của tôi</a>`
            : `<a href="#" onclick="event.preventDefault();window.App.navigate('approval')" class="breadcrumb-link">Phê duyệt</a>`
          }
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">${s.course_code} — ${s.course_name}</span>
        </nav>
```

- [ ] **Step 2: Replace page header (lines 68, 77-89)**

Change outer container:
```js
      <div style="margin-bottom:24px;">
```
to:
```js
      <div class="page-header">
```

Change title/status:
```js
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.3px;">${s.course_name}</h1>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
              <span class="badge badge-info">${statusLabels[s.status] || s.status}</span>
              <span style="color:var(--text-muted);font-size:12px;">${s.credits} TC · ${s.author_name || '?'}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
```
to:
```js
        <div class="flex-between">
          <div>
            <h1 class="page-title" style="font-size:22px;">${s.course_name}</h1>
            <div class="page-header-meta">
              <span class="badge badge-info">${statusLabels[s.status] || s.status}</span>
              <span class="text-muted-sm">${s.credits} TC · ${s.author_name || '?'}</span>
            </div>
          </div>
          <div class="page-header-actions">
```

- [ ] **Step 3: Replace rejection banner (lines 92-99)**

Change:
```js
        <div style="background:rgba(227, 179, 65, 0.12);border:1px solid #e3a008;border-radius:var(--radius-lg);padding:16px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="badge badge-warning" style="padding:4px 8px;font-weight:600;">Bị từ chối</span>
            <div style="font-size:13px;color:#92600a;font-weight:500;">Yêu cầu chỉnh sửa từ người phê duyệt</div>
          </div>
          <button class="btn btn-sm" style="background:#e3a008;color:#fff;border:none;" onclick="window.SyllabusEditorPage.toggleRejectionReason()">Lý do từ chối</button>
        </div>
```
to:
```js
        <div class="rejection-banner">
          <div class="rejection-banner-content">
            <span class="badge badge-warning" style="padding:4px 8px;font-weight:600;">Bị từ chối</span>
            <div class="rejection-banner-label">Yêu cầu chỉnh sửa từ người phê duyệt</div>
          </div>
          <button class="btn btn-sm btn-warning" onclick="window.SyllabusEditorPage.toggleRejectionReason()">Lý do từ chối</button>
        </div>
```

- [ ] **Step 4: Replace rejection panel**

Find the rejection panel div (line ~99-100 area) and change from inline styles to class:
```js
        <div id="syl-rejection-panel" style="display:none;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px;">
```
to:
```js
        <div id="syl-rejection-panel" class="rejection-panel">
```

- [ ] **Step 5: Verify syllabus editor renders correctly**

Navigate to a syllabus (via Approval or My Assignments). Check:
- Breadcrumb displays correctly with hover underline from CSS
- Page title and status badge display correctly
- If rejected, banner and reason panel work
- All tabs and forms still function

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor(syllabus-editor): replace breadcrumb, header, and rejection inline styles with CSS classes"
```

---

### Task 11: Final visual verification

- [ ] **Step 1: Full walkthrough**

Open the app and test all 4 refactored pages:

1. **Dashboard** — Login, check metrics grid, status lists, activity feed
2. **Programs** — View program tree, expand khoa/nganh groups, hover over items, click into versions
3. **Version Editor** — Open a version, check breadcrumb, page header, tab switching, rejection banner (if applicable)
4. **Syllabus Editor** — Open a syllabus, check breadcrumb, page header, rejection banner (if applicable)

For each page verify:
- No visual regressions (layout, colors, spacing look the same or better)
- All interactive elements work (buttons, links, modals, forms)
- Hover effects work via CSS (no more inline `onmouseenter`/`onmouseleave`)

- [ ] **Step 2: Commit any final fixes if needed**

```bash
git add -A
git commit -m "fix: address visual regressions from UI refactor phase 1"
```

(Only if fixes were needed.)
