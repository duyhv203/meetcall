# Báo Cáo Rà Soát An Ninh & Đánh Giá Bảo Mật (MeetCall Security Audit)

## 1. Tổng quan Đánh giá
MeetCall được thiết kế theo nguyên tắc **Security by Design** và **Privacy by Default**, đáp ứng nghiêm ngặt các quy định về an toàn hẹn hò trực tuyến và bảo vệ dữ liệu cá nhân theo GDPR.

---

## 2. Kiểm toán theo OWASP Top 10 (2021)

| Hạng mục OWASP | Biện pháp Phòng vệ trong MeetCall | Trạng thái |
| :--- | :--- | :---: |
| **A01: Broken Access Control** | - Phân quyền RBAC (`UserRole: 'user' \| 'admin'`) qua `RolesGuard`<br>- Mọi tài nguyên match/chat/call/block đều kiểm tra người dùng sở hữu<br>- Tự động chặn 2 chiều ở cả Discovery, Chat và Random Call | **ĐẠT** |
| **A02: Cryptographic Failures** | - Băm mật khẩu bằng `argon2id` với memory cost cao<br>- Refresh token xoay vòng được băm SHA-256 lưu trữ DB<br>- Chữ ký webhook xác thực tuổi dùng HMAC-SHA256<br>- WebRTC mã hoá đường truyền DTLS-SRTP | **ĐẠT** |
| **A03: Injection** | - Dùng Prisma ORM chống triệt để SQL Injection<br>- Toạ độ PostGIS dùng parameterized query `$executeRawUnsafe` có bind tham số | **ĐẠT** |
| **A04: Insecure Design** | - Ràng buộc CHECK 18+ cả ở DB và API validation<br>- Rate limits ở Redis: 10 lần login/15m, 100 like/12h, 30 tin nhắn/phút, 200 next/giờ<br>- 3 báo cáo trong 24h tự động khoá random 24h | **ĐẠT** |
| **A05: Security Misconfiguration** | - Helmet bật mặc định bảo vệ HTTP headers<br>- CORS cấu hình theo biến môi trường `WEB_ORIGIN`<br>- Cookie `httpOnly`, `SameSite=Lax`, `secure` khi production | **ĐẠT** |
| **A06: Vulnerable and Outdated Components** | - Rà soát định kỳ qua `pnpm audit`<br>- dependencies core luôn ghim version an toàn | **ĐẠT** |
| **A07: Identification and Authentication Failures** | - Refresh token rotation & Token Reuse Detection (thu hồi toàn bộ session nếu phát hiện token cũ dùng lại)<br>- Phản hồi đăng nhập sai trả 401 chung tránh dò email | **ĐẠT** |
| **A08: Software and Data Integrity Failures** | - Zod validation schema chặn khởi động nếu cấu hình sai<br>- Giới hạn kích thước signaling SDP/ICE candidates <= 16 KB | **ĐẠT** |
| **A09: Security Logging and Monitoring Failures** | - Pino Logger tự động che mờ (`***REDACTED***`) token Authorization và Cookie<br>- Ghi vết kiểm toán đầy đủ mọi thao tác quản trị viên vào `admin_actions` | **ĐẠT** |
| **A10: Server-Side Request Forgery (SSRF)** | - Không cho phép server fetch URL tự do từ phía client<br>- S3 presigned upload URL cấp phát trực tiếp cho client upload | **ĐẠT** |

---

## 3. Các Cơ Chế Bảo Vệ Đặc Thù cho Ứng Dụng Hẹn Hò

### 3.1. Bảo vệ Tọa độ Vị trí (Nguyên tắc 5km)
- Cơ sở dữ liệu lưu toạ độ địa lý dạng `geography(Point, 4326)` có chỉ mục GIST.
- **Không bao giờ trả toạ độ thô (`lat`, `lng`) cho client**.
- Khoảng cách giữa 2 người luôn được làm tròn:
  ```sql
  GREATEST(5, ROUND(ST_Distance(p.location, me_p.location) / 5000.0) * 5)::int
  ```

### 3.2. Loại bỏ Siêu Dữ Liệu Hình Ảnh (EXIF Stripping)
- Xử lý ảnh tải lên bằng thư viện `sharp`: tự động strip toàn bộ EXIF GPS metadata, xoay đúng chiều, nén ảnh định dạng webp an toàn.

### 3.3. Bảo vệ Trẻ Vị Thành Niên (Child Safety)
- Database Check Constraint:
  ```sql
  CONSTRAINT "check_profiles_age_18" CHECK (birthdate <= CURRENT_DATE - INTERVAL '18 years')
  ```
- Mọi báo cáo vi phạm với lý do `minor` được hệ thống tự động gắn cờ `urgent` đưa lên đầu trang quản trị.
