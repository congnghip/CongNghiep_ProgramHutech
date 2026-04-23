# Base Syllabus Fix — Align with Standard Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix base syllabus editor, render model, PDF, and DOCX to match the standard template file `[COS1003] De cuong chi tiet HP BA - Đề cương chuẩn.docx`.

**Architecture:** Changes are distributed across: (1) `db.js` — no schema change needed (JSON content field covers new data); (2) `server/render/content-upgrade.js` — upgrade logic for backward-compat; (3) `server/render/render-model.js` — pass new fields in model; (4) `server/render/pdf-template.ejs` — render new fields; (5) `server/render/docx-builder.js` — render new fields; (6) `public/js/pages/base-syllabus-editor.js` — UI for new fields; (7) `server.js` validate endpoint — extended checks.

**Tech Stack:** Node.js/Express, PostgreSQL, EJS, docx library, vanilla JS frontend.

**Scope exclusions (do NOT touch):** mục 9 (PLO matrix), mục 10 CLO PI/PLO map columns, canonical_version_id, base_clo_plo_map / base_clo_pi_map, UI chọn CTĐT chuẩn.

---

## File Map

- Modify: `server/render/content-upgrade.js` — add upgrade for prerequisites_concurrent, instructor, assistant_instructor, contact_info, signature_date, self_study_topics
- Modify: `server/render/render-model.js` — expose new fields to model; fix self_study to include topics
- Modify: `server/render/pdf-template.ejs` — Gap 1 (mục 3), Gap 2 (mục 6), Gap 3 (mục 16 topics), Gap 4 (instructor block after mục 17)
- Modify: `server/render/docx-builder.js` — same as pdf-template gaps
- Modify: `public/js/pages/base-syllabus-editor.js` — Gap 1 (knowledge_area select), Gap 2 (prereq_concurrent field), Gap 4 (instructor tab or section in tab 4)
- Modify: `server.js` — validate endpoint: add checks for new fields

---

### Task 1: content-upgrade.js — Add backward-compat upgrade for new fields

**Files:**
- Modify: `server/render/content-upgrade.js`

New fields to ensure exist after upgrade:
- `prerequisites_concurrent` (string, default `''`)
- `instructor` (object: `{ name, title, address, phone, email, website }`)
- `assistant_instructor` (object: same shape, all `''`)
- `contact_info` (string, default `''`)
- `signature_date` (string, default `''`)

Self-study topics: already stored per-outline-lesson as `topics`, no new field needed.

- [ ] **Step 1: Read current content-upgrade.js**

```bash
cat server/render/content-upgrade.js
```

- [ ] **Step 2: Add upgrade logic for new fields at end of upgradeContent(), before `c._schema_version = 3; return c;`**

In `server/render/content-upgrade.js`, find the block near the end that sets `_schema_version`. Add these lines just before that assignment:

```js
  // v3 → v4: prerequisites_concurrent, instructor, assistant_instructor, contact_info, signature_date
  if (!c.prerequisites_concurrent) c.prerequisites_concurrent = '';
  if (!c.instructor || typeof c.instructor !== 'object') {
    c.instructor = { name: '', title: '', address: '', phone: '', email: '', website: '' };
  } else {
    c.instructor = {
      name: c.instructor.name || '',
      title: c.instructor.title || '',
      address: c.instructor.address || '',
      phone: c.instructor.phone || '',
      email: c.instructor.email || '',
      website: c.instructor.website || '',
    };
  }
  if (!c.assistant_instructor || typeof c.assistant_instructor !== 'object') {
    c.assistant_instructor = { name: '', title: '', address: '', phone: '', email: '', website: '' };
  } else {
    c.assistant_instructor = {
      name: c.assistant_instructor.name || '',
      title: c.assistant_instructor.title || '',
      address: c.assistant_instructor.address || '',
      phone: c.assistant_instructor.phone || '',
      email: c.assistant_instructor.email || '',
      website: c.assistant_instructor.website || '',
    };
  }
  if (!c.contact_info) c.contact_info = '';
  if (!c.signature_date) c.signature_date = '';
```

