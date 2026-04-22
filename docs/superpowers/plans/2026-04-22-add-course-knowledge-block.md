# Add Course with Knowledge Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi thêm học phần vào CTDT, form phải có dropdown chọn khối kiến thức (2 cấp cha/con, bắt buộc), và `knowledge_block_id` được lưu vào `version_courses`.

**Architecture:** Backend nhận thêm `knowledge_block_id` trong `POST /api/versions/:vId/courses` và validate. Frontend trong `renderCoursesTab` fetch danh sách blocks song song, render grouped `<select>`, và `addCourse()` validate + gửi field mới.

**Tech Stack:** Express.js (server.js), vanilla JS (version-editor.js), PostgreSQL

---

### Task 1: Backend — nhận và validate `knowledge_block_id`

**Files:**
- Modify: `server.js` (route `POST /api/versions/:vId/courses`, khoảng dòng 1940-1949)

- [ ] **Step 1: Đọc hiểu route hiện tại**

  Dòng 1940-1949 trong `server.js`:
  ```js
  app.post('/api/versions/:vId/courses', authMiddleware, requireDraft('vId'), async (req, res) => {
    const { course_id, semester, course_type } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO version_courses (version_id, course_id, semester, course_type) VALUES ($1,$2,$3,$4) RETURNING *',
        [req.params.vId, course_id, semester || 1, course_type || 'required']
      );
      res.json(result.rows[0]);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  ```

- [ ] **Step 2: Thay thế route bằng version mới có validate knowledge_block_id**

  Thay toàn bộ block trên thành:
  ```js
  app.post('/api/versions/:vId/courses', authMiddleware, requireDraft('vId'), async (req, res) => {
    const { course_id, semester, course_type, knowledge_block_id } = req.body;
    if (!knowledge_block_id) return res.status(400).json({ error: 'Vui lòng chọn khối kiến thức' });
    try {
      // Validate block belongs to this version and is a leaf (no children)
      const blockRes = await pool.query(
        'SELECT id, version_id FROM knowledge_blocks WHERE id=$1',
        [knowledge_block_id]
      );
      if (!blockRes.rows.length) return res.status(400).json({ error: 'Khối kiến thức không tồn tại' });
      if (blockRes.rows[0].version_id !== parseInt(req.params.vId)) {
        return res.status(400).json({ error: 'Khối kiến thức không thuộc phiên bản này' });
      }
      const childRes = await pool.query('SELECT id FROM knowledge_blocks WHERE parent_id=$1 LIMIT 1', [knowledge_block_id]);
      if (childRes.rows.length > 0) return res.status(400).json({ error: 'Chỉ được chọn khối kiến thức lá (không có khối con)' });

      const result = await pool.query(
        'INSERT INTO version_courses (version_id, course_id, semester, course_type, knowledge_block_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [req.params.vId, course_id, semester || 1, course_type || 'required', knowledge_block_id]
      );
      res.json(result.rows[0]);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  ```

- [ ] **Step 3: Kiểm tra thủ công API bằng curl (app phải đang chạy)**

  ```bash
  # Thay VERSION_ID bằng id version hợp lệ
  # Thiếu knowledge_block_id → expect 400 "Vui lòng chọn khối kiến thức"
  curl -s -X POST http://localhost:3600/api/versions/VERSION_ID/courses \
    -H 'Content-Type: application/json' \
    -b 'token=YOUR_JWT' \
    -d '{"course_id":1,"semester":1,"course_type":"required"}' | jq .
  ```
  Kết quả mong đợi: `{"error":"Vui lòng chọn khối kiến thức"}`

- [ ] **Step 4: Commit**

  ```bash
  git add server.js
  git commit -m "feat: require knowledge_block_id when adding course to version"
  ```

---

### Task 2: Frontend — thêm dropdown Khối KT vào form thêm HP

**Files:**
- Modify: `public/js/pages/version-editor.js` (hàm `renderCoursesTab`, khoảng dòng 705-757)

- [ ] **Step 1: Fetch danh sách knowledge blocks song song trong `renderCoursesTab`**

  Dòng 706-709 hiện tại:
  ```js
  const [vCourses, allCourses] = await Promise.all([
    fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
    fetch('/api/courses/all').then(r => r.json()),
  ]);
  ```

  Thay thành:
  ```js
  const [vCourses, allCourses, kbData] = await Promise.all([
    fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
    fetch('/api/courses/all').then(r => r.json()),
    fetch(`/api/versions/${this.versionId}/knowledge-blocks`).then(r => r.json()).catch(() => ({ blocks: [] })),
  ]);
  const blocks = kbData.blocks || [];
  ```

