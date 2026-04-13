# Proposed Courses (Hoc phan de xuat)

## Summary

Cho phep nguoi soan CTDT them hoc phan de xuat (chua duoc cap ma) vao version, soan de cuong day du cho hoc phan do. Phong Dao tao gan ma chinh thuc khi duyet CTDT.

## Background

Hien tai, bang `courses` bat buoc `code VARCHAR(20) UNIQUE NOT NULL` — moi hoc phan phai co ma chinh thuc moi ton tai trong he thong. Nguoi soan CTDT khong the them hoc phan moi chua duoc cap ma.

Trong quy trinh thuc te, ma hoc phan duoc Phong Dao tao cap khi CTDT duoc duyet o cap PDT/BGH. Truoc do, hoc phan chi la "de xuat" va chua co ma.

## Approach

**Huong A: Mo rong bang `courses` — cho phep `code` nullable.**

Hoc phan de xuat song ngay trong bang `courses` voi `code = NULL` va `is_proposed = true`. Tat ca relationships hien tai (`version_courses`, `version_syllabi`, `course_clos`, CLO-PLO mapping) hoat dong ngay ma khong can sua doi.

## Schema Changes

### Bang `courses` — sua doi

```sql
-- Hien tai:
code VARCHAR(20) UNIQUE NOT NULL

-- Thay doi:
code VARCHAR(20) UNIQUE  -- bo NOT NULL, cho phep NULL
```

Them 2 cot moi:

```sql
is_proposed BOOLEAN DEFAULT false,
proposed_by_version_id INT REFERENCES program_versions(id)
```

### Trang thai hoc phan

| Trang thai | `code` | `is_proposed` | `proposed_by_version_id` |
|---|---|---|---|
| Hoc phan chinh thuc (hien tai) | `'CS101'` | `false` | `NULL` |
| Hoc phan de xuat (moi) | `NULL` | `true` | `42` |
| De xuat da duoc cap ma | `'CS201'` | `false` | `NULL` |

### Khong thay doi

- Bang `version_courses` — giu nguyen, `course_id` van tham chieu `courses.id`
- Bang `version_syllabi` — giu nguyen
- Bang `course_clos` — giu nguyen
- CLO-PLO mapping — giu nguyen

## Proposed Course Lifecycle

### Tao moi (nguoi soan CTDT)

Khi version o trang thai `draft`, nguoi soan co the:
1. **Them hoc phan tu catalog** (nhu hien tai) — chon tu danh sach `courses` co ma
2. **Them hoc phan de xuat** (moi) — nhap ten, tin chi, mo ta... nhung khong co ma

He thong se:
- INSERT vao `courses` voi `code = NULL, is_proposed = true, proposed_by_version_id = versionId`
- INSERT vao `version_courses` gan course moi vao version
- Tu day, nguoi soan co the tao de cuong, CLO, mapping... binh thuong

### Gan ma (Phong Dao tao)

Khi CTDT den giai doan PDT duyet, PDT thay danh sach hoc phan de xuat va co 2 lua chon:

**Lua chon 1 — Gan ma moi:**
```sql
UPDATE courses SET code = 'CS201', is_proposed = false, proposed_by_version_id = NULL
WHERE id = {courseId}
```
Hoc phan tro thanh chinh thuc trong catalog. Don gian, 1 cau UPDATE.

**Lua chon 2 — Gop vao hoc phan da co:**
PDT chon mot hoc phan chinh thuc da ton tai. He thong can (trong 1 transaction):
1. Cap nhat `version_courses.course_id` tu proposed -> existing
2. Cap nhat `version_syllabi.course_id` tu proposed -> existing
3. `course_clos` gan vao `version_courses.id` nen tu dong dung (vi `version_courses` row van giu `id` cu, chi doi `course_id`)
4. Xoa ban de xuat trong `courses`

### Rang buoc

- Chi tao hoc phan de xuat khi version o trang thai `draft`
- Chi PDT (role `PHONG_DAO_TAO`) moi co quyen gan ma
- PDT **phai gan ma cho tat ca hoc phan de xuat** truoc khi approve CTDT — he thong block approve neu con hoc phan chua co ma

## Permissions

### Permission moi

| Permission code | Mo ta | Ai co? |
|---|---|---|
| `courses.propose` | Tao hoc phan de xuat trong version | TRUONG_NGANH, GIANG_VIEN duoc giao |
| `courses.assign_code` | Gan ma chinh thuc cho hoc phan de xuat | PHONG_DAO_TAO, ADMIN |

### Logic phan quyen

**Tao hoc phan de xuat:**
- Can permission `courses.propose`
- Version phai o trang thai `draft`
- Su dung middleware `requireDraft` hien co

**Gan ma chinh thuc:**
- Can permission `courses.assign_code`
- CTDT phai o trang thai `approved_khoa` tro len
- Khi gan ma moi: validate ma khong trung voi bat ky course nao trong catalog
- Khi gop: validate course dich ton tai va da co ma

**Block approve:**
- Khi PDT nhan approve CTDT, he thong kiem tra:
  ```sql
  SELECT COUNT(*) FROM version_courses vc
  JOIN courses c ON c.id = vc.course_id
  WHERE vc.version_id = {vId} AND c.is_proposed = true
  ```
- Neu count > 0 -> tu choi approve, tra thong bao "Con {n} hoc phan de xuat chua duoc gan ma"

### Hien thi catalog