- [ ] **Step 3: Update schema version to 4 (or use >= check so old data still upgrades)**

Change the version stamp at the end of `upgradeContent()`:
```js
  c._schema_version = 4;
  return c;
```
And update the guard at top from `if (c._schema_version >= 3) return c;` to `if (c._schema_version >= 4) return c;`.

- [ ] **Step 4: Verify syntax**
```bash
node --check server/render/content-upgrade.js
```
Expected: no output (clean)

- [ ] **Step 5: Commit**
```bash
git add server/render/content-upgrade.js
git commit -m "feat: upgrade base syllabus content to v4 (instructor, prerequisites_concurrent)"
```

---

### Task 2: render-model.js — Expose new fields + fix self_study topics

**Files:**
- Modify: `server/render/render-model.js`

- [ ] **Step 1: Fix self_study to include per-lesson topics**

In `buildRenderModel()`, find:
```js
  const self_study = outline.map(l => ({
    lesson: l.lesson, title: l.title,
    hours: l.self_study_hours || 0,
    tasks: Array.isArray(l.self_study_tasks) ? l.self_study_tasks : [],
  }));
```
Replace with:
```js
  const self_study = outline.map(l => ({
    lesson: l.lesson, title: l.title,
    hours: l.self_study_hours || 0,
    tasks: Array.isArray(l.self_study_tasks) ? l.self_study_tasks : [],
    topics: Array.isArray(l.topics) ? l.topics : [],
  }));
```

- [ ] **Step 2: Add new top-level fields to the returned model**

In `buildRenderModel()`, find the return statement. In the `course` object, add:
```js
      prerequisites_concurrent: content.prerequisites_concurrent || '',
```
(right after `prerequisites: content.prerequisites || '',`)

And add to the top-level return (after `other_requirements`):
```js
    instructor: content.instructor || { name:'', title:'', address:'', phone:'', email:'', website:'' },
    assistant_instructor: content.assistant_instructor || { name:'', title:'', address:'', phone:'', email:'', website:'' },
    contact_info: content.contact_info || '',
    signature_date: content.signature_date || '',
```

Also update `signatures` to use `signature_date`:
```js
    signatures: { date: content.signature_date || '', khoa_vien: '', nganh: '', nguoi_bien_soan: '' },
```

- [ ] **Step 3: Verify**
```bash
node --check server/render/render-model.js
```

- [ ] **Step 4: Commit**
```bash
git add server/render/render-model.js
git commit -m "feat: render-model exposes instructor, prerequisites_concurrent, self_study topics"
```

---

### Task 3: pdf-template.ejs — Fix mục 3, 6, 16, add instructor block

**Files:**
- Modify: `server/render/pdf-template.ejs`

- [ ] **Step 1: Fix mục 3 — Add "Kiến thức không tích luỹ" checkbox**

Find the mục 3 table block:
```ejs
        <table style="margin:0;">
          <tr>
            <th colspan="2">Kiến thức GD đại cương</th><th colspan="2">Kiến thức GD chuyên nghiệp</th>
          </tr>
          <tr>
            <td><%= isGeneral && isReq ? '☑' : '☐' %> Bắt buộc</td>
            <td><%= isGeneral && isElec ? '☑' : '☐' %> Tự chọn</td>
            <td><%= isProf && isReq ? '☑' : '☐' %> Bắt buộc</td>
            <td><%= isProf && isElec ? '☑' : '☐' %> Tự chọn</td>
          </tr>
        </table>
```

Replace with:
```ejs
        <% const isNonCredit = course.knowledge_area === 'non_credit'; %>
        <table style="margin:0;">
          <tr>
            <th colspan="2">Kiến thức GD đại cương</th><th colspan="2">Kiến thức GD chuyên nghiệp</th><th colspan="1">Khác</th>
          </tr>
          <tr>
            <td><%= isGeneral && isReq ? '☑' : '☐' %> Bắt buộc</td>
            <td><%= isGeneral && isElec ? '☑' : '☐' %> Tự chọn</td>
            <td><%= isProf && isReq ? '☑' : '☐' %> Bắt buộc</td>
            <td><%= isProf && isElec ? '☑' : '☐' %> Tự chọn</td>
            <td><%= isNonCredit ? '☑' : '☐' %> Kiến thức không tích luỹ</td>
          </tr>
        </table>
```