- [ ] **Step 2: Tạo helper render grouped select options cho blocks**

  Thêm đoạn sau ngay sau dòng khai báo `blocks` (vẫn trong `renderCoursesTab`):
  ```js
  // Build grouped <select> options: optgroup for parents with children, plain option for leaves
  function buildBlockOptions(blocks) {
    const parents = blocks.filter(b => !b.parent_id);
    const childrenOf = (pid) => blocks.filter(b => b.parent_id === pid);
    let html = '<option value="">-- Chọn khối kiến thức --</option>';
    for (const parent of parents) {
      const children = childrenOf(parent.id);
      if (children.length > 0) {
        html += `<optgroup label="${parent.name}">`;
        for (const child of children) {
          const grandchildren = childrenOf(child.id);
          if (grandchildren.length > 0) {
            // child has sub-children → render as sub-optgroup (not standard HTML, fallback to disabled option)
            html += `<option disabled>  ${child.name}</option>`;
            for (const gc of grandchildren) {
              html += `<option value="${gc.id}">&nbsp;&nbsp;&nbsp;&nbsp;${gc.name}</option>`;
            }
          } else {
            html += `<option value="${child.id}">${child.name}</option>`;
          }
        }
        html += `</optgroup>`;
      } else {
        // parent is a leaf itself
        html += `<option value="${parent.id}">${parent.name}</option>`;
      }
    }
    return html;
  }
  ```

- [ ] **Step 3: Thêm dropdown `#add-vc-block` vào form thêm HP trong template HTML**

  Tìm đoạn trong body.innerHTML (dòng ~727-729):
  ```js
          <div class="input-group" style="width:120px;margin:0;"><label>Loại</label>
            <select id="add-vc-type"><option value="required">Bắt buộc</option><option value="elective">Tự chọn</option></select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.addCourse()">Thêm</button>
  ```

  Thêm dropdown Khối KT vào trước nút "Thêm":
  ```js
          <div class="input-group" style="width:120px;margin:0;"><label>Loại</label>
            <select id="add-vc-type"><option value="required">Bắt buộc</option><option value="elective">Tự chọn</option></select>
          </div>
          <div class="input-group" style="flex:1;min-width:160px;margin:0;"><label>Khối kiến thức <span style="color:var(--danger)">*</span></label>
            <select id="add-vc-block">${buildBlockOptions(blocks)}</select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.addCourse()">Thêm</button>
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add public/js/pages/version-editor.js
  git commit -m "feat: add knowledge block grouped dropdown to add-course form"
  ```

---

### Task 3: Frontend — validate và gửi `knowledge_block_id` trong `addCourse()`

**Files:**
- Modify: `public/js/pages/version-editor.js` (hàm `addCourse`, khoảng dòng 759-771)

- [ ] **Step 1: Đọc hàm hiện tại**

  ```js
  async addCourse() {
    const course_id = document.getElementById('add-vc-course').value;
    const semester = parseInt(document.getElementById('add-vc-sem').value);
    const course_type = document.getElementById('add-vc-type').value;
    try {
      const res = await fetch(`/api/versions/${this.versionId}/courses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_id, semester, course_type })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã thêm');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },
  ```

- [ ] **Step 2: Cập nhật `addCourse()` để đọc, validate và gửi `knowledge_block_id`**

  Thay toàn bộ hàm thành:
  ```js
  async addCourse() {
    const course_id = document.getElementById('add-vc-course').value;
    const semester = parseInt(document.getElementById('add-vc-sem').value);
    const course_type = document.getElementById('add-vc-type').value;
    const knowledge_block_id = document.getElementById('add-vc-block')?.value;
    if (!knowledge_block_id) {
      window.toast.error('Vui lòng chọn khối kiến thức');
      return;
    }
    try {
      const res = await fetch(`/api/versions/${this.versionId}/courses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id, semester, course_type, knowledge_block_id: parseInt(knowledge_block_id) })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã thêm');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },
  ```

- [ ] **Step 3: Kiểm tra thủ công trên trình duyệt**

  1. Mở tab "Học phần" của một version đang ở trạng thái draft
  2. Kiểm tra dropdown "Khối kiến thức" hiển thị đúng cấu trúc cha/con
  3. Nhấn "Thêm" mà không chọn khối → toast lỗi "Vui lòng chọn khối kiến thức"
  4. Chọn khối, chọn HP, nhấn "Thêm" → toast "Đã thêm", HP xuất hiện trong bảng
  5. Mở tab "Khối KT" → xác nhận HP mới xuất hiện trong đúng khối đã chọn

- [ ] **Step 4: Commit**

  ```bash
  git add public/js/pages/version-editor.js
  git commit -m "feat: validate and send knowledge_block_id in addCourse"
  ```
