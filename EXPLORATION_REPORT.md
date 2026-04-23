# HUTECH Program Management - Cohorts & Variants Exploration Report

## 1. DATABASE SCHEMA

### `program_cohorts` Table (Lines 390-398 in db.js)
```sql
CREATE TABLE program_cohorts (
  id            SERIAL PRIMARY KEY,
  program_id    INT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  academic_year VARCHAR(4) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, academic_year)
);
```
- **Purpose**: Groups program versions by academic year (khóa)
- **Uniqueness**: One cohort per program + academic_year combination
- **Notes**: Can store general notes for the cohort

### `program_versions` Table (Lines 88-116 in db.js)
```sql
ALTER TABLE program_versions
  ADD COLUMN IF NOT EXISTS cohort_id INT REFERENCES program_cohorts(id) ON DELETE CASCADE;
ALTER TABLE program_versions
  ADD COLUMN IF NOT EXISTS variant_type VARCHAR(20);
  -- CHECK (variant_type IN ('DHCQ','QUOC_TE','VIET_HAN','VIET_NHAT'))
```
- **Relationship**: Each version belongs to a cohort + has a variant_type
- **Unique Constraint**: `UNIQUE(cohort_id, variant_type)` — one variant per type per cohort
- **Variant Types**:
  - `DHCQ` = Đại học Chính quy (Regular undergraduate)
  - `QUOC_TE` = Quốc Tế (International)
  - `VIET_HAN` = Việt - Hàn (Vietnam-Korea)
  - `VIET_NHAT` = Việt - Nhật (Vietnam-Japan)

---

## 2. CHILD TABLES THAT REFERENCE `program_versions.id`

These tables must be **deep-copied** when copying a variant:

| Table | FK Column | Purpose | Rows/Version |
|-------|-----------|---------|---|
| `version_objectives` | `version_id` | Program Objectives (POs) | ~20 |
| `version_plos` | `version_id` | Program Learning Outcomes (PLOs) | ~8-12 |
| `plo_pis` | `plo_id` → `version_plos.id` | PLO Performance Indicators | ~30-50 |
| `version_courses` | `version_id` | Courses in curriculum | ~40-60 |
| `course_clos` | `version_course_id` → `version_courses.id` | Course Learning Outcomes | ~100-200 |
| `version_syllabi` | `version_id` | Course syllabi drafts | ~40-60 |
| `version_pi_courses` | `version_id` + refs | PI-to-Course mapping | ~200-300 |
| `po_plo_map` | `version_id` + refs | PO-PLO mapping | ~100-150 |
| `course_plo_map` | `version_id` + refs | Course-PLO mapping | ~200-300 |
| `clo_pi_map` | `clo_id` → `course_clos.id` | CLO-to-PI mapping | ~300-500 |
| `knowledge_blocks` | `version_id` | Curriculum structure (hierarchical) | ~5-10 |
| `teaching_plan` | `version_course_id` | Teaching schedule details | ~40-60 |
| `assessment_plans` | `version_id` | Assessment strategies | ~20-40 |
| `syllabus_assignments` | `version_id` | Syllabus authoring assignments | ~40-60 |

**Total per variant: ~1,500-2,500 rows**

### Currently Copied (10 tables)
✅ `version_objectives`, `version_plos`, `plo_pis`, `version_courses`, `version_syllabi`, `knowledge_blocks`

### NOT Copied (4 mapping tables)
❌ `po_plo_map`, `course_plo_map`, `version_pi_courses`, `clo_pi_map` — **These break the copy!**

### NOT Copied (other tables)
❌ `teaching_plan`, `assessment_plans`, `syllabus_assignments` — **Optional for MVP**

---

## 3. CURRENT API ROUTES

### Cohort Routes
- **GET /api/programs/:pId/cohorts** — List cohorts with variants nested
- **GET /api/cohorts/:cId** — Get single cohort detail
- **GET /api/cohorts/:cId/variants** — Flat list of variants in cohort
- **POST /api/programs/:pId/cohorts** — Create new cohort (academic_year only)
- **DELETE /api/cohorts/:cId** — Delete cohort (only if all variants draft)