- [ ] **Step 2: Fix mục 6 — Rename label, add song hành**

Find:
```ejs
    <tr><td><span class="section-num">6.</span> Học phần học trước</td><td><%= course.prerequisites || '' %></td></tr>
```
Replace with:
```ejs
    <tr><td><span class="section-num">6.</span> Học phần học trước/ song hành</td>
      <td>
        <% if (course.prerequisites) { %>Học trước: <%= course.prerequisites %><% } %>
        <% if (course.prerequisites_concurrent) { %><% if (course.prerequisites) { %><br><% } %>Song hành: <%= course.prerequisites_concurrent %><% } %>
        <% if (!course.prerequisites && !course.prerequisites_concurrent) { %>&nbsp;<% } %>
      </td></tr>
```

- [ ] **Step 3: Fix mục 16 — Add topics sub-list in Nội dung column**

Find:
```ejs
    <tr>
      <td><strong>BÀI <%= s.lesson %>: <%= s.title %></strong></td>
      <td style="text-align:center;"><%= s.hours %></td>
      <td><% s.tasks.forEach(function(t){ %><%= t %><br><% }) %></td>
    </tr>
```
Replace with:
```ejs
    <tr>
      <td>
        <strong>Bài <%= s.lesson %>: <%= s.title %></strong>
        <% if (s.topics && s.topics.length) { %>
        <ul style="margin:2px 0;padding-left:18px;">
          <% s.topics.forEach(function(t){ %><li style="font-size:11pt;"><%= t %></li><% }) %>
        </ul>
        <% } %>
      </td>
      <td style="text-align:center;"><%= s.hours %></td>
      <td><% s.tasks.forEach(function(t){ %><%= t %><br><% }) %></td>
    </tr>
```

- [ ] **Step 4: Replace hard-coded signature block with instructor info after mục 17**

Find:
```ejs
  <div class="right-italic">TP. Hồ Chí Minh, ngày… tháng… năm <%= new Date().getFullYear() %></div>
  <div class="signatures">
    <div style="flex:1;">Trưởng khoa/viện</div>
    <div style="flex:1;">Trưởng ngành/bộ môn</div>
    <div style="flex:1;">Người biên soạn</div>
  </div>
```
Replace with:
```ejs
  <% if (instructor.name || instructor.email) { %>
  <p style="margin-top:20px;font-weight:bold;">Giảng viên phụ trách học phần</p>
  <table class="no-border" style="width:60%;">
    <tr><td style="width:200px;">Họ và tên:</td><td><%= instructor.name %></td></tr>
    <tr><td>Học hàm, học vị:</td><td><%= instructor.title %></td></tr>
    <tr><td>Địa chỉ cơ quan:</td><td><%= instructor.address %></td></tr>
    <tr><td>Điện thoại liên hệ:</td><td><%= instructor.phone %></td></tr>
    <tr><td>Email:</td><td><%= instructor.email %></td></tr>
    <tr><td>Website:</td><td><%= instructor.website %></td></tr>
  </table>
  <% } %>

  <% if (assistant_instructor.name || assistant_instructor.email) { %>
  <p style="font-weight:bold;">Giảng viên hỗ trợ học phần/trợ giảng (nếu có)</p>
  <table class="no-border" style="width:60%;">
    <tr><td style="width:200px;">Họ và tên:</td><td><%= assistant_instructor.name %></td></tr>
    <tr><td>Học hàm, học vị:</td><td><%= assistant_instructor.title %></td></tr>
    <tr><td>Địa chỉ cơ quan:</td><td><%= assistant_instructor.address %></td></tr>
    <tr><td>Điện thoại liên hệ:</td><td><%= assistant_instructor.phone %></td></tr>
    <tr><td>Email:</td><td><%= assistant_instructor.email %></td></tr>
    <tr><td>Website:</td><td><%= assistant_instructor.website %></td></tr>
  </table>
  <% } %>

  <% if (contact_info) { %>
  <p><strong>Cách liên lạc với giảng viên/trợ giảng:</strong> <%- nl2br(contact_info) %></p>
  <% } %>

  <div class="right-italic">TP. Hồ Chí Minh, ngày<%= signature_date ? ' ' + signature_date : '… tháng… năm ' + new Date().getFullYear() %></div>
  <div class="signatures">
    <div style="flex:1;">Trưởng khoa/viện</div>
    <div style="flex:1;">Trưởng ngành/bộ môn</div>
    <div style="flex:1;">Người biên soạn</div>
    <% if (instructor.name) { %><div style="flex:1;">Giảng viên phụ trách<br>(<%= instructor.name %>)</div><% } %>
  </div>
```

