# Fix: Map "Đơn vị QL" từ DOCX sang department_id khi import học phần

**Ngày:** 2026-03-27
**Phạm vi:** `server.js` — route `/api/import/save`

## Vấn đề

Khi import file DOCX mô tả chương trình đào tạo, cột "Đơn vị QL" trong bảng kế hoạch giảng dạy chứa mã đơn vị riêng cho từng học phần (VD: `K.TQH`, `K.TA`, `TT.GDTC`). Tuy nhiên, tại Step 7 (upsert courses) trong `/api/import/save`, tất cả học phần đều bị gán cùng một `department_id` — là department_id chung của CTĐT chọn từ dropdown, không phải đơn vị quản lý riêng của từng HP.

Ngoài ra, `ON CONFLICT DO UPDATE` không cập nhật `department_id`, nên HP đã tồn tại cũng không được sửa.

## Giải pháp: Phương án 1 — Lookup từ teachingPlan trước khi upsert

### Data Flow

1. Thu thập mã đơn vị duy nhất từ `teachingPlan[].department` → `Set("K.TQH", "K.TA", ...)`
2. Batch query: `SELECT id, code, name FROM departments WHERE code = ANY($1)`
3. Build lookup: `deptLookup = { "K.TQH": { id: 5, name: "Khoa Trung Quốc học" }, ... }`
4. Build per-course map: `courseDeptMap = { "CHN108": 5, "ENC121": 8, ... }`
5. Mã không tìm thấy → push warning, HP fallback về `department_id` chung của CTĐT

### Thay đổi tại Step 7 (upsert courses)

- Thay `department_id` chung bằng `courseDeptMap[c.code] || department_id`
- Thêm `department_id = EXCLUDED.department_id` vào `ON CONFLICT DO UPDATE`
- Trước upsert: query course cũ kèm JOIN departments để lấy tên đơn vị cũ, nếu `department_id` cũ khác mới → push warning `dept_changed` với tên cũ và tên mới (lấy từ `deptLookup`)

### Cảnh báo (Warnings)

3 loại cảnh báo trả về trong response:

| Loại | Khi nào |
|------|---------|
| `dept_not_found` | Mã "Đơn vị QL" từ DOCX không khớp department nào trong DB |
| `dept_changed` | HP đã tồn tại với `department_id` khác → bị ghi đè |
| `dept_missing_in_docx` | HP không xuất hiện trong teachingPlan → không có thông tin "Đơn vị QL", dùng mặc định |

### Response format

Thêm trường `warnings` vào response object hiện tại:

```json
{
  "success": true,
  "program_id": 1,
  "version_id": 2,
  "summary": { "..." },
  "warnings": [
    { "type": "dept_changed", "course_code": "CHN108", "message": "HP \"CHN108\" đổi đơn vị từ 'Khoa CNTT' sang 'Khoa Trung Quốc học'." },
    { "type": "dept_not_found", "dept_code": "K.XYZ", "message": "Mã đơn vị \"K.XYZ\" không tồn tại trong hệ thống." }
  ]
}
```

### Vị trí chèn code

- **Step 6b mới** (giữa Step 6 và Step 7, ~line 2573): Build `deptLookup`, `courseDeptMap`, và warnings cho `dept_not_found`
- **Step 7 sửa** (~line 2576-2595): Check conflict + upsert với `newDeptId` + thêm `department_id` vào ON CONFLICT UPDATE
- **Response** (~line 2759): Thêm `warnings` vào object trả về

### Scope

- Chỉ sửa `server.js`
- Không sửa `word-parser.js` hay frontend
- Frontend có thể hiển thị warnings sau (không bắt buộc trong lần này)
