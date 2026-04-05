# Notion-like UI Refactor — Design Spec

## Goal

Refactor the HUTECH CTDT frontend UI to achieve a Notion-like aesthetic: minimal, clean, content-focused. The CSS foundation is already partially Notion-inspired — this refactor completes the vision by standardizing styles, eliminating hardcoded inline values, and adding missing component classes.

## Scope

**Two phases:**

- **Phase 1:** CSS foundation (`styles.css`) + 4 core pages (dashboard, programs, version-editor, syllabus-editor)
- **Phase 2:** Remaining 9 pages (approval, audit-logs, courses, users, departments, rbac-admin, my-assignments, course-flowchart, import-word)

**Out of scope:** dark mode, responsive/mobile layout, new animations, layout structure changes, changes to HTML shell (`index.html`), changes to `app.js` navigation logic.

## Architecture

Single CSS file approach — extend the existing `public/css/styles.css` with new variables, utility classes, and component classes. No new CSS files. No CSS-in-JS. No framework additions.

## Design Decisions

| Component | Decision |
|-----------|----------|
| Sidebar | Fine-tune only — keep existing structure, synchronize hover transitions |
| Tables | Borderless rows — ultra-light dividers (opacity 0.05), no outer border |
| Dashboard cards | Flat cards — subtle border, no shadow |
| Buttons | Notion-native — rgba outline borders, warning orange #d9730d, border-radius 6px |
| Inline styles | Replace with CSS utility classes in JS files |
| Code organization | Single `styles.css` file, extended with new sections |

## Phase 1: CSS Foundation

### 1.1 New CSS Variables (add to `:root`)

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

/* Warning color additions */
--warning-hover: #c76b0a;

/* Table row divider (lighter than --divider) */
--row-divider: rgba(55, 53, 47, 0.05);
```

### 1.2 New Button Variants

Add these classes to `styles.css` (currently missing — JS uses hardcoded inline styles):

- **`.btn-outline-primary`** — `border: 1px solid var(--outline-border)`, `color: var(--primary)`, `background: var(--bg)`. Hover: `background: var(--primary-bg)`.
- **`.btn-outline-secondary`** — `border: 1px solid var(--outline-border)`, `color: var(--text)`, `background: var(--bg)`. Hover: `background: var(--bg-hover)`.
- **`.btn-warning`** — `background: var(--warning)` (#d9730d), `color: #fff`, `border: none`. Hover: `background: var(--warning-hover)`.
- **`.btn-ghost`** — `border: none`, `background: transparent`, `color: var(--text)`. Hover: `background: var(--bg-hover)`.

### 1.3 Table Adjustments

- Change `td` border-bottom from `var(--divider)` to `var(--row-divider)` for lighter row separation.

### 1.4 Sidebar Fine-tuning

- Ensure all hover transitions are consistently `0.15s ease`.
- No structural changes.

### 1.5 Typography Classes (new)

```css
.page-title     /* font-size: 24px; font-weight: 700; letter-spacing: -0.3px; color: var(--text) */
.section-title  /* font-size: 15px; font-weight: 600; color: var(--text) */
.label-upper    /* font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted) */
```

### 1.6 Layout Utility Classes (new)

```css
.flex-row       /* display: flex; align-items: center; gap: var(--space-2) */
.flex-between   /* display: flex; justify-content: space-between; align-items: center */
.grid-2col      /* display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3) */
.grid-3col      /* display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3) */
```

### 1.7 Component Classes (new)

```css
.stat-card      /* border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4) */
.stat-value     /* font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: var(--text) */
.stat-label     /* font-size: 11px; font-weight: 500; color: var(--text-muted) */
.breadcrumb     /* color: var(--text-muted); text-decoration: none; cursor: pointer; :hover text-decoration: underline */
.divider        /* height: 1px; background: var(--divider); margin: var(--space-4) 0 */
.required-mark  /* color: var(--danger); margin-left: 2px */
.role-chip      /* display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--bg-secondary); border-radius: var(--radius); font-size: 12px */
.role-item-active /* background: rgba(35, 131, 226, 0.08); border: 1px solid rgba(35, 131, 226, 0.25) — for rbac-admin active selection */
```