- Trang quan ly hoc phan (`/api/courses`): filter them `WHERE is_proposed = false` — chi hien hoc phan chinh thuc
- Trong context version: hien ca hai — hoc phan chinh thuc va de xuat, nhung danh dau ro rang

## API

### API moi

**1. Tao hoc phan de xuat trong version:**
```
POST /api/versions/:vId/proposed-courses
Body: { name, credits, credits_theory, credits_practice, credits_project,
        credits_internship, department_id, description }
Middleware: requireDraft, requirePerm('courses.propose')
```
- INSERT vao `courses` (is_proposed=true, proposed_by_version_id=vId)
- INSERT vao `version_courses` (gan vao version)
- Tra ve course + version_course record

**2. Sua thong tin hoc phan de xuat:**
```
PUT /api/proposed-courses/:courseId
Body: { name, credits, credits_theory, credits_practice, credits_project,
        credits_internship, department_id, description }
Middleware: requirePerm('courses.propose')
```
- Chi cho phep khi version chua course nay o trang thai `draft`
- Validate course co `is_proposed = true`
- UPDATE courses SET name, credits, ...

**3. Lay danh sach hoc phan de xuat cua mot version:**
```
GET /api/versions/:vId/proposed-courses
```
- Tra ve cac courses co `is_proposed = true` gan voi version nay

**4. Gan ma chinh thuc:**
```
POST /api/proposed-courses/:courseId/assign-code
Body: { code: "CS201" }
Middleware: requirePerm('courses.assign_code')
```
- Validate ma unique trong catalog
- UPDATE courses SET code, is_proposed=false, proposed_by_version_id=NULL

**5. Gop vao hoc phan da co:**
```
POST /api/proposed-courses/:courseId/merge
Body: { target_course_id: 55 }
Middleware: requirePerm('courses.assign_code')
```
- Trong transaction: cap nhat FK o `version_courses` + `version_syllabi`, xoa proposed course

### API sua doi

**`GET /api/courses` va `GET /api/courses/all`:**
- Them filter `is_proposed = false`

**`GET /api/versions/:vId/courses`:**
- Giu nguyen — hien tat ca courses trong version
- Them truong `is_proposed` trong response

**`POST /api/approval/review`:**
- Them validation: neu action la approve o cap PDT, kiem tra khong con proposed courses chua gan ma

## Frontend Changes

### Trang Courses trong Version (version-editor)

**Hien tai:** Chi co nut "Them hoc phan" -> chon tu catalog.

**Thay doi:** Them nut "De xuat hoc phan moi" ben canh. Mo modal voi cac truong:
- Ten hoc phan (bat buoc)
- So tin chi + LT/TH/DA/TT
- Khoa/Vien
- Mo ta

Khong co truong "Ma hoc phan".

**Trong danh sach courses cua version:**
- Hoc phan de xuat hien thi voi badge "De xuat" (mau vang/cam)
- Thay vi hien ma, hien "Cho cap ma"
- Click vao van mo de cuong, CLO, mapping... nhu binh thuong

### Trang quan ly Courses (catalog)

- Filter `is_proposed = false` — khong hien de xuat o day
- Khong thay doi gi khac

### Giao dien gan ma cho PDT

Khi PDT mo mot CTDT de duyet (o trang thai `approved_khoa`), neu co hoc phan de xuat:

**Hien thong bao:** "CTDT nay co {n} hoc phan de xuat can gan ma truoc khi duyet"

**Danh sach hoc phan de xuat, moi dong gom:**
- Ten hoc phan, tin chi, mo ta
- Hai action:
  - **"Gan ma moi"** -> input nhap ma, validate realtime (kiem tra trung)
  - **"Gop vao HP da co"** -> dropdown/search chon hoc phan tu catalog

**Nut Approve bi disable** khi con hoc phan de xuat chua xu ly. Enable khi tat ca da co ma.

### De cuong & CLO

Khong thay doi — syllabus-editor va CLO editor hoat dong dua tren `version_courses.id` va `courses.id`. Frontend chi can an truong "Ma hoc phan" trong de cuong neu course la de xuat.

## Edge Cases

**1. Xoa hoc phan de xuat:**
- Chi cho phep khi version o trang thai `draft`
- Thu tu xoa (trong transaction): xoa `version_syllabi` (theo course_id + version_id) -> xoa `version_courses` (cascade xoa `course_clos`) -> xoa record trong `courses`

**2. CTDT bi reject quay ve draft:**
- Hoc phan de xuat van giu nguyen, nguoi soan co the sua/xoa/them
- Neu PDT da gan ma cho mot so HP roi reject -> cac HP da gan ma **giu nguyen trang thai chinh thuc** (khong revert), vi ma da duoc cap la quyet dinh cua PDT

**3. Gop — de cuong bi xung dot:**
- Khi gop proposed course A vao existing course B, neu course B da co de cuong trong cung version -> he thong **tu choi gop**, thong bao xung dot
- PDT phai xu ly thu cong (xoa mot de cuong truoc, hoac chon giu de cuong nao)

**4. Proposed course trong ma tran (PO-PLO, Course-PLO, Course-PI):**
- Hoat dong binh thuong vi ma tran reference `version_courses.id`
- Khi gop, `version_courses` row giu nguyen `id` (chi doi `course_id`), nen mapping khong bi anh huong

**5. Export/bao cao:**
- Khi export CTDT chua published: hien "Cho cap ma" thay vi ma trong
- Khi CTDT da published: tat ca HP da co ma (do block approve dam bao)
