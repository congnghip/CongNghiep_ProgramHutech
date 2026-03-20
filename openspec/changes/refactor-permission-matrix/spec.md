# Specification: Refactor Permission Matrix UI

## Frontend Changes

### 1. `public/js/pages/rbac-admin.js`

#### Header Rendering
- Remove `writing-mode: vertical-lr`.
- Use `text-align: center`, `vertical-align: bottom`.
- Set `min-width: 100px` for role columns to accommodate horizontal text.
- Wrap long role names using `white-space: normal`.

#### Permission Rows
- Use `p.description` as the main label.
- If `p.description` is missing, fallback to `p.code`.
- Add a custom data attribute `data-module` to rows for CSS targeting.

#### Module Grouping
- Define a mapping of module IDs to color classes.
- Apply these classes to the group header rows and the subsequent permission rows.

### 2. `public/css/styles.css`

#### Column/Row Highlights
```css
.perm-matrix-table tr:hover {
  background-color: var(--bg-hover) !important;
}

/* Optional: Column highlight via JS hover detection if needed */
```

#### Module Tinting
```css
.mod-programs { background-color: rgba(35, 131, 226, 0.05); }
.mod-plo { background-color: rgba(15, 123, 108, 0.05); }
.mod-syllabus { background-color: rgba(217, 115, 13, 0.05); }
/* etc */
```

## Backend Changes
- None required (the API already provides `description` and `module`).
