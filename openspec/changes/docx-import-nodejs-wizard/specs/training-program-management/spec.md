## ADDED Requirements

### Requirement: Import Access Point in Training Program Management
Hệ thống SHALL hiển thị nút "Nhập từ DOCX" tại danh sách Chương trình đào tạo (Training Programs).

#### Scenario: Truy cập Wizard từ danh sách CTDT
- **WHEN** Người dùng đang ở màn hình Quản lý Chương trình đào tạo (programs.js)
- **THEN** Hệ thống SHALL hiển thị nút bấm "Nhập từ DOCX" bên cạnh nút "Thêm mới"

### Requirement: Role-based Access for Import
Quyền "Nhập từ DOCX" SHALL được gán cho các vai trò quản lý CTDT.

#### Scenario: Phân quyền Import
- **WHEN** Người dùng có quyền `programs.create`
- **THEN** Hệ thống SHALL hiển thị và cho phép sử dụng tính năng Import từ DOCX
