# Rename "Phiên Bản" → "Khóa" + Single-Year `academic_year` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi UI label "phiên bản" → "Khóa" và format `academic_year` từ "YYYY-YYYY" sang "YYYY", giữ nguyên schema/URL/biến code.

**Architecture:** Three independent edits — DB migration trong `initDB()`, validation regex client, find/replace UI labels theo mapping table. Không đụng schema, URL routes, JS object/method names, hay file/route names.

**Tech Stack:** Node.js + Express + PostgreSQL 15, vanilla JS frontend. Không test framework, không linter.

**Spec:** [docs/superpowers/specs/2026-04-15-rename-phien-ban-to-khoa-design.md](../specs/2026-04-15-rename-phien-ban-to-khoa-design.md)

---

## File Structure

**Modify (5 files):**
- `db.js` — thêm 1 câu UPDATE idempotent vào cuối `initDB()` schema block.
- `public/js/pages/programs.js` — đổi 18 chỗ label + sửa logic validation năm (regex + bỏ check 2-năm-liên-tiếp + đổi error messages + đổi placeholder).
- `public/js/pages/version-editor.js` — đổi 2 chỗ label.
- `public/js/pages/import-word.js` — đổi 5 chỗ label.
- `public/js/pages/dashboard.js` — đổi 2 chỗ label.
- `public/js/pages/audit-logs.js` — đổi 2 chỗ label.

3 task chính:
- **Task 1**: DB migration (db.js).
- **Task 2**: Validation logic + label trong programs.js (file lớn nhất, gom chung vì label change đan xen với validation).
- **Task 3**: Label-only changes ở 4 file còn lại (version-editor, import-word, dashboard, audit-logs).

---

## Task 1: Migration trong `initDB()`

**Files:**
- Modify: `db.js` — chèn câu UPDATE idempotent ngay sau `console.log('  ✅ Database schema initialized');` (line 355) và trước `await seedData(client);` (line 356).

- [ ] **Step 1: Chèn migration**

Mở `db.js`, tìm đoạn (line 353-356):

```js
    `);

    console.log('  ✅ Database schema initialized');
    await seedData(client);
```

Sửa thành:

```js
    `);

    // Migration: chuẩn hoá academic_year từ "YYYY-YYYY" sang "YYYY" (lấy 4 chữ số đầu).
    // Idempotent: row đã đúng định dạng hoặc format lạ không match regex sẽ skip.
    await client.query(`
      UPDATE program_versions
         SET academic_year = SUBSTRING(academic_year FROM 1 FOR 4)
       WHERE academic_year ~ '^\\d{4}-\\d{4}$'
    `);

    console.log('  ✅ Database schema initialized');
    await seedData(client);
```

Quan trọng:
- Backslash trong template literal phải escape đôi (`\\d{4}` để Postgres nhận `\d{4}`).
- Dùng `client.query` (không phải `pool.query`) vì đang trong context `client` của `initDB`.
- Vị trí: SAU câu `await client.query(\`...lớn...\`);` (line 353) và TRƯỚC `console.log` (line 355) HOẶC sau console.log trước seedData. Theo edit ở trên, đặt giữa `\`);` đóng và `console.log` để migration log không lẫn vào schema log.

- [ ] **Step 2: Verify parse**

```bash
node --check db.js
```

Expected: exit 0.

- [ ] **Step 3: Verify migration runs (no UI needed)**

Trước khi chạy, snapshot DB:

```bash
docker exec -i program-db psql -U program -d program_db -c "SELECT id, academic_year FROM program_versions ORDER BY id;"
```

Note kết quả (kỳ vọng có row "2026-2027").

Restart server (file watch sẽ trigger initDB lại):

```bash
# Nếu đang chạy make dev → save db.js → file watcher restart server.
# Nếu chưa chạy → make dev (timeout 10s là đủ để init xong)
```

Sau khoảng 5 giây, query lại:

