# HUTECH Program Management

Hệ thống quản lý chương trình đào tạo (CTĐT) của Trường Đại học Công nghệ TP.HCM.
Ứng dụng web nội bộ, giao diện tiếng Việt, phục vụ quy trình xây dựng — phê duyệt — công bố chương trình đào tạo và đề cương học phần theo tiếp cận CDIO/AUN-QA.

---

## 1. Truy cập hệ thống

- **URL (chạy local):** <http://localhost:3600>
- **Trình duyệt khuyến nghị:** Google Chrome, Microsoft Edge hoặc Firefox phiên bản mới nhất.
- **Độ phân giải tối thiểu:** 1366 × 768.

> Nếu chưa có server chạy, xem hướng dẫn khởi động nhanh ở mục [docker-compose.yml](docker-compose.yml) và [Makefile](Makefile) (`make up` để chạy bằng Docker, hoặc `make dev` để chạy native).

---

## 2. Đăng nhập lần đầu

Hệ thống tạo sẵn **một tài khoản quản trị viên duy nhất** khi khởi tạo cơ sở dữ liệu:

| Thông tin | Giá trị |
|---|---|
| Tên đăng nhập | `admin` |
| Mật khẩu | `admin123` |
| Vai trò | Quản trị hệ thống (ADMIN) |
| Đơn vị | HUTECH (toàn trường) |

**Các bước:**

1. Mở trình duyệt tại <http://localhost:3600>.
2. Ở form đăng nhập, nhập `admin` vào ô *Tên đăng nhập* và `admin123` vào ô *Mật khẩu*.
3. Nhấn **Đăng nhập**. Hệ thống sẽ chuyển vào trang *Tổng quan*.

---

## 3. Quy ước mật khẩu

> ⚠️ **Quan trọng:** Trong môi trường demo/nội bộ, **toàn bộ tài khoản của hệ thống đều sử dụng mật khẩu mặc định `admin123`** — bao gồm cả tài khoản admin gốc và tất cả các tài khoản do admin tạo mới (giảng viên, trưởng ngành, lãnh đạo khoa, phòng đào tạo, ban giám hiệu).

- Khi bạn được cấp tài khoản, hãy đăng nhập bằng mật khẩu `admin123` rồi **đổi ngay** qua nút **Đổi MK** ở góc dưới sidebar.
- Khi admin tạo tài khoản mới cho người khác, hãy đặt mật khẩu là `admin123` để giữ nhất quán với quy ước chung.
