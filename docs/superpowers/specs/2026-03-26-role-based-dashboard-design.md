# Role-Based Dashboard Filtering — Design Spec

**Date:** 2026-03-26
**Status:** Draft

## Overview

Cá nhân hóa trang Tổng quan (Dashboard) bằng cách lọc dữ liệu theo phạm vi vai trò của user. Layout giữ nguyên, chỉ thay đổi dữ liệu hiển thị.

## Phân nhóm vai trò & phạm vi lọc

| Nhóm | Vai trò | Level | Phạm vi dữ liệu |
|------|---------|-------|------------------|
| Department-scoped | GIANG_VIEN | 1 | Department được gán |
| Department + con | TRUONG_NGANH, LANH_DAO_KHOA | 2-3 | Department được gán + tất cả department con |
| Toàn hệ thống | PHONG_DAO_TAO, BAN_GIAM_HIEU, ADMIN | >= 4 | Không lọc, giữ nguyên như hiện tại |

### Logic xác định scope

1. Lấy vai trò cao nhất của user (`getUserRoles` → sort by level desc → lấy đầu tiên)
2. Nếu level >= 4 → trả stats toàn hệ thống (không thay đổi)
3. Nếu level 2-3 → lấy `department_id` + query tất cả department con → lọc theo danh sách department IDs
4. Nếu level 1 → lọc theo đúng `department_id` được gán

## Lọc từng metric

Với các vai trò level 1-3, mỗi metric lọc theo department scope:

| Metric | Cách lọc |
|--------|----------|
| Chương trình | Đếm programs thuộc department scope |
| Phiên bản | Đếm versions của programs thuộc department scope, chia theo status |
| Học phần | Đếm courses thuộc department scope |
| Đề cương | Đếm syllabi của courses thuộc department scope, chia theo status |
| Người dùng | Đếm users có role assignment trong department scope |
| Chờ duyệt | Đếm items đang ở trạng thái mà vai trò hiện tại có quyền duyệt, trong department scope |

### Chi tiết "Chờ duyệt" theo vai trò

| Vai trò | Đếm items ở trạng thái |
|---------|------------------------|
| GIANG_VIEN | Không có quyền duyệt → trả 0 |
| TRUONG_NGANH | Đề cương ở status `submitted` (chờ duyệt TBM) trong department scope |
| LANH_DAO_KHOA | CTDT versions ở `submitted` (chờ duyệt Khoa) + Đề cương ở `approved_tbm` (chờ duyệt Khoa) trong department scope |
| PHONG_DAO_TAO | CTDT versions ở `approved_khoa` (chờ duyệt PĐT) + Đề cương ở `approved_khoa` (chờ duyệt PĐT) — toàn hệ thống |
| BAN_GIAM_HIEU | CTDT versions ở `approved_pdt` (chờ duyệt BGH) + Đề cương ở `approved_pdt` (chờ duyệt BGH) — toàn hệ thống |
| ADMIN | Tổng tất cả items đang chờ duyệt ở mọi trạng thái — toàn hệ thống |

Lưu ý: "Chờ duyệt" luôn lọc theo quyền duyệt của vai trò, bất kể level. Department scope chỉ áp dụng cho các metric khác (programs, versions, courses, syllabi, users).

## Lọc "Hoạt động gần đây"

**Level >= 4:** Giữ nguyên — thấy tất cả hoạt động.

**Level 2-3 (TRUONG_NGANH, LANH_DAO_KHOA):** Lọc audit_logs bằng JOIN với bảng programs/courses để xác định department. Chỉ hiển thị hoạt động trên entities thuộc department scope.

**Level 1 (GIANG_VIEN):** Lọc audit_logs bằng JOIN — chỉ hiển thị hoạt động trên entities thuộc department được gán.

**Kỹ thuật:** JOIN khi query, không thêm cột mới vào bảng audit_logs. Parse thông tin entity từ audit log details + join bảng liên quan.

## Thay đổi cần làm

### Backend — `server.js`

Sửa endpoint `GET /api/dashboard/stats`:
- Lấy vai trò cao nhất của user qua `getUserRoles(req.user.id)`
- Nếu level >= 4: giữ nguyên tất cả query hiện tại
- Nếu level 1-3:
  - Gọi `getDepartmentScope()` để lấy danh sách department IDs
  - Thêm `WHERE department_id = ANY($deptIds)` vào query đếm programs, versions, courses, syllabi, users
  - Lọc pendingApprovals theo trạng thái phù hợp với vai trò duyệt
  - Lọc recentActivity bằng JOIN audit_logs với bảng liên quan

### Database — `db.js`

Thêm helper function:
- `getDepartmentScope(deptId, level)` — Nếu level >= 2, trả về `[deptId, ...childDeptIds]` bằng query `WHERE parent_id = deptId`. Nếu level 1, trả về `[deptId]`.

### Frontend — `public/js/pages/dashboard.js`

Không thay đổi. Response format giữ nguyên cấu trúc JSON hiện tại, chỉ khác giá trị số.

## Không thay đổi

- Schema database (không thêm bảng/cột)
- Response format của API `/api/dashboard/stats`
- Layout/UI của trang dashboard
- Logic render phía frontend