```bash
docker exec -i program-db psql -U program -d program_db -c "SELECT id, academic_year FROM program_versions ORDER BY id;"
```

Expected: row trước có "2026-2027" giờ là "2026". Row đã đúng format thì không đổi.

Restart lần 2 → query lần 3 → expect: vẫn "2026" (idempotent confirmed).

Nếu kết quả không như kỳ vọng, STOP và debug.

- [ ] **Step 4: Commit**

```bash
git add db.js
git commit -m "$(cat <<'EOF'
feat(db): migrate academic_year from YYYY-YYYY to YYYY single-year format

Add an idempotent UPDATE in initDB that strips the trailing year from
existing academic_year values. Rows already in YYYY format or with
unexpected content are skipped because the regex does not match.

Schema column type (VARCHAR(20)) and the UNIQUE(program_id, academic_year)
constraint are unchanged.
EOF
)"
```

---

## Task 2: Validation + labels trong `programs.js`

**Files:**
- Modify: `public/js/pages/programs.js` — 18 label changes + 4-line validation rewrite.

Reasons gom Task này: validation logic ngay cạnh các label cùng cần đổi; tách ra dễ miss inconsistency (ví dụ đổi label nhưng quên error message).

- [ ] **Step 1: Sửa logic validation năm**

Mở `programs.js`, tìm đoạn (line 615-620):

```js
    const academic_year = document.getElementById('ver-edit-year').value.trim();

    if (!academic_year) { window.toast.error('Vui lòng nhập số phiên bản'); return; }
    if (!/^\d{4}-\d{4}$/.test(academic_year)) { window.toast.error('Số phiên bản phải có dạng YYYY-YYYY (VD: 2025-2026)'); return; }
    const [y1, y2] = academic_year.split('-').map(Number);
    if (y2 !== y1 + 1) { window.toast.error('Số phiên bản phải là 2 năm liên tiếp (VD: 2025-2026)'); return; }
```

Sửa thành:

```js
    const academic_year = document.getElementById('ver-edit-year').value.trim();

    if (!academic_year) { window.toast.error('Vui lòng nhập số khóa'); return; }
    if (!/^\d{4}$/.test(academic_year)) { window.toast.error('Số khóa phải có định dạng 4 chữ số (VD: 2026)'); return; }
```

Bỏ hoàn toàn 2 dòng tách `[y1, y2]` và check `y2 !== y1 + 1` — không còn hữu ích cho format 1 năm.

- [ ] **Step 2: Sửa các label "Phiên Bản" / "phiên bản" còn lại trong programs.js**

Đây là 17 chỗ label. Đi tuần tự, edit từng chỗ. Tất cả đều là rename text trong JSX-like template literal.

**Edit 2.1** — line 104 — modal title:
```js
// trước
<div class="modal-header" style="flex-shrink:0;"><h2 id="ver-edit-modal-title">Chỉnh Sửa Phiên Bản</h2></div>
// sau
<div class="modal-header" style="flex-shrink:0;"><h2 id="ver-edit-modal-title">Chỉnh Sửa Khóa</h2></div>
```

**Edit 2.2** — line 112 — label "Số Phiên Bản":
```js
// trước
<label>Số Phiên Bản <span class="required-mark">*</span></label>
// sau
<label>Số Khóa <span class="required-mark">*</span></label>
```

**Edit 2.3** — line 116 — label "Tên Phiên Bản":
```js
// trước
<label>Tên Phiên Bản</label>
// sau
<label>Tên Khóa</label>
```

**Edit 2.4** — line 117 — placeholder (cũng có "phiên bản"):
```js
// trước
<input type="text" id="ver-edit-name" placeholder="VD: phiên bản năm học 2025-2026">
// sau
<input type="text" id="ver-edit-name" placeholder="VD: khóa năm 2026">
```

**Edit 2.5** — line 120 — label "Copy từ phiên bản":
```js
// trước
<label>Copy từ phiên bản</label>
// sau
<label>Copy từ khóa</label>
```

