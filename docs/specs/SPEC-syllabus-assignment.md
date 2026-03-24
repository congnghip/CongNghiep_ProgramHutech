# SPEC: Phân công Giảng viên Soạn Đề cương

**Ngày tạo:** 2026-03-24
**Trạng thái:** Implemented

---

## 1. Bối cảnh & Mục tiêu

Hệ thống hiện tại không có cơ chế phân công GV soạn đề cương. Ai có quyền `syllabus.create` đều tự tạo đề cương, và GV khác ngành/khoa không thể truy cập CTDT để soạn. Tính năng này cho phép:

- **Trưởng ngành+** phân công GV soạn đề cương cho từng môn trong CTDT
- **GV** thấy danh sách phân công ở trang riêng, kể cả cross-ngành/khoa
- Approval flow theo department của CTDT đích

## 2. Quy tắc nghiệp vụ

### 2.1 Ai được phân công?
- Role từ `TRUONG_NGANH` (level 2) trở lên có quyền `syllabus.assign`
- Role cao hơn có thể override phân công của role thấp hơn (so sánh `assigner_role_level`)
- ADMIN luôn được phép

### 2.2 Phạm vi chọn GV
| Role | Phạm vi GV hiển thị |
|------|---------------------|
| TRUONG_NGANH (level 2) | GV trong ngành (cùng department_id với CTDT) |
| LANH_DAO_KHOA (level 3) | GV trong toàn khoa (department + children) |
| PHONG_DAO_TAO+ (level >= 4) | Tất cả GV trong hệ thống |

### 2.3 Ràng buộc
- Mỗi (version_id, course_id) chỉ có **1 GV** được phân công
- **Đổi GV** chỉ khi đề cương ở trạng thái `draft` (hoặc chưa tạo)
- Khi đổi GV, **nội dung đề cương được giữ lại**, chỉ đổi author
- **Không đổi** khi đề cương đã submit/đang duyệt → phải reject về draft trước
- Không phân công khi version đã locked/published
- Mỗi CTDT có assignment **độc lập** — cùng môn ở 2 CTDT có thể phân GV khác nhau
- GV soạn **riêng** cho từng CTDT, không có đồng bộ tự động

### 2.4 Deadline
- Có field deadline (DATE) khi phân công
- Hiển thị số ngày còn lại, highlight đỏ nếu quá hạn, vàng nếu <= 3 ngày
- Không chặn submit khi quá hạn

## 3. Data Model

### Bảng mới: `syllabus_assignments`

```sql
CREATE TABLE IF NOT EXISTS syllabus_assignments (
  id SERIAL PRIMARY KEY,
  version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  assigned_to INT REFERENCES users(id),
  assigned_by INT REFERENCES users(id),
  assigner_role_level INT DEFAULT 1,
  deadline DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(version_id, course_id)
);
```

**Indexes:** `idx_sa_assigned_to`, `idx_sa_version`

### Seed data thay đổi
- `syllabus.assign` thêm vào: `TRUONG_NGANH`, `BAN_GIAM_HIEU`
- Đã có sẵn ở: `LANH_DAO_KHOA`, `PHONG_DAO_TAO`

## 4. API Endpoints

### Mới

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/assignments/eligible-gv?version_id=X` | `syllabus.assign` | Danh sách GV eligible (scoped) |
| GET | `/api/versions/:vId/assignments` | requireViewVersion | Tất cả phân công của version |
| POST | `/api/versions/:vId/assignments` | `syllabus.assign` | Tạo/update phân công (upsert) |
| DELETE | `/api/versions/:vId/assignments/:courseId` | `syllabus.assign` | Xóa phân công |
| GET | `/api/my-assignments` | authMiddleware | Phân công của user hiện tại (cross-program) |
| POST | `/api/my-assignments/:id/create-syllabus` | authMiddleware | Tạo đề cương từ assignment |

### POST `/api/versions/:vId/assignments` — Body

```json
{
  "course_id": 123,
  "assigned_to": 456,
  "deadline": "2026-04-15",
  "notes": "Ghi chú tùy chọn"
}
```

**Validation:**
1. Version không locked
2. Course thuộc version_courses
3. GV active và trong phạm vi scope
4. Nếu đã có assignment: `assigner_role_level` mới >= cũ
5. Nếu có syllabus: status phải là `draft`

### Endpoints sửa đổi

| Endpoint | Thay đổi |
|----------|----------|
| `PUT /api/syllabi/:id` | Cho phép GV được phân công edit (bypass `syllabus.edit` check) |
| `POST /api/approval/submit` | Verify chỉ GV phân công (hoặc role >= 2) mới submit được |

## 5. UI

### 5.1 Version Editor — Tab Đề cương (cho TRUONG_NGANH+)

Mỗi dòng course hiển thị theo trạng thái:

| Trạng thái | GV Column | Deadline | Actions |
|------------|-----------|----------|---------|
| Chưa phân công | Dropdown chọn GV | Input date | [Phân công] |
| Đã phân công, chưa tạo/draft | Tên GV | Ngày | [Soạn/Xem] [Đổi GV] |
| Đã submit/duyệt | Tên GV | Ngày | [Xem] |

"Đổi GV" mở modal với dropdown + deadline mới.

### 5.2 Trang "Đề cương của tôi" (cho GIANG_VIEN)

- Sidebar: mục mới "Đề cương của tôi" (icon 📝)
- Table columns: Mã HP | Tên HP | TC | CTĐT | Khoa/Ngành | Người phân công | Hạn nộp | Còn lại | Trạng thái | Hành động
- Actions: "Tạo ĐC" (nếu chưa tạo) → tạo syllabus + navigate | "Soạn" (nếu draft) | "Xem" (nếu submitted+)
- Deadline: đỏ nếu quá hạn, vàng nếu <= 3 ngày

## 6. Files Changed

| File | Loại thay đổi |
|------|--------------|
| `db.js` | Thêm bảng + indexes + seed permissions |
| `server.js` | 6 endpoints mới, 2 sửa, 1 helper function |
| `public/js/pages/version-editor.js` | Overhaul `renderSyllabiTab()` + assignment methods |
| `public/js/pages/my-assignments.js` | **File mới** |
| `public/js/app.js` | Sidebar nav + routing |
| `public/index.html` | Script tag |

## 7. Edge Cases

1. **Race condition**: UNIQUE constraint + ON CONFLICT xử lý
2. **GV inactive sau khi phân công**: Hiển thị tên nhưng không cho tạo đề cương mới (check is_active khi tạo syllabus)
3. **Xóa course khỏi version**: CASCADE từ version_courses không ảnh hưởng syllabus_assignments (tham chiếu trực tiếp courses.id). Cần xử lý thủ công nếu muốn cleanup
4. **GV được phân công ở CTDT khác ngành**: Vẫn thấy assignment ở "Đề cương của tôi", soạn + submit bình thường. Approval theo department CTDT đích