- [ ] **Step 5: Commit**
```bash
git add server/render/pdf-template.ejs
git commit -m "feat: pdf-template — mục 3 non_credit, mục 6 song hành, mục 16 topics, instructor block"
```

---

### Task 4: docx-builder.js — Same fixes as pdf-template

**Files:**
- Modify: `server/render/docx-builder.js`

- [ ] **Step 1: Fix mục 3 — Add non_credit checkbox**

Find:
```js
    row([tc('3. Thuộc khối kiến thức'), tc(`${chk(isGen && isReq)} GD đại cương - Bắt buộc   ${chk(isGen && isElec)} GD đại cương - Tự chọn   ${chk(isProf && isReq)} GD chuyên nghiệp - Bắt buộc   ${chk(isProf && isElec)} GD chuyên nghiệp - Tự chọn`)]),
```
Add `const isNonCredit = model.course.knowledge_area === 'non_credit';` near the top of `buildDocx()` after `const isElec`. Then replace mục 3 row with:
```js
    row([tc('3. Thuộc khối kiến thức'), tc(`${chk(isGen && isReq)} GD đại cương - Bắt buộc   ${chk(isGen && isElec)} GD đại cương - Tự chọn   ${chk(isProf && isReq)} GD chuyên nghiệp - Bắt buộc   ${chk(isProf && isElec)} GD chuyên nghiệp - Tự chọn   ${chk(isNonCredit)} Kiến thức không tích luỹ`)]),
```

- [ ] **Step 2: Fix mục 6 — Rename label, show both prereq fields**

Find:
```js
    row([tc('6. Học phần học trước'), tc(model.course.prerequisites || '')]),
```
Replace with:
```js
    row([tc('6. Học phần học trước/ song hành'), tc([
      model.course.prerequisites ? p(`Học trước: ${model.course.prerequisites}`) : null,
      model.course.prerequisites_concurrent ? p(`Song hành: ${model.course.prerequisites_concurrent}`) : null,
    ].filter(Boolean).length ? [
      model.course.prerequisites ? p(`Học trước: ${model.course.prerequisites}`) : null,
      model.course.prerequisites_concurrent ? p(`Song hành: ${model.course.prerequisites_concurrent}`) : null,
    ].filter(Boolean) : [''])]),
```

- [ ] **Step 3: Fix mục 16 — Add topics in Nội dung column**

Find:
```js
    ...model.self_study.map(s => row([tc(`BÀI ${s.lesson}: ${s.title}`), tc(String(s.hours)), tc(s.tasks.join('\n'))])),
```
Replace with:
```js
    ...model.self_study.map(s => {
      const topicParas = Array.isArray(s.topics) && s.topics.length
        ? s.topics.map(t => p(`  ${t}`, { size: 20 }))
        : [];
      return row([
        tc([p(`Bài ${s.lesson}: ${s.title}`, { bold: true }), ...topicParas]),
        tc(String(s.hours)),
        tc(s.tasks.join('\n')),
      ]);
    }),
```

- [ ] **Step 4: Replace hard-coded signature block with instructor info after mục 17**