**Edit 2.6** — line 274 — badge text:
```js
// trước
<span class="badge badge-neutral">${p.version_count} phiên bản</span>
// sau
<span class="badge badge-neutral">${p.version_count} khóa</span>
```

**Edit 2.7** — line 304 — confirm message:
```js
// trước
message: `Bạn có chắc chắn muốn xóa CTĐT "${name}"?\n\nThao tác này sẽ xóa tất cả các phiên bản, PO, PLO và dữ liệu liên quan.`,
// sau
message: `Bạn có chắc chắn muốn xóa CTĐT "${name}"?\n\nThao tác này sẽ xóa tất cả các khóa, PO, PLO và dữ liệu liên quan.`,
```

**Edit 2.8** — line 428 — modal title text:
```js
// trước
document.getElementById('ver-edit-modal-title').textContent = 'Tạo phiên bản mới';
// sau
document.getElementById('ver-edit-modal-title').textContent = 'Tạo khóa mới';
```

**Edit 2.9** — line 450 — button text:
```js
// trước
document.getElementById('ver-edit-save-btn').textContent = 'Tạo phiên bản';
// sau
document.getElementById('ver-edit-save-btn').textContent = 'Tạo khóa';
```

**Edit 2.10** — line 472 — comment + line 476 + line 477:

Đoạn này có 1 comment + 2 string trong 6 dòng liên tiếp (line 472-477). Xem nguyên block:

```js
    // Change header button from "Tạo CTĐT" to "Tạo phiên bản"
    ...
      <div class="card-title">Phiên bản - ${programName}</div>
      ${window.App.hasPerm('programs.create_version') ? `<button class="btn btn-primary" onclick="window.ProgramsPage.openVersionModal(${programId})">+ Tạo phiên bản</button>` : ''}
```

Sửa thành:

```js
    // Change header button from "Tạo CTĐT" to "Tạo khóa"
    ...
      <div class="card-title">Khóa - ${programName}</div>
      ${window.App.hasPerm('programs.create_version') ? `<button class="btn btn-primary" onclick="window.ProgramsPage.openVersionModal(${programId})">+ Tạo khóa</button>` : ''}
```

**Edit 2.11** — line 488 — section header:
```js
// trước
<h3 class="section-title">Phiên bản: ${programName}</h3>
// sau
<h3 class="section-title">Khóa: ${programName}</h3>
```

**Edit 2.12** — line 491 — empty state:
```js
// trước
? '<div class="empty-state"><div class="icon">📭</div><p>Chưa có phiên bản nào</p></div>'
// sau
? '<div class="empty-state"><div class="icon">📭</div><p>Chưa có khóa nào</p></div>'
```

**Edit 2.13** — line 506 — copy badge:
```js
// trước
${v.copied_from_id ? ' · Copy từ phiên bản trước' : ''}
// sau
${v.copied_from_id ? ' · Copy từ khóa trước' : ''}
```

**Edit 2.14** — line 510 — clone tooltip:
```js
// trước
${window.App.hasPerm('programs.create_version') && v.status === 'published' ? `<button class="btn btn-secondary btn-sm" title="Nhân bản phiên bản này" onclick="window.ProgramsPage.cloneVersion(${programId}, ${v.id}, '${v.academic_year}')">📋 Nhân bản</button>` : ''}
// sau
${window.App.hasPerm('programs.create_version') && v.status === 'published' ? `<button class="btn btn-secondary btn-sm" title="Nhân bản khóa này" onclick="window.ProgramsPage.cloneVersion(${programId}, ${v.id}, '${v.academic_year}')">📋 Nhân bản</button>` : ''}
```