### 1.8 Spacing Utilities (extend existing)

```css
.mt-2  /* margin-top: var(--space-2) */
.mt-3  /* margin-top: var(--space-3) */
.mt-6  /* margin-top: var(--space-6) */
.mt-8  /* margin-top: var(--space-8) */
.mb-2  /* margin-bottom: var(--space-2) */
.mb-3  /* margin-bottom: var(--space-3) */
.mb-6  /* margin-bottom: var(--space-6) */
.mb-8  /* margin-bottom: var(--space-8) */
.p-4   /* padding: var(--space-4) */
.p-6   /* padding: var(--space-6) */
.gap-3 /* gap: var(--space-3) */
```

## Phase 1: JS Refactor (4 Core Pages)

### dashboard.js

- Replace inline `style="font-size:24px;font-weight:700;..."` with class `page-title`
- Replace inline grid layouts with `.grid-2col`, `.grid-3col`
- Replace inline stat card styles with `.stat-card`, `.stat-value`, `.stat-label`
- Replace inline `color:var(--text-muted)` with existing `.text-muted`

### programs.js

- Replace hardcoded button colors (`#2563eb`, `#ea580c`, `#e3a008`) with `.btn-outline-primary`, `.btn-outline-secondary`, `.btn-warning`
- Replace inline `onmouseenter/onmouseleave` hover handlers with CSS `:hover` on existing or new classes
- Replace inline flex layouts with `.flex-row`, `.flex-between`

### version-editor.js

- Replace breadcrumb inline styles with `.breadcrumb` class
- Replace page title inline with `.page-title`
- Replace inline `color:var(--danger)` for required marks with `.required-mark`
- Replace inline table cell styles with existing `data-table` classes
- Keep `style.display` toggling for show/hide logic (this is behavior, not styling)

### syllabus-editor.js

- Same patterns as version-editor: `.breadcrumb`, `.page-title`, `.required-mark`
- Replace inline warning button styles with `.btn-warning`
- Replace inline hover/underline handlers on breadcrumbs with CSS `:hover` in `.breadcrumb`

### Principles for JS Changes

- **Only replace style attributes, never change IDs or classes used by JS logic**
- **Keep `style.display` toggling** — this is show/hide behavior, not styling
- **Keep dynamic positioning** (e.g., flowchart node coordinates) — these depend on runtime values
- **Keep inline event handlers that are purely behavioral** (onclick for navigation, etc.)

## Phase 2: Remaining Pages

Apply the same patterns established in Phase 1. Page-specific notes:

| Page | Key Changes |
|------|-------------|
| approval.js | `.page-title`, `.flex-between`, table hover via CSS |
| audit-logs.js | `.page-title`, `.flex-between`, pagination styling |
| courses.js | Form grid layout with `.grid-2col`, `.required-mark` |
| users.js | `.required-mark`, new `.role-chip` class for role badges |
| departments.js | `.required-mark`, keep dynamic indent inline (runtime value) |
| rbac-admin.js | New `.role-item-active` class for active state (replacing inline bg/border) |
| my-assignments.js | Table hover via CSS, remove inline `onmouseenter/onmouseleave` |
| course-flowchart.js | Keep dynamic positioning. Only toolbar buttons get classes |
| import-word.js | Keep drag-drop JS state styles. Standardize colors to CSS variables |

## Constraints

- No changes to `server.js`, `db.js`, or any backend code
- No changes to `public/index.html` structure (only CSS link is already there)
- No changes to `public/js/app.js` navigation/routing logic
- No new npm dependencies
- All changes must be CSS-only in `styles.css` + inline style replacements in JS page modules
- Must not break any existing JavaScript functionality
