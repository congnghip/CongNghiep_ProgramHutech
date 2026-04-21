# Design: 3-Tier Program Hierarchy (Ngành / Khóa / CTDT Variant)

**Date:** 2026-04-21  
**Status:** Approved  

---

## Background

Hiện tại hệ thống dùng 2 tầng: `programs` (Ngành) → `program_versions` (Khóa). Yêu cầu mới: mỗi Khóa có thể có nhiều CTDT variant (ĐHCQ, Quốc Tế, Việt-Hàn, Việt-Nhật) — mỗi variant là một CTĐT độc lập về nội dung, approval workflow, và copy chain.

**Constraints xác nhận:**
- 4 variant không bắt buộc — mỗi ngành chỉ triển khai những variant nào thực sự có
- Nội dung (PLO, courses, v.v.) riêng hoàn toàn giữa các variant
- Approval chạy độc lập từng variant
- Copy chain theo chiều dọc: mỗi variant copy từ chính variant đó ở khóa liền trước (Option A)
- Mã ngành + tên ngành ở tầng Ngành; variant chỉ có `variant_type`, không có mã/tên riêng

---

## Domain Model

```
Ngành (Major) — programs
  └── Khóa (Cohort) — program_cohorts       [bảng mới]
        └── CTDT Variant — program_versions  [thêm cohort_id + variant_type]
              └── Nội dung: PLO, courses, syllabi, matrices, ...
```

- **Ngành** (`programs`): định danh ngành học — mã ngành, tên, khoa, bậc. Stable.
- **Khóa** (`program_cohorts`): nhóm một năm học cụ thể của một ngành. Entity tổ chức, không có nội dung riêng.
- **CTDT Variant** (`program_versions`): loại hình cụ thể trong khóa. Đơn vị approval, nội dung, và copy.

**`variant_type` values:**
- `'DHCQ'` — Đại học Chính quy
- `'QUOC_TE'` — Quốc Tế
- `'VIET_HAN'` — Việt - Hàn
- `'VIET_NHAT'` — Việt - Nhật

`training_mode` trên `programs` giữ nguyên nghĩa cũ (Chính quy / VLVH / Từ xa / Liên thông ở cấp ngành). Không tái sử dụng cho variant.

---

## Database Schema Changes

### Bảng mới: `program_cohorts`

```sql
CREATE TABLE IF NOT EXISTS program_cohorts (
  id            SERIAL PRIMARY KEY,
  program_id    INT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  academic_year VARCHAR(4) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, academic_year)
);
```

### Thay đổi `program_versions`

```sql
ALTER TABLE program_versions
  ADD COLUMN IF NOT EXISTS cohort_id INT REFERENCES program_cohorts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS variant_type VARCHAR(20)
    CHECK (variant_type IN ('DHCQ','QUOC_TE','VIET_HAN','VIET_NHAT'));

-- Sau khi backfill xong, thêm unique constraint:
CREATE UNIQUE INDEX IF NOT EXISTS uq_cohort_variant
  ON program_versions(cohort_id, variant_type)
  WHERE cohort_id IS NOT NULL AND variant_type IS NOT NULL;
```

**Giữ nguyên** `program_id` và `academic_year` trên `program_versions` trong giai đoạn transition để backward compat. Xóa ở Phase 4.

**Không thay đổi** bất kỳ bảng content nào (version_plos, version_courses, syllabi, mappings, assessment_plans, knowledge_blocks, syllabus_assignments, teaching_plan, notifications, approval_logs).

---

## Data Migration Strategy

Chạy idempotent trong `initDB()`, theo thứ tự:

**Bước 1:** `CREATE TABLE IF NOT EXISTS program_cohorts` (tự skip nếu đã có).

**Bước 2:** Backfill cohorts từ distinct pairs hiện có:
```sql
INSERT INTO program_cohorts (program_id, academic_year)
SELECT DISTINCT program_id, academic_year
FROM program_versions
WHERE cohort_id IS NULL
ON CONFLICT (program_id, academic_year) DO NOTHING;
```