**Edit 2.15** — line 559-562 — delete confirm:
```js
// trước
title: 'Xóa phiên bản CTĐT',
...
message: `Bạn có chắc muốn xóa phiên bản năm học "${year}" của CTĐT "${programName}"?`,
confirmText: 'Xóa phiên bản',
// sau
title: 'Xóa khóa CTĐT',
...
message: `Bạn có chắc muốn xóa khóa "${year}" của CTĐT "${programName}"?`,
confirmText: 'Xóa khóa',
```

(Lưu ý: bỏ chữ "năm học" vì giờ year là 1 năm duy nhất, gọi "khóa 2026" gọn hơn.)

**Edit 2.16** — line 571 — toast xóa:
```js
// trước
window.toast.success(`Đã xóa phiên bản ${year}`);
// sau
window.toast.success(`Đã xóa khóa ${year}`);
```

**Edit 2.17** — line 585 — modal title edit:
```js
// trước
document.getElementById('ver-edit-modal-title').textContent = `Chỉnh Sửa Phiên Bản - ${programName}`;
// sau
document.getElementById('ver-edit-modal-title').textContent = `Chỉnh Sửa Khóa - ${programName}`;
```

**Edit 2.18** — line 607 — toast lỗi load:
```js
// trước
window.toast.error('Không thể tải dữ liệu phiên bản: ' + e.message);
// sau
window.toast.error('Không thể tải dữ liệu khóa: ' + e.message);
```

**Edit 2.19** — line 649 — toast cập nhật:
```js
// trước
window.toast.success('Đã cập nhật phiên bản');
// sau
window.toast.success('Đã cập nhật khóa');
```

**Edit 2.20** — line 660 — toast tạo:
```js
// trước
window.toast.success(`Đã tạo phiên bản ${academic_year}` + (copy_from_version_id ? ' (đã copy dữ liệu)' : ''));
// sau
window.toast.success(`Đã tạo khóa ${academic_year}` + (copy_from_version_id ? ' (đã copy dữ liệu)' : ''));
```

- [ ] **Step 3: Verify không còn "phiên bản" / "Phiên Bản" / "Phiên bản" trong programs.js**

```bash
grep -niE "phiên\s*bản" public/js/pages/programs.js
```

Expected: no output. Nếu vẫn còn, là bỏ sót — quay lại edit.

- [ ] **Step 4: Verify parse**

```bash
node --check public/js/pages/programs.js
```

Expected: exit 0 (có thể warn về browser globals — ignore).

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/programs.js
git commit -m "$(cat <<'EOF'
refactor(frontend): rename 'phiên bản' → 'Khóa' in programs page

UI labels for the program_versions concept now read "Khóa" instead of
"phiên bản" / "Phiên Bản". Year-format validation is simplified to a
single 4-digit year; the consecutive-year check is removed.

