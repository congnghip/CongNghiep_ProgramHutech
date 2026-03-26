# Nhóm Học Phần theo Khối Kiến Thức — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Mục tiêu

Cho phép nhóm các học phần (HP) trong mỗi version CTDT theo cấu trúc cây khối kiến thức 3 cấp:

```
(Level 1) Kiến thức giáo dục đại cương
(Level 1) Kiến thức giáo dục chuyên nghiệp
  (Level 2) Kiến thức bắt buộc
  (Level 2) Kiến thức tự chọn
    (Level 3) Nhóm tự chọn 1   ← người dùng tạo
    (Level 3) Nhóm tự chọn 2
    ...
(Level 1) Kiến thức không tích lũy
```

## Quyết định thiết kế

- Tận dụng bảng `knowledge_blocks` có sẵn (đã có parent_id cho phân cấp)
- Mở rộng lên tối đa 3 level (thêm cột `level`)
- Liên kết HP → khối qua cột FK `knowledge_block_id` trên `version_courses` (quan hệ 1-nhiều: mỗi HP chỉ thuộc 1 khối)
- Tín chỉ tính tự động bằng SUM từ HP đã gán
- UI mở rộng tab "Khối KT" hiện có trong version editor
- 3 khối chính + 2 nhóm con (Bắt buộc, Tự chọn) được tạo mặc định khi tạo version mới; nhóm level 3 do người dùng tạo

## 1. Database Changes

### 1.1 Mở rộng bảng `knowledge_blocks`

```sql
ALTER TABLE knowledge_blocks ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
```

- `level = 1`: Khối chính (GDĐC, GDCN, Không tích lũy)
- `level = 2`: Nhóm (Bắt buộc, Tự chọn)
- `level = 3`: Nhóm con (do người dùng tạo, vd: Nhóm TC 1, 2, 3, 4)

### 1.2 Liên kết HP với khối kiến thức

```sql
ALTER TABLE version_courses
  ADD COLUMN IF NOT EXISTS knowledge_block_id INT
  REFERENCES knowledge_blocks(id) ON DELETE SET NULL;
```

- Mỗi HP trong version chỉ thuộc 1 khối duy nhất
- `ON DELETE SET NULL`: xóa khối thì HP mất liên kết (không bị xóa)

### 1.3 Seed data mặc định

Khi tạo version mới, tự động INSERT:

| sort_order | level | name | parent |
|---|---|---|---|
| 1 | 1 | Kiến thức giáo dục đại cương | NULL |
| 2 | 1 | Kiến thức giáo dục chuyên nghiệp | NULL |
| 3 | 2 | Kiến thức bắt buộc | → "GDCN" |
| 4 | 2 | Kiến thức tự chọn | → "GDCN" |
| 5 | 1 | Kiến thức không tích lũy | NULL |

### 1.4 Tín chỉ

Các cột `total_credits`, `required_credits`, `elective_credits` trên `knowledge_blocks` được giữ nguyên nhưng giá trị được **tính tự động** bằng SUM credits từ HP đã gán. Với khối cha, tổng tín chỉ là cộng dồn đệ quy từ các khối con.

## 2. API Changes

### 2.1 Knowledge Blocks CRUD

| Method | Route | Mô tả |
|---|---|---|
| GET | `/api/versions/:vId/knowledge-blocks` | Trả cây khối kiến thức + HP đã gán mỗi khối + tổng TC tự động |
| POST | `/api/versions/:vId/knowledge-blocks` | Tạo khối mới (validate level <= 3, parent phải tồn tại) |
| PUT | `/api/knowledge-blocks/:id` | Sửa tên, sort_order |
| DELETE | `/api/knowledge-blocks/:id` | Xóa khối (SET NULL cho HP liên quan) |

### 2.2 Gán HP vào khối

| Method | Route | Mô tả |
|---|---|---|
| PUT | `/api/knowledge-blocks/:id/assign-courses` | Body: `{ courseIds: [1, 2, 3] }` |

Validation:
- Chỉ gán vào khối leaf (không có con)
- Nếu HP đã thuộc khối khác, tự động gỡ khối cũ trước khi gán vào khối mới
- Version phải ở trạng thái `draft`

### 2.3 Seed khi tạo version

Route `POST /api/programs/:id/versions` — sau khi tạo version, tự động INSERT 5 khối mặc định với cấu trúc parent-child như mục 1.3.

## 3. Frontend — Tab "Khối KT"

### 3.1 Hiển thị cây

- Cây 3 cấp dạng accordion/collapse
- Level 1: header chính (bold, background nhạt)
- Level 2: nhóm lồng bên trong level 1
- Level 3: nhóm con lồng bên trong level 2
- Mỗi node hiển thị: **tên khối** + **tổng tín chỉ** (tự động)
- Mỗi khối leaf hiển thị danh sách HP đã gán: mã HP, tên HP, số TC

### 3.2 Gán HP vào khối

- Click vào khối → mở panel/modal danh sách tất cả HP của version
- HP đã gán khối khác: hiển thị mờ (disabled) + tên khối đang thuộc
- HP chưa gán: checkbox, tick chọn → lưu
- Sau khi lưu, tự động cập nhật tổng TC

### 3.3 Quản lý khối

- Nút "Thêm nhóm con" trên khối level 2 — tạo khối level 3
- Sửa tên khối (inline edit hoặc modal)
- Xóa khối: chỉ cho xóa khối do người dùng tạo (level 3), không xóa khối mặc định (level 1, 2)
- Kéo thả thay đổi thứ tự (sort_order)

### 3.4 Quyền và trạng thái

- Chỉ cho phép chỉnh sửa khi version ở trạng thái `draft` (dùng middleware `requireDraft`)
- Khi version không phải draft: UI ở chế độ read-only

## Ngoài phạm vi

- Không thay đổi tab "Học phần" — gán HP chỉ thực hiện qua tab "Khối KT"
- Không hỗ trợ nhiều-nhiều (1 HP thuộc nhiều khối)
- Không hỗ trợ quá 3 level
- Không thêm permission mới — dùng permission hiện có
