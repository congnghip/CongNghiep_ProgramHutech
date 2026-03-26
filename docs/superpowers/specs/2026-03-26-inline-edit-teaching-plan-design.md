# Inline Edit Kế Hoạch Giảng Dạy — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Mục tiêu

Cho phép chỉnh sửa inline kế hoạch giảng dạy (tab "Kế hoạch GD") với UX contenteditable — không hiện textbox, giữ nguyên giao diện bảng. Hỗ trợ chuyển HP sang học kỳ khác. Lưu tất cả thay đổi 1 lần qua bulk API.

## Quyết định thiết kế

- Dùng `contenteditable` trên các ô cho phép sửa — không dùng input/textbox
- Chỉ sửa được: Tiết LT, Tiết TH, Tiết ĐA, Tiết TT, Phần mềm, Đợt
- Không sửa được: Mã HP, Tên HP, TC, Đơn vị QL (thuộc master course)
- Chuyển học kỳ bằng dropdown `<select>` trên mỗi hàng HP
- Một nút toggle "Chỉnh sửa" ở header tab, bulk save toàn bộ 1 request
- Chỉ hiện khi version ở trạng thái draft

## 1. Database

### 1.1 Thêm unique constraint

Trong `db.js`, thêm sau CREATE TABLE `teaching_plan`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS teaching_plan_vc_unique ON teaching_plan(version_course_id);
```

Cần thiết cho ON CONFLICT UPSERT khi lưu.

## 2. API

### 2.1 Bulk save endpoint

| Method | Route | Middleware |
|--------|-------|-----------|
| PUT | `/api/versions/:vId/teaching-plan/bulk` | `authMiddleware`, `requireDraft('vId')` |

**Request body:**
```json
{
  "items": [
    {
      "version_course_id": 1,
      "semester": 2,
      "hours_theory": 45,
      "hours_practice": 15,
      "hours_project": 0,
      "hours_internship": 0,
      "software": "VS Code",
      "batch": "A"
    }
  ]
}
```

**Logic (trong 1 transaction):**
1. Validate tất cả `version_course_id` thuộc version `vId`
2. Duyệt từng item:
   - UPDATE `version_courses SET semester = $1 WHERE id = $2` nếu semester có giá trị
   - UPSERT `teaching_plan`: INSERT ... ON CONFLICT (version_course_id) DO UPDATE SET cho hours_theory, hours_practice, hours_project, hours_internship, software, batch
   - `total_hours` = `hours_theory + hours_practice + hours_project + hours_internship` (tự tính)
3. Trả về `{ success: true }`

## 3. Frontend — Tab "Kế hoạch GD"

### 3.1 Read-only mode (mặc định)

Giữ nguyên giao diện hiện tại. Khi `editable = true`, hiện nút "Chỉnh sửa" ở góc phải header.

### 3.2 Edit mode

Khi bấm "Chỉnh sửa":
- Nút đổi thành "Lưu" + "Hủy"
- Các ô Tiết LT, Tiết TH, Tiết ĐA, Tiết TT, Phần mềm, Đợt:
  - Thêm `contenteditable="true"`
  - Style: `outline: 1px dashed var(--border); padding: 2px 4px; border-radius: 3px;`
  - Ô có giá trị "—" (trống) đổi thành "" để dễ nhập
- Mỗi hàng HP hiện thêm `<select>` chọn Học kỳ (options 1-8), pre-selected theo HK hiện tại
  - Dropdown nhỏ gọn, không phá layout bảng
- Mỗi `<tr>` có `data-vc-id` attribute

### 3.3 Thu thập dữ liệu

Khi click "Lưu":
1. Duyệt tất cả `<tr>` có `data-vc-id`
2. Đọc `innerText.trim()` từ các ô contenteditable, parse thành số (parseInt) cho tiết
3. Đọc `.value` từ `<select>` học kỳ
4. Gửi `PUT /api/versions/:vId/teaching-plan/bulk` với mảng items
5. Nếu thành công: gọi `this.renderTab()` để refresh (sẽ re-group theo HK mới)
6. Nếu lỗi: alert thông báo lỗi

### 3.4 Hủy

Click "Hủy": gọi `this.renderTab()` để reset về dữ liệu gốc.

## Ngoài phạm vi

- Không cho thêm/xóa HP trong tab này (dùng tab "Học phần" cho việc đó)
- Không sửa Mã HP, Tên HP, TC, Đơn vị QL (thuộc master course)
- Không hỗ trợ drag & drop chuyển HK
- Không auto-save — phải bấm "Lưu" thủ công