Internals (variable names, route URLs, schema column, page module name)
are unchanged — only user-visible Vietnamese labels and toast messages.
EOF
)"
```

---

## Task 3: Label-only changes in 4 files (version-editor, import-word, dashboard, audit-logs)

**Files:**
- Modify: `public/js/pages/version-editor.js` (2 edits)
- Modify: `public/js/pages/import-word.js` (5 edits)
- Modify: `public/js/pages/dashboard.js` (2 edits)
- Modify: `public/js/pages/audit-logs.js` (2 edits)

Tất cả là rename text trong template literal hoặc string literal. Không đụng logic.

- [ ] **Step 1: `version-editor.js` (2 edits)**

**Edit 3.1.1** — line 224 — section header:
```js
// trước
<h3 style="font-size:15px;font-weight:600;margin:24px 0 16px;">Thông tin phiên bản</h3>
// sau
<h3 style="font-size:15px;font-weight:600;margin:24px 0 16px;">Thông tin khóa</h3>
```

**Edit 3.1.2** — line 266 — toast:
```js
// trước
window.toast?.success('Đã lưu thông tin phiên bản');
// sau
window.toast?.success('Đã lưu thông tin khóa');
```

- [ ] **Step 2: `import-word.js` (5 edits)**

**Edit 3.2.1** — line 30 — info text:
```js
// trước
Tải lên file <strong>.docx</strong> chứa nội dung chương trình đào tạo để hệ thống phân tích và tạo phiên bản mới.
// sau
Tải lên file <strong>.docx</strong> chứa nội dung chương trình đào tạo để hệ thống phân tích và tạo khóa mới.
```

**Edit 3.2.2** — line 207 — info span:
```js
// trước
<span style="font-size:13px;">"${this._esc(this.existingProgram.name)}" (Mã: ${this._esc(this.existingProgram.code)}) — sẽ tạo phiên bản mới cho CTĐT này.</span>
// sau
<span style="font-size:13px;">"${this._esc(this.existingProgram.name)}" (Mã: ${this._esc(this.existingProgram.code)}) — sẽ tạo khóa mới cho CTĐT này.</span>
```

**Edit 3.2.3** — line 211 — h3 title:
```js
// trước
<h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">${this.existingProgram ? 'Tạo phiên bản mới' : 'Tạo bản nháp CTĐT'}</h3>
// sau
<h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">${this.existingProgram ? 'Tạo khóa mới' : 'Tạo bản nháp CTĐT'}</h3>
```

**Edit 3.2.4** — line 232 — button text:
```js
// trước
${this.existingProgram ? 'Tạo phiên bản & Chỉnh sửa' : 'Tạo bản nháp & Chỉnh sửa'}
// sau
${this.existingProgram ? 'Tạo khóa & Chỉnh sửa' : 'Tạo bản nháp & Chỉnh sửa'}
```

**Edit 3.2.5** — line 284-287 — confirm dialog text (3 chỗ "phiên bản" trong block này):

Trước:
```js
      ? `Xác nhận tạo phiên bản mới cho CTĐT "${this.existingProgram.name}"?\n\nNăm học: ${yearVal}\nNội dung: ${poCount} PO, ${ploCount} PLO, ${courseCount} học phần\n\nSau khi tạo, bạn sẽ được chuyển đến trang chỉnh sửa phiên bản.`
      : `Xác nhận tạo bản nháp CTĐT?\n\nNgành: ${nganhSelect.options[nganhSelect.selectedIndex]?.text}\nNăm học: ${yearVal}\nNội dung: ${poCount} PO, ${ploCount} PLO, ${courseCount} học phần\n\nSau khi tạo, bạn sẽ được chuyển đến trang chỉnh sửa phiên bản.`;
    ...
      title: this.existingProgram ? 'Tạo phiên bản mới' : 'Tạo bản nháp CTĐT',
```

Sau:
```js
      ? `Xác nhận tạo khóa mới cho CTĐT "${this.existingProgram.name}"?\n\nNăm học: ${yearVal}\nNội dung: ${poCount} PO, ${ploCount} PLO, ${courseCount} học phần\n\nSau khi tạo, bạn sẽ được chuyển đến trang chỉnh sửa khóa.`
      : `Xác nhận tạo bản nháp CTĐT?\n\nNgành: ${nganhSelect.options[nganhSelect.selectedIndex]?.text}\nNăm học: ${yearVal}\nNội dung: ${poCount} PO, ${ploCount} PLO, ${courseCount} học phần\n\nSau khi tạo, bạn sẽ được chuyển đến trang chỉnh sửa khóa.`;
    ...
      title: this.existingProgram ? 'Tạo khóa mới' : 'Tạo bản nháp CTĐT',