**Bước 3:** Backfill `cohort_id` vào `program_versions`:
```sql
UPDATE program_versions pv
SET cohort_id = pc.id
FROM program_cohorts pc
WHERE pc.program_id = pv.program_id
  AND pc.academic_year = pv.academic_year
  AND pv.cohort_id IS NULL;
```

**Bước 4:** Backfill `variant_type` — tất cả rows cũ → `'DHCQ'`:
```sql
UPDATE program_versions
SET variant_type = 'DHCQ'
WHERE variant_type IS NULL;
```

**Bước 5:** Tạo unique index `uq_cohort_variant` (CREATE UNIQUE INDEX IF NOT EXISTS — idempotent).

**Pre-migration check** nên chạy trước (hoặc trong CI):
```sql
-- Kiểm tra duplicate (program_id, academic_year) tiềm ẩn:
SELECT program_id, academic_year, COUNT(*)
FROM program_versions
GROUP BY program_id, academic_year
HAVING COUNT(*) > 1;
-- Kết quả rỗng = safe to proceed
```

Không có data loss. Data cũ trở thành variant ĐHCQ của cohort tương ứng.

---

## API Changes

### Routes mới

```
GET    /api/programs/:pId/cohorts           — list cohorts của ngành
POST   /api/programs/:pId/cohorts           — tạo cohort mới
GET    /api/cohorts/:cId                    — chi tiết cohort + danh sách variants
GET    /api/cohorts/:cId/variants           — list variants của cohort
POST   /api/cohorts/:cId/variants           — tạo variant mới (body: {variant_type, copy_from_version_id?})
DELETE /api/cohorts/:cId                    — xóa cohort (chỉ khi tất cả variants là draft)
```

### Routes giữ nguyên (không đổi)

```
GET  /api/programs/:pId/versions  — vẫn hoạt động, response thêm cohort_id + variant_type
GET  /api/versions/:vId           — không đổi
PUT  /api/versions/:vId           — không đổi
DELETE /api/versions/:vId         — không đổi
POST /api/approval/submit         — không đổi
POST /api/approval/review         — không đổi
```

### Copy variant khi tạo mới

`POST /api/cohorts/:cId/variants` nhận `{ variant_type, copy_from_version_id? }`:
- Server validate `copy_from_version_id` phải có cùng `variant_type`
- Nếu không truyền `copy_from_version_id`, server tự tìm published version của cùng variant_type ở cohort liền trước và suggest (hoặc auto-copy nếu user confirm)
- Lock source giữ như hiện tại

---

## Frontend Navigation / UI Changes

### Navigation mới (4 tầng)

```
Programs list (Ngành)
  → Cohorts list (Khóa của ngành)
    → Variants panel (slot cho từng variant)
      → Version editor (nội dung CTDT)
```

### `programs.js`

- `viewVersions(programId)` → đổi thành `viewCohorts(programId)`
- Mỗi cohort row hiển thị: năm học + badge cho từng variant tồn tại (ĐHCQ ✓, Quốc Tế ✓, Việt-Nhật ✗...)
- Button "+ Tạo khóa" tạo `cohort` thay vì `version`

### Cohort detail panel (inline expand hoặc sub-view)

- Hiển thị tối đa 4 slot (render tất cả 4 variant, slot chưa có hiện button "+ Tạo")
- Mỗi variant card: tên variant, status badge, completion %, nút "Mở editor" / "Xóa"
- Khi click "+ Tạo" trên một slot, auto-suggest `copy_from` = cùng variant_type ở khóa liền trước

### `version-editor.js`

- Thêm breadcrumb: `Ngành > Khóa YYYY > [ĐHCQ / Quốc Tế / ...]`
- Không đổi nội dung editor

### `import-word.js`

- Bước review: thêm dropdown chọn `variant_type` (default: ĐHCQ)
- Save tạo: 1 program (nếu chưa có) + 1 cohort + 1 variant

---

## Copy / Approval Rules

### Copy chain

- Chiều dọc: ĐHCQ 2026 ← copy từ ĐHCQ 2025, Việt-Nhật 2026 ← copy từ Việt-Nhật 2025
- Source phải là `published` (như hiện tại)
- `copied_from_id` vẫn là FK `→ program_versions.id` — không đổi
- Lock source vẫn giữ khi clone
- Không có cross-variant copy tự động