### Variant Routes
- **POST /api/cohorts/:cId/variants** (Lines 968-1124)
  - Creates new variant, optionally copying from `copy_from_version_id`
  - **Deep-copy logic** (Lines 1038-1102):
    - Copies POs, PLOs, PIs, courses, syllabi, knowledge blocks
    - Remaps knowledge_block_id references
    - **⚠️ DOES NOT** copy mapping tables (`po_plo_map`, `course_plo_map`, `version_pi_courses`, `clo_pi_map`)

---

## 4. CURRENT UI

### Programs.js (public/js/pages/programs.js)

**Cohorts Tab** (Lines 510-564)
- Button: "+ Tạo khóa" (Create Cohort)
- Grid showing all cohorts for program
- Each cohort has 4 variant slots (DHCQ, QUOC_TE, VIET_HAN, VIET_NHAT)
- For each variant: Status, "+ Tạo" button, Edit/View/Delete buttons
- "Xóa khóa" button to delete cohort (all variants must be draft)

**Cohort Modal** (Lines 426-453)
- Inputs: `academic_year` (4-digit), `notes` (optional)
- **No copy functionality**

**Variant Modal** (Lines 454-510)
- Inputs: `variant_type`, `version_name`, credits, duration, etc.
- Copy dropdown: Shows published variants of same type from OTHER cohorts
- **No cohort-copy UI**

---

## 5. IMPLEMENTATION REQUIREMENTS

### Feature 1: Copy Cohort Endpoint

**New Route**: `POST /api/programs/:pId/cohorts/:cId/copy`

**Input**:
```json
{
  "new_academic_year": "2027"
}
```

**Logic**:
1. Validate source cohort exists, has at least one published variant
2. Check new academic_year not already used in this program
3. Create new cohort with new academic_year
4. For each published variant in source cohort:
   - Create new variant in new cohort with same variant_type
   - Call internal `deepCopyVariant()` function for ALL 14 tables
   - Set `copied_from_id` to source variant (for audit trail)
   - Create new draft status (not locked)

**Deep-copy logic** should handle:
- PLO ID remapping (plo_map for references)
- Course ID remapping (version_courses get new IDs)
- PI ID remapping (plo_pis get new IDs)
- CLO ID remapping (course_clos get new IDs)
- Knowledge block ID remapping (hierarchical)
- Teaching plan version_course_id remapping
- All 4 missing mapping tables:
  - `po_plo_map`: remap po_id, plo_id
  - `course_plo_map`: remap course_id (version_courses), plo_id
  - `version_pi_courses`: remap pi_id, course_id (version_courses)
  - `clo_pi_map`: remap clo_id (course_clos), pi_id

### Feature 2: Fix Variant Copy

Enhance `POST /api/cohorts/:cId/variants` to copy missing 4 mapping tables.

---

## 6. KEY INSIGHTS

✅ **Schema is ready**: `program_cohorts`, `cohort_id`, `variant_type` all in place
✅ **Variant copy is 70% done**: Copies 10/14 child tables
❌ **Cohort copy doesn't exist**: Need new endpoint
❌ **Mapping table copies missing**: `po_plo_map`, `course_plo_map`, `version_pi_courses`, `clo_pi_map`
✅ **Permission checks**: `programs.create_version` already required
✅ **Unique constraints enforced**: UNIQUE(program_id, academic_year) and UNIQUE(cohort_id, variant_type)

---

## 7. FILES TO MODIFY

1. **server.js**: 
   - New endpoint: `POST /api/programs/:pId/cohorts/:cId/copy`
   - Enhance: `POST /api/cohorts/:cId/variants` to copy 4 mapping tables

2. **public/js/pages/programs.js**:
   - Add "Copy Khóa" button in cohorts grid
   - Modal: input new academic_year
   - Call new copy endpoint

3. **db.js**: (no changes needed — schema complete)

