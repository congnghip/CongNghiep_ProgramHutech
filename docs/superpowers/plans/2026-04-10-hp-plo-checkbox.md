# HP-PLO Checkbox Auto-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi riêng tab `HP ↔ PLO` trong version editor từ dropdown mức `— / 1 / 2 / 3` sang checkbox nhị phân và tự động lưu ngay khi người dùng tích hoặc bỏ tích.

**Architecture:** Giữ nguyên API backend `PUT /api/versions/:vId/course-plo-map` để tránh lan phạm vi thay đổi. Frontend ở `version-editor.js` sẽ render checkbox thay cho `select`, coi mọi mapping có `contribution_level > 0` là `checked`, và khi auto-save sẽ chuẩn hóa toàn bộ ô đang được chọn về `contribution_level = 1`. Một test Playwright mới trong suite hiện có sẽ chứng minh UI render đúng và thao tác checkbox thực sự lưu dữ liệu.

**Tech Stack:** Express.js, frontend vanilla JS trong `public/js/pages/version-editor.js`, Playwright (`tests/all_features.test.js`), PostgreSQL API hiện có.

---

### Task 1: Thêm test Playwright cho checkbox HP-PLO

**Files:**
- Modify: `tests/all_features.test.js`
- Verify against: `public/js/pages/version-editor.js`

- [ ] **Step 1: Write the failing test**

Thêm một test mới trong `describe('Version Editor', ...)` để:
- tạo 1 học phần trong version test
- tạo 1 PLO trong version test
- mở tab `HP ↔ PLO`
- xác nhận UI dùng checkbox thay vì `select`
- tích checkbox đầu tiên
- chờ trạng thái `Đã lưu`
- đọc lại API `course-plo-map` và xác nhận mapping được lưu với `contribution_level = 1`
- dọn dữ liệu đã tạo

```js
  test('TC_VER_39: HP-PLO dung checkbox va tu dong luu', async ({ page }) => {
    await login(page);
    const setup = await page.evaluate(async (vId) => {
      const coursesRes = await fetch('/api/courses');
      const courses = await coursesRes.json();
      if (!courses.length) return { skip: true };

      const code = 'PLOCHK_' + (Date.now() % 1e6);
      const ploRes = await fetch(`/api/versions/${vId}/plos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, description: 'PLO checkbox test' })
      });
      const plo = await ploRes.json();

      const vcRes = await fetch(`/api/versions/${vId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courses[0].id, semester: 1 })
      });
      const versionCourse = await vcRes.json();

      return { skip: false, ploId: plo.id, versionCourseId: versionCourse.id };
    }, testVersionId);

    if (setup.skip) test.skip();

    await page.evaluate((vId) => window.App.navigate('version-editor', { versionId: vId }), testVersionId);
    await page.waitForTimeout(1000);
    await page.locator('#editor-tabs .tab-item', { hasText: 'HP ↔ PLO' }).click();

    await expect(page.locator('#c-plo-table input.plo-checkbox').first()).toBeVisible();
    await expect(page.locator('#c-plo-table select.plo-select')).toHaveCount(0);

    const checkbox = page.locator(
      `#c-plo-table input.plo-checkbox[data-vc="${setup.versionCourseId}"][data-plo="${setup.ploId}"]`
    );
    await checkbox.check();
    await expect(page.locator('#c-plo-status')).toContainText('Đã lưu');

    const saved = await page.evaluate(async (data) => {
      const res = await fetch(`/api/versions/${data.vId}/course-plo-map`);
      const mappings = await res.json();
      return mappings.find(m => m.course_id === data.versionCourseId && m.plo_id === data.ploId) || null;
    }, { vId: testVersionId, versionCourseId: setup.versionCourseId, ploId: setup.ploId });

    expect(saved).toBeTruthy();
    expect(saved.contribution_level).toBe(1);

    await page.evaluate(async (data) => {
      await fetch(`/api/versions/${data.vId}/course-plo-map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: [] })
      });
      await fetch(`/api/plos/${data.ploId}`, { method: 'DELETE' });
      await fetch(`/api/version-courses/${data.versionCourseId}`, { method: 'DELETE' });
    }, { vId: testVersionId, ploId: setup.ploId, versionCourseId: setup.versionCourseId });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/all_features.test.js -g "TC_VER_39"`

Expected: FAIL vì tab `HP ↔ PLO` hiện chưa render `input.plo-checkbox` và vẫn còn `select.plo-select`.

- [ ] **Step 3: Commit**

```bash
git add tests/all_features.test.js
git commit -m "test: add HP-PLO checkbox autosave coverage"
```

### Task 2: Đổi UI HP-PLO sang checkbox và giữ auto-save

**Files:**
- Modify: `public/js/pages/version-editor.js`
- Verify with: `tests/all_features.test.js`

- [ ] **Step 1: Write minimal implementation**

Trong `renderCoursePLOMatrix`:
- đổi dòng mô tả sang trạng thái `Bỏ trống = Không áp dụng · Tích = Áp dụng`
- render `input type="checkbox"` với class `plo-checkbox`
- đánh dấu `checked` khi `contribution_level > 0`
- giữ trạng thái disabled theo `editable`
- cập nhật phần `autoSave()` để quét `input.plo-checkbox:checked` và luôn gửi `contribution_level: 1`

```js
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">Bỏ trống = Không áp dụng · Tích = Áp dụng</p>
```

```js
              ${plos.map(p => {
                const checked = (ploMapObj[`${c.id}-${p.id}`] || 0) > 0;
                return `<td style="text-align:center;">
                  <input
                    type="checkbox"
                    class="plo-checkbox"
                    data-vc="${c.id}"
                    data-plo="${p.id}"
                    ${checked ? 'checked' : ''}
                    ${!editable ? 'disabled' : ''}
                    style="width:16px;height:16px;cursor:${editable ? 'pointer' : 'not-allowed'};"
                  />
                </td>`;
              }).join('')}
```

```js
          const ploCheckboxes = document.querySelectorAll('#c-plo-table input.plo-checkbox:checked');
          const mappings = [];
          ploCheckboxes.forEach(s => {
            mappings.push({
              course_id: parseInt(s.dataset.vc, 10),
              plo_id: parseInt(s.dataset.plo, 10),
              contribution_level: 1
            });
          });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx playwright test tests/all_features.test.js -g "TC_VER_39"`

Expected: PASS, test nhìn thấy checkbox, không còn dropdown ở bảng HP-PLO, và thao tác tích checkbox lưu ra API với `contribution_level = 1`.

- [ ] **Step 3: Run focused regression for version editor matrix behavior**

Run: `npx playwright test tests/all_features.test.js -g "TC_VER_(30|31|32|39)"`

Expected: PASS cho các test `TC_VER_30`, `TC_VER_31`, `TC_VER_32` và `TC_VER_39`, xác nhận API ma trận HP-PLO cũ vẫn hoạt động và UI mới không làm gãy nhóm test liên quan.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/version-editor.js tests/all_features.test.js
git commit -m "feat: switch HP-PLO matrix to checkbox autosave"
```