### Approval

- Mỗi variant chạy pipeline độc lập: `draft → submitted → approved_khoa → approved_pdt → approved_bgh → published`
- `is_locked`, `status`, `is_rejected` per variant — không đổi
- `approval_logs.entity_id = version_id` — không đổi
- Không có "publish cả cohort" — từng variant publish riêng

---

## Impacted Files

**Thay đổi lớn:**
- `db.js` — schema `program_cohorts`, migration steps
- `public/js/pages/programs.js` — navigation flow, viewCohorts, cohort panel, variant slots

**Thay đổi trung bình:**
- `server.js` — thêm ~5 cohort routes, cập nhật POST version (nhận cohort_id + variant_type), cập nhật GET programs response
- `public/js/pages/import-word.js` — thêm variant_type dropdown, điều chỉnh save payload

**Thay đổi nhỏ:**
- `public/js/pages/version-editor.js` — breadcrumb + variant_type display
- `public/js/pages/dashboard.js` — optional: group pending by variant_type
- `public/js/pages/approval.js` — thêm variant_type vào display

**Không thay đổi:**
- Tất cả content editors (PLO, courses, syllabi, matrices, assessment)
- Approval workflow logic
- RBAC, notification system
- Export/render pipeline (`server/render/`)

---

## Risks

**R1 — Migration constraint dở dang:** Nếu crash giữa chừng, data inconsistent. Mitigation: wrap migration trong transaction, test trên DB backup trước khi deploy.

**R2 — Duplicate data cũ:** Nếu có row vi phạm unique `(program_id, academic_year)` do bug cũ, step add unique index sẽ fail. Mitigation: chạy pre-migration check query trước.

**R3 — Route response breaking change:** Dashboard, approval, my-assignments đều call `/api/programs/:pId/versions`. Chỉ *thêm* fields vào response, không xóa. Không đổi tên field cũ.

**R4 — Refactor nửa vời:** Schema mới nhưng UI chưa update → user không thể tạo variant thứ 2. Phase 1 (schema) và Phase 2 (frontend navigation) phải ship đồng thời hoặc Phase 2 ngay sau Phase 1 trong cùng sprint.

---

## Open Questions

1. **`academic_year` trên `program_versions`:** Xóa ngay ở Phase 4, hay giữ vĩnh viễn làm denormalized cache? (Đề xuất: giữ đến Phase 4, xóa sau khi confirm không còn reference trong export templates.)
2. **Tạo cohort có auto-create variant ĐHCQ không?** Hay tạo cohort trống, user tự thêm từng variant? (Đề xuất: tạo trống, UX rõ ràng hơn.)
3. **Xóa cohort:** Cascade xóa tất cả variants, hay chỉ cho xóa khi cohort rỗng? (Đề xuất: chỉ xóa khi tất cả variants là draft hoặc cohort rỗng.)
4. **Dashboard grouping:** Pending approvals có group theo cohort không? (Đề xuất: để Phase 4, không blocking.)

---

## Implementation Phases

**Phase 1 — Schema + Migration + Backend routes**
- `db.js`: tạo `program_cohorts`, backfill migration, thêm `cohort_id` + `variant_type` vào `program_versions`
- `server.js`: thêm cohort routes, cập nhật POST version để nhận `cohort_id` + `variant_type`
- Data cũ vẫn chạy bình thường qua routes cũ

**Phase 2 — Frontend navigation**
- `programs.js`: `viewVersions` → `viewCohorts` → variant panel
- Breadcrumb trong `version-editor.js`

**Phase 3 — Create/Copy flow**
- Tạo cohort UI, tạo variant UI với copy suggestion
- `import-word.js`: thêm variant_type dropdown

**Phase 4 — Cleanup**
- Xóa `academic_year` khỏi `program_versions` (sau khi confirm không còn reference)
- Xóa UNIQUE constraint cũ `(program_id, academic_year)` trên `program_versions`
- Optional: dashboard grouping by cohort
