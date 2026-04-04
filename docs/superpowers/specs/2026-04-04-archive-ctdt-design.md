# Archive CTDT (Lưu trữ Chương trình Đào tạo)

**Date:** 2026-04-04

## Problem

Hiện tại không ai có thể xóa CTDT đã có phiên bản published — kể cả admin. API trả lỗi "Không thể xóa CTĐT đã công bố. Hãy liên hệ Admin nếu cần xóa triệt để" nhưng admin cũng bị block bởi cùng logic đó.

## Solution

Thêm tính năng **archive** (lưu trữ) thay vì xóa vĩnh viễn CTDT có phiên bản published. Chỉ ADMIN mới có quyền archive/unarchive.

## Requirements

- CTDT archived bị ẩn hoàn toàn khỏi danh sách — chỉ admin mới thấy (qua tab/filter riêng)
- Admin có thể unarchive (khôi phục) CTDT đã lưu trữ
- Chỉ role ADMIN được phép archive/unarchive
- CTDT archived bị block hoàn toàn: API trả 404 khi truy cập versions của CTDT đã archived

## Design

### 1. Database — `db.js`

Thêm cột vào bảng `programs` trong `initDB()`:

```sql
ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NULL;
```

- `archived_at IS NULL` → active
- `archived_at IS NOT NULL` → archived

### 2. API — `server.js`

#### Endpoint mới

**`POST /api/programs/:id/archive`**
- Middleware: `authMiddleware` + custom `isAdmin` check
- Logic: `UPDATE programs SET archived_at = NOW() WHERE id = $1`
- Response: `{ success: true }`

**`POST /api/programs/:id/unarchive`**
- Middleware: `authMiddleware` + custom `isAdmin` check
- Logic: `UPDATE programs SET archived_at = NULL WHERE id = $1`
- Response: `{ success: true }`

#### Sửa endpoint hiện tại

**`GET /api/programs`** (server.js ~line 507)
- Thêm `WHERE p.archived_at IS NULL` cho tất cả user (kể cả admin khi xem danh sách bình thường)
- Admin truyền query param `?archived=true` để xem danh sách CTDT đã lưu trữ: `WHERE p.archived_at IS NOT NULL`

**`GET /api/programs/:programId/versions`** (server.js ~line 574)
- Thêm check: nếu program có `archived_at IS NOT NULL` → trả 404

**Middleware `requireViewVersion`** (server.js ~line 149)
- Hiện tại admin bypass hoàn toàn (`if (admin) return next()`). Thêm check archived trước khi bypass: resolve program từ version/syllabus ID, nếu `archived_at IS NOT NULL` → trả 404. Áp dụng cho tất cả user kể cả admin.
- Đây là điểm chặn trung tâm — tất cả route GET version đều đi qua middleware này, đảm bảo block hoàn toàn.

**`DELETE /api/programs/:id`** (server.js ~line 547)
- Sửa message lỗi từ "Hãy liên hệ Admin nếu cần xóa triệt để" → "Hãy sử dụng chức năng Lưu trữ thay vì xóa"

### 3. Permission

Không thêm permission mới. Dùng hàm `isAdmin()` check trực tiếp — đúng yêu cầu chỉ ADMIN.

### 4. Frontend — `public/js/pages/programs.js`

#### Danh sách CTDT
- Thêm tab/filter "Đã lưu trữ" — chỉ hiện cho admin
- Khi admin chọn tab "Đã lưu trữ", gọi `GET /api/programs?archived=true`

#### Nút hành động
- CTDT có phiên bản published: nút "Xóa" đổi thành nút "Lưu trữ" (chỉ hiện cho admin)
- CTDT archived: hiện nút "Khôi phục" để unarchive, không hiện nút edit/submit/approve/delete
- CTDT không có phiên bản published: giữ nguyên nút "Xóa" như hiện tại

## Scope exclusions

- Không thêm permission mới cho archive
- Chặn truy cập version của CTDT archived qua middleware `requireViewVersion` — không cần sửa từng route riêng lẻ
- Không soft-delete versions — chỉ archive ở cấp program
