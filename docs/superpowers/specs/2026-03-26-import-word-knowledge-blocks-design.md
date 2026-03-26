# Import Word — Trích khối kiến thức từ bảng chi tiết

**Date:** 2026-03-26
**Status:** Approved

## Mục tiêu

Khi import Word, bỏ qua bảng "Cấu trúc chương trình dạy học" (tổng quát), thay vào đó trích khối kiến thức trực tiếp từ bảng "Chương trình đào tạo chi tiết" và tự động gán HP vào khối tương ứng.

## Cấu trúc bảng chi tiết trong Word

Bảng "Chương trình đào tạo chi tiết" có các hàng xen kẽ giữa tiêu đề khối và HP:

```
Row: KIẾN THỨC GIÁO DỤC ĐẠI CƯƠNG (44 TC)           ← Level 1 (ALL CAPS, merged, no mã HP)
Row: I.01 | POS104 | Triết học Mác - Lênin | 3 | ... ← HP thuộc khối trên
...
Row: KIẾN THỨC GIÁO DỤC CHUYÊN NGHIỆP (81 TC)       ← Level 1
Row: II.1. Kiến thức bắt buộc (72 TC)                 ← Level 2 (prefix II.x., no mã HP)
Row: II.1.01 | CHN107 | Tiếng Trung – Nghe 1 | ...    ← HP
...
Row: II.2. Kiến thức tự chọn (9 TC)                   ← Level 2
Row: Nhóm 1: Tiếng Trung thương mại                   ← Level 3 (prefix "Nhóm")
Row: II.2.1.01 | CHN135 | Thư tín thương mại | ...    ← HP
...
Row: KIẾN THỨC KHÔNG TÍCH LŨY                         ← Level 1
Row: III.1. Giáo dục thể chất (...)                    ← Level 2
Row: Nhóm 1                                           ← Level 3
Row: III.1.1.01 | PHT304 | Bóng chuyền 1 | ...        ← HP
```

## Quyết định thiết kế

- Trích khối kiến thức từ bảng chi tiết (1 nguồn duy nhất) thay vì bảng "Cấu trúc" riêng
- Mỗi HP được gán vào khối gần nhất phía trên nó trong bảng (khối cuối cùng gặp trước HP)
- Bỏ gọi `extractKnowledgeBlocks` cũ (bảng "Cấu trúc chương trình dạy học")
- Frontend import không thay đổi

## 1. Word Parser (`word-parser.js`)

### 1.1 Sửa `extractCourses`

Khi duyệt từng hàng trong bảng chi tiết, nhận diện hàng tiêu đề khối:

**Quy tắc nhận diện:**
- **Level 1:** Hàng ALL CAPS (hoặc hầu hết caps), merged cells (cột 1 = cột 2 = cột 3), không có mã HP ở cột 2
- **Level 2:** Bắt đầu bằng prefix dạng la mã+số (`II.1.`, `II.2.`, `III.1.`, `III.2.`), không có mã HP ở cột 2
- **Level 3:** Bắt đầu bằng `Nhóm` (vd: `Nhóm 1:`, `Nhóm 2`), không có mã HP ở cột 2
- **HP thường:** Có mã HP hợp lệ ở cột 2 (chứa chữ + số, vd: `POS104`, `CHN107`)

**Trạng thái khi duyệt:**
- Duy trì stack `currentBlocks` = `[level1Name, level2Name, level3Name]`
- Khi gặp hàng level 1 → reset stack, set `currentBlocks[0]`
- Khi gặp hàng level 2 → set `currentBlocks[1]`, clear `currentBlocks[2]`
- Khi gặp hàng level 3 → set `currentBlocks[2]`
- Khi gặp HP → gán `knowledge_block_name` = khối sâu nhất trong stack (level 3 > level 2 > level 1)

**Output bổ sung:**
- Mỗi course trả thêm: `knowledge_block_name` (string)
- Hàm trả thêm: `knowledgeBlocks` array

```js
// knowledgeBlocks output:
[
  { name: "Kiến thức giáo dục đại cương", parent_name: null, level: 1, total_credits: 44, sort_order: 1 },
  { name: "Kiến thức giáo dục chuyên nghiệp", parent_name: null, level: 1, total_credits: 81, sort_order: 2 },
  { name: "Kiến thức bắt buộc", parent_name: "Kiến thức giáo dục chuyên nghiệp", level: 2, total_credits: 72, sort_order: 3 },
  { name: "Kiến thức tự chọn", parent_name: "Kiến thức giáo dục chuyên nghiệp", level: 2, total_credits: 9, sort_order: 4 },
  { name: "Nhóm 1: Tiếng Trung thương mại", parent_name: "Kiến thức tự chọn", level: 3, sort_order: 5 },
  ...
  { name: "Kiến thức không tích lũy", parent_name: null, level: 1, total_credits: 0, sort_order: N },
]
```

### 1.2 Bỏ qua `extractKnowledgeBlocks` cũ

Trong `parseWordFile`, không gọi `extractKnowledgeBlocks(tables[roles.knowledgeBlocks])` nữa. Thay vào đó dùng `knowledgeBlocks` trả từ `extractCourses`.

## 2. Server — Import Save Route (`server.js`)

### 2.1 Tạo khối kiến thức khi save

Trong `POST /api/import/save`, khi xử lý `knowledgeBlocks`:
- Insert khối theo thứ tự `sort_order` (đảm bảo parent tạo trước child)
- Lưu `level` vào cột `level` của bảng `knowledge_blocks`
- Dùng `parent_name` để resolve `parent_id` qua map tên → id

### 2.2 Gán `knowledge_block_id` cho version_courses

Sau khi tạo khối và version_courses:
- Duyệt `courses`, mỗi course có `knowledge_block_name`
- Tìm block id tương ứng qua map tên → id
- UPDATE `version_courses SET knowledge_block_id = $1 WHERE id = $2`

## Ngoài phạm vi

- Không sửa frontend import (`import-word.js`)
- Không sửa logic parse các section khác (PLO, PO, PI, v.v.)
- Không sửa tab "Khối KT" trong version editor (đã có từ feature trước)