Find:
```js
  children.push(p(`TP. Hồ Chí Minh, ngày… tháng… năm ${new Date().getFullYear()}`, { align: AlignmentType.RIGHT, italic: true, before: 400 }));
  children.push(fullWidthTable([row([
    tc(p('Trưởng khoa/viện', { bold: true, align: AlignmentType.CENTER })),
    tc(p('Trưởng ngành/bộ môn', { bold: true, align: AlignmentType.CENTER })),
    tc(p('Người biên soạn', { bold: true, align: AlignmentType.CENTER })),
  ])], { borders: NO_BORDERS }));
```
Replace with:
```js
  // Instructor block
  const instr = model.instructor || {};
  const asst = model.assistant_instructor || {};
  if (instr.name || instr.email) {
    children.push(p('Giảng viên phụ trách học phần', { bold: true, before: 200 }));
    children.push(fullWidthTable([
      row([tc('Họ và tên:', { width: 30 }), tc(instr.name || '')]),
      row([tc('Học hàm, học vị:'), tc(instr.title || '')]),
      row([tc('Địa chỉ cơ quan:'), tc(instr.address || '')]),
      row([tc('Điện thoại liên hệ:'), tc(instr.phone || '')]),
      row([tc('Email:'), tc(instr.email || '')]),
      row([tc('Website:'), tc(instr.website || '')]),
    ]));
  }
  if (asst.name || asst.email) {
    children.push(p('Giảng viên hỗ trợ học phần/trợ giảng (nếu có)', { bold: true, before: 120 }));
    children.push(fullWidthTable([
      row([tc('Họ và tên:', { width: 30 }), tc(asst.name || '')]),
      row([tc('Học hàm, học vị:'), tc(asst.title || '')]),
      row([tc('Địa chỉ cơ quan:'), tc(asst.address || '')]),
      row([tc('Điện thoại liên hệ:'), tc(asst.phone || '')]),
      row([tc('Email:'), tc(asst.email || '')]),
      row([tc('Website:'), tc(asst.website || '')]),
    ]));
  }
  if (model.contact_info) {
    children.push(p('Cách liên lạc với giảng viên/trợ giảng:', { bold: true, before: 120 }));
    children.push(p(model.contact_info));
  }

  const sigDate = model.signature_date
    ? `TP. Hồ Chí Minh, ngày ${model.signature_date}`
    : `TP. Hồ Chí Minh, ngày… tháng… năm ${new Date().getFullYear()}`;
  children.push(p(sigDate, { align: AlignmentType.RIGHT, italic: true, before: 400 }));
  const sigCells = [
    tc(p('Trưởng khoa/viện', { bold: true, align: AlignmentType.CENTER })),
    tc(p('Trưởng ngành/bộ môn', { bold: true, align: AlignmentType.CENTER })),
    tc(p('Người biên soạn', { bold: true, align: AlignmentType.CENTER })),
  ];
  if (instr.name) sigCells.push(tc(p(`Giảng viên phụ trách\n(${instr.name})`, { bold: true, align: AlignmentType.CENTER })));
  children.push(fullWidthTable([row(sigCells)], { borders: NO_BORDERS }));
```

- [ ] **Step 5: Verify**
```bash
node --check server/render/docx-builder.js
```

- [ ] **Step 6: Commit**
```bash
git add server/render/docx-builder.js
git commit -m "feat: docx-builder — mục 3 non_credit, mục 6 song hành, mục 16 topics, instructor block"
```

---

### Task 5: base-syllabus-editor.js — UI fixes

**Files:**
- Modify: `public/js/pages/base-syllabus-editor.js`

- [ ] **Step 1: Tab 0 — Add `non_credit` option to knowledge_area select + add prerequisites_concurrent field**

In `renderGeneralTab()`, find the knowledge_area select:
```js
            <select id="bs-knowledge-area" ${dis}>
              <option value="">-- Chọn --</option>
              <option value="general" ${co.knowledge_area==='general'?'selected':''}>GD đại cương</option>
              <option value="professional" ${co.knowledge_area==='professional'?'selected':''}>GD chuyên nghiệp</option>
            </select>
```
Replace with:
```js
            <select id="bs-knowledge-area" ${dis}>
              <option value="">-- Chọn --</option>
              <option value="general" ${co.knowledge_area==='general'?'selected':''}>GD đại cương</option>
              <option value="professional" ${co.knowledge_area==='professional'?'selected':''}>GD chuyên nghiệp</option>
              <option value="non_credit" ${co.knowledge_area==='non_credit'?'selected':''}>Kiến thức không tích luỹ</option>
            </select>
```