```

(Giữ "Năm học: ${yearVal}" vì là label thuộc tính năm.)

- [ ] **Step 3: `dashboard.js` (2 edits)**

**Edit 3.3.1** — line 20 — metric:
```js
// trước
${this.metric('Phiên bản', vTotal)}
// sau
${this.metric('Khóa', vTotal)}
```

**Edit 3.3.2** — line 29 — section title:
```js
// trước
<h3 class="section-title mb-3">Phiên bản CTĐT</h3>
// sau
<h3 class="section-title mb-3">Khóa CTĐT</h3>
```

- [ ] **Step 4: `audit-logs.js` (2 edits)**

**Edit 3.4.1** — line 26 — entity label:
```js
// trước
[/^programs\/\d+\/versions$/, 'phiên bản CTĐT'],
// sau
[/^programs\/\d+\/versions$/, 'khóa CTĐT'],
```

**Edit 3.4.2** — line 28 — entity label:
```js
// trước
[/^versions\/(\d+)$/, 'phiên bản CTĐT'],
// sau
[/^versions\/(\d+)$/, 'khóa CTĐT'],
```

- [ ] **Step 5: Verify không còn "phiên bản" trong 4 file**

```bash
grep -niE "phiên\s*bản" public/js/pages/version-editor.js public/js/pages/import-word.js public/js/pages/dashboard.js public/js/pages/audit-logs.js
```

Expected: no output.

- [ ] **Step 6: Verify parse 4 file**

```bash
node --check public/js/pages/version-editor.js && \
  node --check public/js/pages/import-word.js && \
  node --check public/js/pages/dashboard.js && \
  node --check public/js/pages/audit-logs.js && echo OK
```

Expected: `OK`.

- [ ] **Step 7: Commit**

```bash
git add public/js/pages/version-editor.js public/js/pages/import-word.js public/js/pages/dashboard.js public/js/pages/audit-logs.js
git commit -m "$(cat <<'EOF'
refactor(frontend): rename 'phiên bản' → 'Khóa' in remaining pages

Apply the same UI rename to version-editor, import-word, dashboard, and
audit-logs pages so all user-visible references to the program_versions
concept consistently read "Khóa".

Variable names, route paths, and DB column names are unchanged.
EOF
)"
```

---

## Final Verification (Controller + User)

After all 3 tasks commit, controller hands off to user for UI verification:

1. **Migration:** confirm DB row "2026-2027" → "2026" (already verified in Task 1 Step 3, but spot-check after restart).
2. **Validation:** create new khóa with "2026" → success; with "2026-2027" → toast lỗi format.
3. **UI sweep:** scan Programs, Version Editor, Import Word, Dashboard, Audit Logs pages — không còn chữ "phiên bản" hiển thị (trừ "Đã khóa" badge và "Khóa luận" nếu có ở đâu khác là đúng).
4. **Non-regression:** create / edit / clone / delete khóa — toast messages đều dùng "khóa".

Sanity grep cuối cùng:

```bash
grep -rniE "phiên\s*bản" public/js/pages/
```

Expected: no output. (Nếu sót, quay lại edit.)

---

## Self-Review Notes

**Spec coverage:**
- ✅ Migration in initDB → Task 1 Step 1
- ✅ Validation regex + error messages → Task 2 Step 1
- ✅ UI label mapping (entire table from spec) → Task 2 Step 2 (programs.js, 18 edits) + Task 3 Steps 1-4 (other 4 files, 11 edits total)
- ✅ Schema/URL/biến code KHÔNG đụng — confirmed in spec section "KHÔNG đổi", no task touches these
- ✅ "Năm học" label giữ nguyên — Task 3 Step 2 Edit 3.2.5 explicitly preserves "Năm học: ${yearVal}"
- ✅ Server error strings không đụng — out of scope per spec
- ✅ Word parser không đụng — confirmed safe (uses 4-digit current year)

**Placeholder scan:** none. Each step has explicit before/after code.

**Type/ID consistency:**
- Variable `academic_year` referenced consistently (spec + plan + code).
- Removed lines (y1/y2 split + check) explicitly noted in Task 2 Step 1 — no leftover references.
- File paths exact and consistent.

**Edit count check:** programs.js had 18 distinct label changes per the explore + I numbered Edit 2.1 through 2.20 (some grouped). Verified by re-counting from grep output (line-by-line). All accounted for.
