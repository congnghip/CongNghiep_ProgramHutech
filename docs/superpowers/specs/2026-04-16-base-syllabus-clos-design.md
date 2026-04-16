# Base Syllabus CLOs

## Summary

Thêm CLO (Course Learning Outcomes) vào đề cương cơ bản (base syllabus). CLO mô tả "HP này dạy gì" → thuộc về HP, không phải phiên bản CTĐT. Khi base syllabus được dùng trong 1 CTĐT cụ thể, CLOs được copy sang version syllabus và user map chúng với PLOs của CTĐT đó.

## Background

### Hiện trạng

- **`course_clos`** ([db.js:196-201](../../../db.js#L196-L201)): `id`, `version_course_id` (FK → `version_courses`), `code`, `description`. CLOs gắn với phiên bản cụ thể.
- **`clo_plo_map`** ([db.js:204-209](../../../db.js#L204-L209)): many-to-many giữa CLOs và PLOs, có `contribution_level`.
- **`course_base_syllabi`** ([db.js:226-233](../../../db.js#L226-L233)): `content` JSONB chứa thông tin chung (đề cương khung, đánh giá, tài liệu). **Không có CLO**.
- **Base syllabus editor** ([public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js)): 4 tab (Thông tin chung, Đề cương chi tiết, Đánh giá, Tài liệu). Không có tab CLO.
- **Version syllabus editor** ([public/js/pages/syllabus-editor.js](../../../public/js/pages/syllabus-editor.js)): 6 tab (General, **CLO**, CLO↔PLO, Course Outline, Assessment, Resources). Tab CLO quản lý `course_clos` per version_course.

### Copy flow hiện tại (base → version)

Khi tạo version syllabus ([server.js:1754-1773](../../../server.js#L1754-L1773)):
1. Nếu course có `course_base_syllabi` → copy `content` JSONB vào `version_syllabi.content`.
2. **CLOs KHÔNG được copy** — tab CLO trống, GV phải tạo thủ công.

### Vấn đề

CLOs về bản chất mô tả "khóa học này dạy gì" — thuộc tính cấp course, không thay đổi giữa các CTĐT. Nhưng hiện tại GV phải tạo lại CLOs mỗi khi HP được dùng trong CTĐT mới. Base syllabus không lưu CLOs → mất consistency, mất thời gian.

## Approach

- Bảng SQL mới `base_syllabus_clos` (tách biệt với `course_clos`).
- Base syllabus editor thêm tab CLO mới (code + description + bloom_level).
- Khi tạo version syllabus từ base: one-time copy `base_syllabus_clos` → `course_clos`.
- Thêm cột `bloom_level` vào `course_clos` để giữ bloom khi copy.
- CLO-PLO mapping vẫn version-specific (không có ở base).

## Schema Changes

### Bảng mới: `base_syllabus_clos`

```sql
CREATE TABLE IF NOT EXISTS base_syllabus_clos (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  code VARCHAR(20),
  description TEXT,
  bloom_level INT DEFAULT 1
);
```

- 1 course → nhiều CLOs.
- `bloom_level` INT 1-6: 1=Nhớ, 2=Hiểu, 3=Áp dụng, 4=Phân tích, 5=Đánh giá, 6=Sáng tạo.
- `ON DELETE CASCADE` — xóa course → xóa base CLOs.

### Thêm cột vào `course_clos`

```sql
ALTER TABLE course_clos ADD COLUMN IF NOT EXISTS bloom_level INT DEFAULT 1;
```

Để khi copy từ base → version, bloom level được bảo toàn. Version syllabus editor cũng hiển thị/sửa bloom.

## API

### Base syllabus CLO routes

| Route | Method | Permission | Mô tả |
|---|---|---|---|
| `GET /api/courses/:courseId/base-syllabus/clos` | GET | `courses.view` | Lấy danh sách base CLOs |
| `POST /api/courses/:courseId/base-syllabus/clos` | POST | `courses.edit` | Tạo base CLO mới |
| `PUT /api/base-clos/:id` | PUT | `courses.edit` | Sửa base CLO |
| `DELETE /api/base-clos/:id` | DELETE | `courses.edit` | Xóa base CLO |

Payload POST/PUT: `{ code, description, bloom_level }`.

Response GET: `[{ id, course_id, code, description, bloom_level }]`.

### Sửa route tạo version syllabus

Route hiện tại `POST /api/versions/:vId/syllabi` ([server.js:1754-1773](../../../server.js#L1754-L1773)) — sau khi INSERT `version_syllabi`, thêm step copy base CLOs:

```sql
INSERT INTO course_clos (version_course_id, code, description, bloom_level)
SELECT vc.id, bsc.code, bsc.description, bsc.bloom_level
FROM base_syllabus_clos bsc
JOIN version_courses vc ON vc.course_id = bsc.course_id AND vc.version_id = $versionId
WHERE bsc.course_id = $courseId;
```

Chỉ copy khi base có CLOs. Nếu không → tab CLO trống (như hiện tại).

### Sửa route tạo version syllabus từ assignment

Route `POST /api/syllabus-assignments/:id/syllabi` ([server.js:2352-2366](../../../server.js#L2352-L2366)) — cùng logic: sau INSERT version_syllabi, copy base CLOs.

## UI Changes

### Base syllabus editor — Tab CLO mới

Thêm tab "CLO" vào base syllabus editor (file [base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js)). Hiện có 4 tab (indices 0-3); tab CLO mới ở **index 1** (đẩy các tab cũ sang 2, 3, 4).

Tab mới gồm:
- Bảng: Mã | Mô tả | Bloom Level | Hành động (Sửa, Xóa)
- Bloom Level hiển thị: badge text (ví dụ "3 - Áp dụng")
- Nút "Thêm CLO" → inline form hoặc modal nhỏ với 3 trường: code, description, bloom_level dropdown
- CRUD gọi API routes ở trên

### Version syllabus editor — Bloom level

Tab CLO hiện tại ([syllabus-editor.js](../../../public/js/pages/syllabus-editor.js) tab 1) đã CRUD `course_clos`. Thêm:
- Cột **Bloom Level** trong bảng CLO (badge hoặc dropdown inline).
- Khi thêm/sửa CLO: thêm dropdown bloom_level (1-6).
- API CRUD CLO hiện tại (`POST/PUT /api/syllabi/:sId/clos`, `PUT/DELETE /api/clos/:id`) cần chấp nhận + trả về `bloom_level`.

### Không đổi

- Tab CLO↔PLO (tab 2 version syllabus editor) — giữ nguyên. Vẫn version-specific.
- Logic copy version (nhân bản khóa) — giữ nguyên (không copy course_clos giữa versions).
- `clo_plo_map` schema.

## Copy Flow After Change

```
Base Syllabus (course_base_syllabi)
  └── base_syllabus_clos (CLO1, CLO2, CLO3...)
                │
                │  one-time copy khi tạo version syllabus
                ▼
Version Syllabus (version_syllabi)
  └── course_clos (CLO1, CLO2, CLO3 — copy từ base)
        └── clo_plo_map (user map CLO → PLO của CTĐT đó)
```

Sau khi copy:
- Sửa base CLOs → KHÔNG ảnh hưởng version đã tạo.
- Sửa version CLOs → KHÔNG ảnh hưởng base.

## Edge Cases

| Case | Hành vi |
|---|---|
| Base chưa có CLO → tạo version syllabus | Không copy CLO, tab CLO trống |
| Base có 5 CLOs → tạo version syllabus | 5 CLOs auto-copy vào course_clos, bloom_level giữ nguyên |
| Sửa base CLOs sau khi tạo version | Version không bị ảnh hưởng (one-time copy) |
| Xóa course | CASCADE xóa base_syllabus_clos + course_clos (thông qua version_courses CASCADE) |
| Version syllabus đã tồn tại (tạo lần 2?) | API hiện chặn duplicate — không xảy ra |
| HP đề xuất (is_proposed=true) | Vẫn có thể có base syllabus + CLOs; copy bình thường |
| Base CLO có code trùng | Cho phép — code chỉ là label, không UNIQUE |

## Out of Scope

- CLO-PLO mapping ở base syllabus (vì chưa biết CTĐT nào).
- Sync CLOs từ base → version sau khi đã tạo (user chọn one-time copy).
- Copy `course_clos` khi nhân bản khóa (copy version) — giữ nguyên hành vi hiện tại.
- Migration CLOs hiện có trong `course_clos` ngược lại lên base (không tự tạo base CLOs từ version CLOs).

## Manual Test Plan

### Test 1 — Base syllabus editor: CRUD CLO

1. Mở trang Courses → click "ĐC cơ bản" của 1 HP.
2. Thấy tab mới "CLO" (tab 1).
3. Click "Thêm CLO" → nhập code="CLO1", description="Trình bày được...", bloom=2 (Hiểu) → Save → CLO xuất hiện trong bảng.
4. Sửa CLO1 → đổi bloom sang 3 → Save → cập nhật đúng.
5. Thêm CLO2, CLO3.
6. Xóa CLO3 → confirm → biến mất.
7. DB: `SELECT * FROM base_syllabus_clos WHERE course_id = <courseId>;` → 2 rows (CLO1, CLO2).

### Test 2 — Auto-populate CLOs khi tạo version syllabus

1. HP có base syllabus với 2 base CLOs (CLO1, CLO2).
2. Mở Version Editor → tab Đề cương → HP đó chưa có syllabus → click "Soạn" / tạo syllabus.
3. Mở syllabus editor mới tạo → tab CLO.
4. Expected: CLO1 và CLO2 đã có sẵn (auto-copy từ base), bloom_level đúng.
5. DB: `SELECT * FROM course_clos WHERE version_course_id = <vcId>;` → 2 rows match base.

### Test 3 — One-time copy (không sync)

1. Sau Test 2, quay lại base syllabus editor → sửa CLO1 description → Save.
2. Quay lại version syllabus editor → tab CLO → CLO1 vẫn mô tả CŨ (không đổi).

### Test 4 — Base không có CLO

1. HP khác không có base syllabus CLOs (hoặc không có base syllabus).
2. Tạo version syllabus → tab CLO trống (0 CLO).
3. Vẫn thêm CLO thủ công được (hành vi hiện tại giữ nguyên).

### Test 5 — Bloom level ở version syllabus editor

1. Mở version syllabus editor → tab CLO → thấy cột Bloom Level cho mỗi CLO.
2. Thêm CLO mới → có dropdown bloom level (1-6).
3. Sửa CLO → đổi bloom → Save → cập nhật.

### Test 6 — CLO↔PLO mapping (regression)

1. Sau auto-populate CLOs, tab CLO↔PLO hiển thị ma trận CLOs × PLOs → user map → save → hoạt động bình thường.