Find the prerequisites field row:
```js
        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;"><label>Học phần tiên quyết (mục 6)</label><input type="text" id="bs-prereq" ${dis} value="${esc(c.prerequisites)}"></div>
          <div class="input-group" style="flex:1;"><label>Ngôn ngữ giảng dạy</label><input type="text" id="bs-lang-inst" ${dis} value="${esc(c.language_instruction)}"></div>
        </div>
```
Replace with:
```js
        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;"><label>Học phần học trước (mục 6)</label><input type="text" id="bs-prereq" ${dis} value="${esc(c.prerequisites)}" placeholder="Tên học phần tiên quyết"></div>
          <div class="input-group" style="flex:1;"><label>Học phần song hành (mục 6)</label><input type="text" id="bs-prereq-concurrent" ${dis} value="${esc(c.prerequisites_concurrent)}" placeholder="Tên học phần song hành (nếu có)"></div>
        </div>
        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;"><label>Ngôn ngữ giảng dạy</label><input type="text" id="bs-lang-inst" ${dis} value="${esc(c.language_instruction)}"></div>
        </div>
```

- [ ] **Step 2: Update _collectGeneral() to save prerequisites_concurrent**

In `_collectGeneral()`, find:
```js
      prerequisites: document.getElementById('bs-prereq').value,
```
Replace with:
```js
      prerequisites: document.getElementById('bs-prereq').value,
      prerequisites_concurrent: document.getElementById('bs-prereq-concurrent')?.value || '',
```

- [ ] **Step 3: Tab 4 (Resources) — Add instructor section**

In `renderResourcesTab()`, at the end of the body.innerHTML template, find:
```js
        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Các yêu cầu của HP (mục 17)</h4>
        <div class="input-group">
          <textarea id="bs-other-req" ${dis} rows="3" placeholder="Yêu cầu khác (nếu có)">${esc(c.other_requirements)}</textarea>
        </div>
      </div>
```
Replace with (add instructor section after other_requirements):
```js
        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Các yêu cầu của HP (mục 17)</h4>
        <div class="input-group">
          <textarea id="bs-other-req" ${dis} rows="3" placeholder="Yêu cầu khác (nếu có)">${esc(c.other_requirements)}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Giảng viên phụ trách học phần</h4>
        ${this._instructorFormHtml('instr', c.instructor || {}, editable, dis)}

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Giảng viên hỗ trợ / Trợ giảng (nếu có)</h4>
        ${this._instructorFormHtml('asst', c.assistant_instructor || {}, editable, dis)}

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Cách liên lạc với giảng viên/trợ giảng</h4>
        <div class="input-group">
          <textarea id="bs-contact-info" ${dis} rows="2" placeholder="Ví dụ: Email, giờ tiếp sinh viên...">${esc(c.contact_info)}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Ngày ký</h4>
        <div class="input-group" style="max-width:300px;">
          <input type="text" id="bs-signature-date" ${dis} placeholder="VD: 01 tháng 09 năm 2025" value="${esc(c.signature_date)}">
        </div>
      </div>
```

- [ ] **Step 4: Add _instructorFormHtml() helper method**

Add this method to the `BaseSyllabusEditorPage` object (before `addToolCategory`):
```js
  _instructorFormHtml(prefix, data, editable, dis) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Họ và tên</label><input type="text" id="bs-${prefix}-name" ${dis} value="${esc(data.name)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Học hàm, học vị</label><input type="text" id="bs-${prefix}-title" ${dis} value="${esc(data.title)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Địa chỉ cơ quan</label><input type="text" id="bs-${prefix}-address" ${dis} value="${esc(data.address)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Điện thoại liên hệ</label><input type="text" id="bs-${prefix}-phone" ${dis} value="${esc(data.phone)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Email</label><input type="text" id="bs-${prefix}-email" ${dis} value="${esc(data.email)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Website</label><input type="text" id="bs-${prefix}-website" ${dis} value="${esc(data.website)}"></div>
    </div>`;
  },
