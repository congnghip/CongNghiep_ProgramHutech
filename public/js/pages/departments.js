// Departments Page — Tree view + CRUD
window.DepartmentsPage = {
  departments: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Đơn vị tổ chức</div>
          <button class="btn btn-primary" onclick="window.DepartmentsPage.openAddModal()">+ Tạo đơn vị</button>
        </div>
        <div id="dept-content" class="card-body"><div class="spinner"></div></div>
      </div>
      <div id="dept-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="dept-modal-title">Tạo đơn vị</h2></div>
          <div class="modal-body">
            <form id="dept-form">
              <input type="hidden" id="dept-edit-id">
              <div class="input-group">
                <label>Đơn vị cha</label>
                <select id="dept-parent"></select>
              </div>
              <div class="input-group">
                <label>Mã đơn vị <span style="color:var(--danger);">*</span></label>
                <input type="text" id="dept-code" required placeholder="VD: K.CNTT">
              </div>
              <div class="input-group">
                <label>Tên đơn vị <span style="color:var(--danger);">*</span></label>
                <input type="text" id="dept-name" required placeholder="VD: Khoa CNTT">
              </div>
              <div class="input-group">
                <label>Loại</label>
                <select id="dept-type">
                  <option value="KHOA">Khoa</option>
                  <option value="VIEN">Viện</option>
                  <option value="TRUNG_TAM">Trung tâm</option>
                  <option value="BO_MON">Bộ môn</option>
                  <option value="PHONG">Phòng ban</option>
                </select>
              </div>
              <div class="modal-error" id="dept-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="window.DepartmentsPage.closeModal()">Hủy</button>
                <button type="submit" class="btn btn-primary" id="dept-save-btn">Tạo mới</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.getElementById('dept-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.save();
    });
    await this.loadData();
  },

  async loadData() {
    try {
      const res = await fetch('/api/departments');
      this.departments = await res.json();
      this.renderTree();
    } catch (e) {
      document.getElementById('dept-content').innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
    }
  },

  renderTree() {
    const tree = this.buildTree();
    const badges = { ROOT:'badge-neutral', KHOA:'badge-info', VIEN:'badge-success', TRUNG_TAM:'badge-warning', BO_MON:'badge-neutral', PHONG:'badge-neutral' };

    const renderNode = (node, depth = 0) => {
      const indent = depth * 28;
      return `
        <div class="tree-node" style="margin-left:${indent}px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:500;font-size:14px;">${node.name}</div>
              <div style="font-size:11px;color:var(--text-muted);">${node.code} · <span class="badge ${badges[node.type] || 'badge-neutral'}">${node.type}</span></div>
            </div>
            </div>
            <div style="display:flex;gap:4px;">
              ${node.type !== 'ROOT' ? `<button class="btn btn-secondary btn-sm" onclick="window.DepartmentsPage.openEditModal(${node.id})">Sửa</button>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.DepartmentsPage.openAddModal(${node.id})">+ Con</button>
            </div>
          </div>
          ${node.children.length ? `<div style="margin-top:6px;">${node.children.map(c => renderNode(c, depth + 1)).join('')}</div>` : ''}
        </div>
      `;
    };

    document.getElementById('dept-content').innerHTML = tree.map(n => renderNode(n)).join('');
  },

  buildTree() {
    const map = {};
    const roots = [];
    this.departments.forEach(d => { map[d.id] = { ...d, children: [] }; });
    this.departments.forEach(d => {
      if (d.parent_id && map[d.parent_id]) map[d.parent_id].children.push(map[d.id]);
      else roots.push(map[d.id]);
    });
    return roots;
  },

  openAddModal(parentId) {
    document.getElementById('dept-modal-title').textContent = 'Tạo đơn vị mới';
    document.getElementById('dept-form').reset();
    document.getElementById('dept-edit-id').value = '';
    document.getElementById('dept-code').disabled = false;
    this.populateParentSelect(parentId);
    document.getElementById('dept-error').classList.remove('show');
    document.getElementById('dept-save-btn').textContent = 'Tạo mới';
    document.getElementById('dept-modal').classList.add('active');
  },

  openEditModal(id) {
    const dept = this.departments.find(d => d.id === id);
    if (!dept) return;
    document.getElementById('dept-modal-title').textContent = 'Sửa đơn vị';
    document.getElementById('dept-edit-id').value = dept.id;
    document.getElementById('dept-code').value = dept.code;
    document.getElementById('dept-code').disabled = true;
    document.getElementById('dept-name').value = dept.name;
    document.getElementById('dept-type').value = dept.type;
    this.populateParentSelect(dept.parent_id);
    document.getElementById('dept-error').classList.remove('show');
    document.getElementById('dept-save-btn').textContent = 'Cập nhật';
    document.getElementById('dept-modal').classList.add('active');
  },

  populateParentSelect(selectedId) {
    const sel = document.getElementById('dept-parent');
    sel.innerHTML = '<option value="">— Gốc —</option>';
    this.departments.forEach(d => {
      sel.innerHTML += `<option value="${d.id}" ${d.id == selectedId ? 'selected' : ''}>${d.name} (${d.code})</option>`;
    });
  },

  closeModal() { document.getElementById('dept-modal').classList.remove('active'); },

  async save() {
    const editId = document.getElementById('dept-edit-id').value;
    const code = document.getElementById('dept-code').value.trim();
    const name = document.getElementById('dept-name').value.trim();
    const type = document.getElementById('dept-type').value;
    const parent_id = document.getElementById('dept-parent').value || null;
    const errorEl = document.getElementById('dept-error');

    if (!code || !name) { errorEl.textContent = 'Vui lòng nhập mã và tên'; errorEl.classList.add('show'); return; }
    try {
      const url = editId ? `/api/departments/${editId}` : '/api/departments';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, type, parent_id })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      this.closeModal();
      window.toast.success(editId ? 'Đã cập nhật đơn vị' : 'Đã tạo đơn vị');
      await this.loadData();
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.classList.add('show');
      window.toast.error(e.message);
    }
  },

  destroy() {}
};
