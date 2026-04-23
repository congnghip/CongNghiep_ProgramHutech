# CTDT Syllabus Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `SyllabusEditorPage` from 4 tabs to 6 tabs so its layout mirrors `BaseSyllabusEditorPage`, with mục 3/9/10 editable and all other content read-only.

**Architecture:** Single file change — `public/js/pages/syllabus-editor.js`. Tab indices shift: new tab 1=CLO (was 2), new tab 2=PLO/PI (was 1), new tabs 3/4/5=read-only views using existing `renderOutlineTab`/`renderGradingTab`/`renderResourcesTab` with `editable=false`. Old `renderSections11To17` method removed.

**Tech Stack:** Vanilla JS, browser SPA, no build step.

---

### Task 1: Update tab bar HTML (4 tabs → 6 tabs)

**Files:**
- Modify: `public/js/pages/syllabus-editor.js:171-176`

- [ ] **Step 1: Replace the 4-tab bar with 6-tab bar**

Find (lines 171–176):
```html
      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Mục 1–8</div>
        <div class="tab-item" data-tab="1">Mục 9</div>
        <div class="tab-item" data-tab="2">Mục 10</div>
        <div class="tab-item" data-tab="3">Mục 11–17</div>
      </div>
```

Replace with:
```html
      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">CLO</div>
        <div class="tab-item" data-tab="2">Ma trận PLO/PI</div>
        <div class="tab-item" data-tab="3">Nội dung giảng dạy</div>
        <div class="tab-item" data-tab="4">Đánh giá</div>
        <div class="tab-item" data-tab="5">Tài liệu</div>
      </div>
```

- [ ] **Step 2: Syntax-check the file**

```bash
node --check public/js/pages/syllabus-editor.js
```
Expected: no output (clean parse).

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: expand CTDT syllabus editor to 6 tabs (tab bar only)"
```

---

### Task 2: Update `renderSylTab()` switch

**Files:**
- Modify: `public/js/pages/syllabus-editor.js:242-248`

Current switch (lines 242–247):
```js
      switch (this.activeTab) {
        case 0: await this.renderSections1To8(body, editable); break;
        case 1: await this.renderSection9(body, editable); break;
        case 2: await this.renderSection10(body, editable); break;
        case 3: this.renderSections11To17(body); break;
      }
```

- [ ] **Step 1: Replace the switch body**

Replace those 6 lines with:
```js
      switch (this.activeTab) {
        case 0: await this.renderSections1To8(body, editable); break;
        case 1: await this.renderSection10(body, editable); break;
        case 2: await this.renderSection9(body, editable); break;
        case 3: this.renderOutlineTab(body, false, c); break;
        case 4: this.renderGradingTab(body, false, c); break;
        case 5: this.renderResourcesTab(body, false, c); break;
      }
```

- [ ] **Step 2: Syntax-check**

```bash
node --check public/js/pages/syllabus-editor.js
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: wire new tab indices in renderSylTab switch"
```

---

### Task 3: Update `_collectCurrentTabIntoState()`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js:526-532`

Current (lines 527–531):
```js
    switch (this.activeTab) {
      case 0: this.collectSection3(); break;
      case 1: this.collectSection9?.(); break;
      case 2: this._collectCloPiMap(); break;
    }
```

- [ ] **Step 1: Update tab index mappings**

Replace those 4 lines with:
```js
    switch (this.activeTab) {
      case 0: this.collectSection3(); break;
      case 1: this._collectCloPiMap(); break;
      case 2: this.collectSection9?.(); break;
      // cases 3–5 are read-only; nothing to collect
    }
```

- [ ] **Step 2: Syntax-check**

```bash
node --check public/js/pages/syllabus-editor.js
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: update _collectCurrentTabIntoState for new tab indices"
```

---

### Task 4: Update header save button label

**Files:**
- Modify: `public/js/pages/syllabus-editor.js:148`

Current (line 148):
```js
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveAll()">Lưu mục 3, 9, 10</button>' : ''}
```

- [ ] **Step 1: Change label text**

Replace the line above with:
```js
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveAll()">Lưu</button>' : ''}
```

- [ ] **Step 2: Syntax-check**

```bash
node --check public/js/pages/syllabus-editor.js
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "chore: rename save button label from 'Lưu mục 3, 9, 10' to 'Lưu'"
```

---

### Task 5: Remove `renderSections11To17()`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js`

- [ ] **Step 1: Locate the method**

```bash
grep -n "renderSections11To17" public/js/pages/syllabus-editor.js
```
Expected: two hits — the call in `renderSylTab` (now removed in Task 2) and the method definition.

- [ ] **Step 2: Delete the method body**

Find the method (approximately lines 441–496 based on prior reading):
```js
  renderSections11To17(body) {
    // ...entire method body...
  },
```

Delete the entire method from its opening line to its closing `},` (inclusive). The method is no longer referenced after Task 2.

- [ ] **Step 3: Syntax-check**

```bash
node --check public/js/pages/syllabus-editor.js
```
Expected: clean.

- [ ] **Step 4: Confirm no remaining references**

```bash
grep -n "renderSections11To17" public/js/pages/syllabus-editor.js
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor: remove renderSections11To17, replaced by read-only tab methods"
```