```

- [ ] **Step 5: Update _collectResources() to save new fields**

In `_collectResources()`, after `other_requirements: ...`, add:
```js
      instructor: {
        name: document.getElementById('bs-instr-name')?.value || '',
        title: document.getElementById('bs-instr-title')?.value || '',
        address: document.getElementById('bs-instr-address')?.value || '',
        phone: document.getElementById('bs-instr-phone')?.value || '',
        email: document.getElementById('bs-instr-email')?.value || '',
        website: document.getElementById('bs-instr-website')?.value || '',
      },
      assistant_instructor: {
        name: document.getElementById('bs-asst-name')?.value || '',
        title: document.getElementById('bs-asst-title')?.value || '',
        address: document.getElementById('bs-asst-address')?.value || '',
        phone: document.getElementById('bs-asst-phone')?.value || '',
        email: document.getElementById('bs-asst-email')?.value || '',
        website: document.getElementById('bs-asst-website')?.value || '',
      },
      contact_info: document.getElementById('bs-contact-info')?.value || '',
      signature_date: document.getElementById('bs-signature-date')?.value || '',
```

- [ ] **Step 6: Verify syntax**
```bash
node --check public/js/pages/base-syllabus-editor.js
```

- [ ] **Step 7: Commit**
```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "feat: base-syllabus UI — non_credit, song hành, instructor block, signature date"
```

---

### Task 6: server.js — Extended validation

**Files:**
- Modify: `server.js` at the validate endpoint (~line 1461)

- [ ] **Step 1: Add validation for instructor name**

In the validate endpoint, after the assessments weight check, add:
```js
    if (!content.instructor || !content.instructor.name) {
      issues.push({ code: 'NO_INSTRUCTOR_NAME', message: 'Chưa nhập tên giảng viên phụ trách' });
    }
    if (!content.instructor || !content.instructor.email) {
      issues.push({ code: 'NO_INSTRUCTOR_EMAIL', message: 'Chưa nhập email giảng viên phụ trách' });
    }
```

- [ ] **Step 2: Verify**
```bash
node --check server.js
```

- [ ] **Step 3: Commit**
```bash
git add server.js
git commit -m "feat: validate — check instructor name and email"
```

---

### Task 7: Final smoke test

- [ ] **Step 1: Check all files**
```bash
node --check server.js && node --check db.js && node --check public/js/pages/base-syllabus-editor.js && node --check server/render/render-model.js && node --check server/render/docx-builder.js && node --check server/render/content-upgrade.js && echo "ALL OK"
```
Expected: `ALL OK`

- [ ] **Step 2: Verify backward compatibility — upgradeContent with empty object**
```bash
node -e "
const { upgradeContent } = require('./server/render/content-upgrade');
const r = upgradeContent({});
console.assert(r.instructor && r.instructor.name === '', 'instructor default');
console.assert(r.prerequisites_concurrent === '', 'prereq_concurrent default');
console.assert(r.contact_info === '', 'contact_info default');
console.assert(r._schema_version === 4, 'schema version 4');
console.log('backward compat OK');
"
```

- [ ] **Step 3: Verify upgradeContent with v3 data doesn't break**
```bash
node -e "
const { upgradeContent } = require('./server/render/content-upgrade');
const v3data = {
  _schema_version: 3,
  prerequisites: 'MON001',
  course_outline: [{ lesson:1, title:'Test', lt_hours:3, th_hours:0, topics:['1.1 Intro'], teaching_methods:'Lecture', clo_codes:['CLO1'], self_study_hours:5, self_study_tasks:['Read chapter 1'] }],
  assessment_methods: [{ component:'Quá trình', description:'Bài tập', task_ref:'', weight:30, clo_codes:['CLO1'] }],
};
const r = upgradeContent(v3data);
console.assert(r.instructor !== undefined, 'instructor added');
console.assert(r.prerequisites === 'MON001', 'prerequisites preserved');
console.assert(r.course_outline[0].topics[0] === '1.1 Intro', 'topics preserved');
console.log('v3 upgrade OK');
"
```

- [ ] **Step 4: Final commit if any remaining uncommitted changes**
```bash
git status
```
