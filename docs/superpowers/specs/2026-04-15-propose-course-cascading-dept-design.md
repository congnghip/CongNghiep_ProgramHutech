# Propose Course — Cascading Khoa → Ngành Selector

## Summary

Form "Đề xuất học phần mới" trong Version Editor hiện chỉ có **một dropdown phẳng** liệt kê tất cả phòng ban (Khoa, Bộ môn, ROOT trộn lẫn). Người soạn CTĐT không thể chỉ định rõ học phần đề xuất thuộc **ngành nào trong khoa**, hoặc thuộc **toàn khoa** (không gắn ngành cụ thể). Spec này thay dropdown phẳng đó bằng **2 dropdown cascading Khoa → Ngành**, khớp với pattern đã có ở trang Courses chính, cho phép Ngành để trống khi học phần dùng chung cho cả khoa.

## Background

### Trạng thái hiện tại

[public/js/pages/version-editor.js:817-820](public/js/pages/version-editor.js#L817-L820) — modal "Đề xuất học phần mới":

```html
<div class="input-group" style="flex:1;margin:0;">
  <label>Khoa/Viện</label>
  <select id="pc-dept"><option value="">— Chọn —</option></select>
</div>
```

Dropdown này load **toàn bộ** `/api/departments` (KHOA + VIEN + BO_MON + ROOT) vào cùng 1 list, không phân cấp.

[public/js/pages/version-editor.js:871](public/js/pages/version-editor.js#L871) — payload save:
```js
department_id: document.getElementById('pc-dept').value || null,
```

### Pattern tham chiếu (đã tồn tại)

[public/js/pages/courses.js:120-147](public/js/pages/courses.js#L120-L147) — trang Courses chính dùng cascading Khoa → Ngành:

- **Khoa** lọc `departments.filter(d => ['KHOA','VIEN','TRUNG_TAM','PHONG'].includes(d.type))`.
- **Ngành** lọc `departments.filter(d => d.parent_id == khoaId && d.type === 'BO_MON')`.
- Default option của Ngành là `— Toàn khoa —` (value rỗng).
- Khi đổi Khoa → repopulate Ngành và reset `nganhSel.value = ''`.

[public/js/pages/courses.js:164](public/js/pages/courses.js#L164) — payload save:
```js
department_id: document.getElementById('c-nganh').value || document.getElementById('c-khoa').value || null,
```

### Mục tiêu

Đưa cùng pattern Khoa → Ngành (với "Toàn khoa" là option mặc định) vào modal "Đề xuất học phần mới" để:
- Người soạn chỉ định rõ học phần đề xuất gắn với ngành cụ thể, **hoặc** chọn "— Toàn khoa —" khi học phần phục vụ chung cho cả khoa.
- UX nhất quán giữa 2 form quản lý học phần.

## Approach

**Phương án đã chọn: port nguyên pattern cascading từ `courses.js` sang modal đề xuất, không trừu tượng hoá thành helper dùng chung.**

Chỉ sửa **1 file** (`public/js/pages/version-editor.js`). Backend `POST /api/versions/:vId/proposed-courses` đã nhận `department_id` đơn lẻ (không phân biệt KHOA/BO_MON), nên **không cần đổi schema, API, hay db.js**.

Đã loại phương án trừu tượng hoá thành `utils/dept-cascade.js` vì:
- Project chưa có thư mục `utils/` cho frontend → phá pattern hiện có.
- Mở rộng scope ngoài yêu cầu (refactor `courses.js`).
- Khi nào có chỗ thứ 3 dùng cascading thì DRY sau cũng được.

## UI Changes

### Modal `showProposeCourseModal()` — replace dropdown phẳng

Trong cùng `flex-row` (hoặc bố cục tương đương), thay 1 ô bằng 2 ô:

```html
<div class="flex-row">
  <div class="input-group" style="flex:1;margin:0;">
    <label>Khoa/Viện</label>
    <select id="pc-khoa"><option value="">— Chọn —</option></select>
  </div>
  <div class="input-group" style="flex:1;margin:0;">
    <label>Ngành</label>
    <select id="pc-nganh"><option value="">— Toàn khoa —</option></select>
  </div>
</div>
```

### Logic populate (sau khi `fetch('/api/departments')` về)

```js
fetch('/api/departments').then(r => r.json()).then(depts => {
  const list = Array.isArray(depts) ? depts : [];
  const khoaSel = document.getElementById('pc-khoa');
  const nganhSel = document.getElementById('pc-nganh');

  const khoaList = list.filter(d => ['KHOA','VIEN','TRUNG_TAM','PHONG'].includes(d.type));
  khoaSel.innerHTML = '<option value="">— Chọn —</option>' +
    khoaList.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

  const populateNganh = (khoaId) => {
    const children = list.filter(d => d.parent_id == khoaId && d.type === 'BO_MON');
    nganhSel.innerHTML = '<option value="">— Toàn khoa —</option>' +
      children.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  };
  khoaSel.onchange = () => { populateNganh(khoaSel.value); nganhSel.value = ''; };
  populateNganh(null);
});
```

### Save payload (`saveProposedCourse`)

Thay:
```js
department_id: document.getElementById('pc-dept').value || null,
```
bằng:
```js
department_id: document.getElementById('pc-nganh').value || document.getElementById('pc-khoa').value || null,
```

## Behaviour Matrix

| User chọn | `department_id` lưu vào DB |
|---|---|
| Không chọn Khoa, không chọn Ngành | `NULL` |
| Chỉ chọn Khoa, Ngành = "— Toàn khoa —" | `khoa.id` |
| Chọn Khoa + Ngành cụ thể | `nganh.id` (BO_MON) |
| Đổi Khoa giữa chừng | Ngành tự reset về "— Toàn khoa —" |
| Khoa được chọn không có BO_MON con | Ngành chỉ có "— Toàn khoa —", vẫn submit được |

## Out of Scope

- Refactor `courses.js` để dùng helper chung.
- Validation server-side cho `department_id` (hiện đã chấp nhận NULL/bất kỳ ID hợp lệ).
- Pre-select Khoa theo phòng ban của user đang đăng nhập.
- Đổi UI tab "Học phần" để hiển thị Khoa/Ngành của HP đề xuất (nếu cần, làm spec riêng).

## Manual Test Plan

(Project không có test framework — verify thủ công trên dev server.)

1. Chạy `make dev`, login với user có permission `courses.propose`, mở Version Editor (version ở status `draft`) → tab "Học phần" → click "Đề xuất HP mới".
2. Verify dropdown **Khoa/Viện** chỉ liệt kê các phòng ban type KHOA/VIEN/TRUNG_TAM/PHONG (không có BO_MON, không có ROOT).
3. Verify dropdown **Ngành** ban đầu chỉ có option "— Toàn khoa —".
4. Chọn 1 Khoa → dropdown Ngành load các BO_MON con của khoa đó.
5. Đổi sang Khoa khác → Ngành reset về "— Toàn khoa —" và load lại theo Khoa mới.
6. **Case A — chỉ chọn Khoa**: nhập tên HP, chọn Khoa, để Ngành = "— Toàn khoa —", submit. Verify trong DB:
   ```sql
   SELECT id, name, department_id, is_proposed FROM courses ORDER BY id DESC LIMIT 1;
   ```
   `department_id` = ID của Khoa.
7. **Case B — chọn cả Khoa + Ngành**: tương tự, chọn thêm 1 Ngành. Verify `department_id` = ID của BO_MON.
8. **Case C — không chọn gì**: submit với cả 2 dropdown để rỗng. Verify `department_id IS NULL`.
9. Verify HP đề xuất hiển thị đúng trong tab Học phần với badge "Đề xuất" và "Chờ cấp mã".
