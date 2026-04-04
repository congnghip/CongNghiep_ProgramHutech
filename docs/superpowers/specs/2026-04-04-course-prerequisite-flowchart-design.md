# Sơ đồ tiến trình học & Quan hệ tiên quyết/song hành

**Date:** 2026-04-04

## Problem

Bảng `version_courses` đã có cột `prerequisite_course_ids` và `corequisite_course_ids` (INT arrays) nhưng chưa có UI nào để xem hay chỉnh sửa. Dữ liệu chỉ được populate từ import Word. Người dùng không thể hình dung tiến trình học của CTDT.

## Solution

Thêm tab "Sơ đồ tiến trình" trong Version Editor với:
1. Sơ đồ flowchart trái→phải theo học kỳ, thể hiện các học phần và quan hệ tiên quyết/song hành
2. Tương tác click-nối để tạo/xóa quan hệ trực tiếp trên sơ đồ

## Requirements

- Tab mới "Sơ đồ tiến trình" trong Version Editor, cùng cấp với "Học phần", "Kế hoạch GD"...
- Layout trái→phải: mỗi cột là 1 học kỳ, các học phần xếp dọc trong cột
- Dagre tự động tính toán vị trí node để tránh chồng chéo
- Mũi tên tiên quyết: nét liền xanh (#2563eb) với arrowhead
- Mũi tên song hành: nét đứt cam (#ea580c) với arrowhead
- Click-nối để tạo quan hệ: chọn mode trước (toolbar) → click nguồn → click đích
- Click mũi tên (mode xóa) để xóa liên kết
- Zoom in/out
- Scroll ngang cho nhiều học kỳ
- Phong cách Notion: tối giản, node là card trắng viền nhạt, hover highlight

## Design

### 1. Libraries

- **dagre** (CDN): tính toán layout graph tự động — xác định vị trí x,y cho mỗi node sao cho arrows không chồng chéo
- **SVG thuần**: vẽ mũi tên nối giữa các node (tự kiểm soát style hoàn toàn, không dùng LeaderLine)

Cả 2 library load qua CDN tag trong `index.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>
```

### 2. Database — không thay đổi

Dùng lại cột đã có:
- `version_courses.prerequisite_course_ids INT[]` — array of `version_courses.id`
- `version_courses.corequisite_course_ids INT[]` — array of `version_courses.id`

### 3. API — `server.js`

#### Endpoint mới

**`PUT /api/versions/:vId/course-relations`**
- Middleware: `authMiddleware`, `requireDraft('vId')`
- Body: `{ version_course_id: number, prerequisite_course_ids: number[], corequisite_course_ids: number[] }`
- Logic: `UPDATE version_courses SET prerequisite_course_ids = $1, corequisite_course_ids = $2 WHERE id = $3 AND version_id = $4`
- Validate: tất cả IDs trong arrays phải thuộc cùng version_id
- Response: `{ success: true }`

#### Sửa endpoint hiện tại

**`GET /api/versions/:vId/courses`** (đã có)
- Đảm bảo response bao gồm `prerequisite_course_ids` và `corequisite_course_ids` trong mỗi course object
- Kiểm tra: query hiện tại đã SELECT từ `version_courses` nên có thể đã bao gồm. Nếu chưa, thêm vào.

### 4. Frontend

#### 4a. File mới: `public/js/pages/course-flowchart.js`

Module riêng cho sơ đồ tiến trình (tách khỏi `version-editor.js` vì logic vẽ sơ đồ phức tạp).

**Data flow:**
1. Nhận danh sách courses từ `GET /api/versions/:vId/courses` (đã có data prerequisite/corequisite)
2. Xây dựng dagre graph: mỗi course là 1 node, rank theo `semester`
3. Dagre tính toán vị trí → render HTML nodes + SVG arrows

**Rendering:**
- Container div với `overflow-x: auto` (scroll ngang)
- Mỗi node là `<div>` absolute-positioned theo tọa độ dagre, hiện: tên HP, mã HP, số TC
- SVG overlay layer phía trên, vẽ `<path>` cubic bezier cho mỗi edge
- Legend bar phía dưới sơ đồ

**Tương tác — Mode-based toolbar:**
- Mode mặc định: "Xem" — hover highlight node, click không làm gì
- Mode "Thêm tiên quyết": click node 1 (highlight xanh) → click node 2 → gọi API save → re-render arrows
- Mode "Thêm song hành": tương tự, highlight cam
- Mode "Xóa liên kết": click vào mũi tên → confirm → gọi API remove → re-render
- ESC hoặc click toolbar button lần nữa để thoát mode

**Zoom:**
- CSS `transform: scale()` trên container
- Nút + / - trên toolbar
- Giữ nguyên scroll position khi zoom

#### 4b. Tích hợp vào Version Editor

Trong `version-editor.js`:
- Thêm tab mới `flowchart` vào danh sách tabs
- Tab label: "Sơ đồ tiến trình"
- Render gọi `CourseFlowchart.render(container, versionId, courses)`

### 5. Node Design (Notion style)

```
┌─────────────────────┐
│  Tiếng Anh 1        │   ← font-weight: 600, 13px
│  ENG101 · 3 TC      │   ← text-muted, 11px
└─────────────────────┘
```

- Background: white
- Border: 1.5px solid #e2e8f0
- Border-radius: 8px
- Padding: 10px 12px
- Shadow: 0 1px 2px rgba(0,0,0,0.04)
- Hover: border-color #2563eb, box-shadow 0 2px 8px rgba(37,99,235,0.15)
- Selected (đang nối): border 2px solid #2563eb (tiên quyết) hoặc #ea580c (song hành), background tinted

### 6. Arrow Design

**Tiên quyết:**
- Stroke: #2563eb, 2px, solid
- Path: cubic bezier từ cạnh phải node nguồn → cạnh trái node đích
- Arrowhead: filled triangle marker

**Song hành:**
- Stroke: #ea580c, 2px, dashed (6 4)
- Path: tương tự
- Arrowhead: filled triangle marker

### 7. Toolbar

```
[🔍+] [🔍-] | [+ Tiên quyết] [+ Song hành] [✕ Xóa liên kết] | "Click nguồn → Click đích..."
```

- Active mode button: viền đậm + background tinted
- Hint text cập nhật theo mode: "Click học phần nguồn...", "Click học phần đích...", "Click mũi tên để xóa..."

## Scope exclusions

- Không drag-and-drop node để thay đổi vị trí (dagre auto-layout)
- Không thay đổi semester của học phần từ sơ đồ (dùng tab Học phần/Kế hoạch GD)
- Không validation logic phức tạp (ví dụ: phát hiện circular dependency) — chỉ validate cùng version
- Không export sơ đồ ra hình ảnh
