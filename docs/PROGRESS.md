# Tiến Độ Dự Án MeetCall

## Bước 1: Khung dự án, Docker, Schema Database, CI (Đã hoàn thành)

### 1. Đã làm
- **Monorepo setup**: Dựng cấu trúc monorepo `pnpm workspaces` với `apps/api`, `apps/web` và `packages/shared`.
- **Hạ tầng Docker**: `docker-compose.yml` gồm `postgis/postgis:16-3.4` (cổng 5432), `redis:7-alpine` (cổng 6379) và `axllent/mailpit` (cổng 1025 và 8025) kèm volume dữ liệu và healthcheck.
- **Database Schema**: 
  - `apps/api/prisma/schema.prisma` định nghĩa đủ 13 bảng: `users`, `profiles`, `photos`, `preferences`, `swipes`, `matches`, `messages`, `calls`, `call_friend_votes`, `blocks`, `reports`, `refresh_tokens`, `device_tokens`, kèm `admin_actions`.
  - Migration ban đầu `apps/api/prisma/migrations/20261101000000_init/migration.sql` bổ sung SQL thô:
    - Bật extension `postgis`
    - Ràng buộc CHECK `check_profiles_age_18`: `CHECK (birthdate <= CURRENT_DATE - INTERVAL '18 years')`
    - Cột `location geography(Point,4326)` kèm GIST spatial index
    - Ràng buộc CHECK `check_matches_user_order`: `CHECK (user_a < user_b)`
    - Các unique constraints và index hiệu năng theo đúng tài liệu
- **Seed dữ liệu**: `apps/api/prisma/seed.ts` tạo 5 tài khoản mẫu đủ 18 tuổi có sẵn hồ sơ, sở thích, ảnh đã duyệt và tọa độ PostGIS.
- **Backend Core**:
  - Dựng 10 module rỗng: `auth`, `profiles`, `photos`, `discovery`, `matches`, `chat`, `calls`, `random`, `safety`, `admin`.
  - `ConfigModule` với Zod schema validation (chặn khởi động nếu thiếu biến môi trường).
  - `PrismaService` & `PrismaModule`.
  - `RedisService` & `RedisModule` kết nối Redis pool.
  - Endpoint `GET /api/v1/health` kiểm tra đồng thời Postgres và Redis.
  - Cấu hình toàn cục: prefix `/api/v1`, `AllExceptionsFilter` chuẩn hóa `{ error: { code, message } }`, `ValidationPipe`, Helmet, CORS, Pino logger redact `Authorization` & `Cookie`.
- **Frontend Core**:
  - React 19 + Vite + TypeScript + Tailwind CSS v4.
  - Cấu hình Vite proxy `/api` và `/socket.io` chuyển sang cổng 3000 backend.
  - Giao diện kiểm tra và hiển thị trạng thái `health: ok` cùng trạng thái Postgres/Redis.
- **CI & Test**:
  - `.github/workflows/ci.yml` kiểm tra lint, typecheck, migration, test, build trên Ubuntu runner với Postgres PostGIS và Redis service.
  - Test suite: `test/underage.spec.ts` (kiểm tra DB CHECK constraint từ chối người dưới 18 tuổi) và `test/health.e2e-spec.ts` (kiểm tra `/api/v1/health`).

---

## Bước 2: Xác thực (Auth) (Đã hoàn thành)

### 1. Đã làm
- **Shared Types & DTOs**:
  - `packages/shared/src/auth.dto.ts`: `RegisterRequest`, `LoginRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `AuthUser`, `AuthResponse`, `AuthSuccessMessage`.
- **Backend Auth Module (`apps/api`)**:
  - `POST /api/v1/auth/register`:
    - Tính tuổi từ `birthdate` ở server, từ chối người dưới 18 tuổi (`400 UNDER_AGE`).
    - Kiểm tra email trùng lặp (`409 EMAIL_TAKEN`).
    - Băm mật khẩu bằng `argon2id`.
    - Transaction tạo `users` và `profiles` rỗng (displayName tạm từ email).
    - Cấp access token JWT (15 phút) và refresh token (30 ngày, băm SHA-256 lưu bảng `refresh_tokens`, gửi cookie `httpOnly`, `SameSite=Lax`).
  - `POST /api/v1/auth/login`:
    - Sai credentials trả 401 `INVALID_CREDENTIALS` chung chung (không làm lộ email có tồn tại hay không).
    - Tài khoản `suspended` trả 403 `ACCOUNT_SUSPENDED`.
    - Đăng nhập thành công xoay vòng refresh token mới.
  - `POST /api/v1/auth/refresh`:
    - Đọc cookie, tra cứu hash trong `refresh_tokens`.
    - Token rotation: Thu hồi token cũ, cấp cặp token mới.
    - Phát hiện lạm dụng (Token Reuse Detection): Nếu token đã bị thu hồi mà vẫn bị dùng lại, tự động thu hồi toàn bộ token của user đó (`revokedAt = now()`).
  - `POST /api/v1/auth/logout`:
    - Thu hồi refresh token hiện tại trong database và xoá cookie.
  - `POST /api/v1/auth/forgot-password` & `POST /api/v1/auth/reset-password`:
    - Quên mật khẩu luôn trả HTTP 200, tạo token ngẫu nhiên lưu Redis (TTL 30 phút).
    - Gửi email hướng dẫn qua Mailpit (dev SMTP port 1025) bằng `MailService` (Nodemailer).
    - Đặt lại mật khẩu thành công sẽ thu hồi toàn bộ refresh token cũ của user.
  - `AuthGuard` & `@CurrentUser()`:
    - Bảo vệ route bằng JWT Bearer token, tự động kiểm tra trạng thái active/suspended.
    - Endpoint `GET /api/v1/auth/me`.
  - Rate limiting (Redis):
    - `AuthRateLimitService`: Tối đa 10 lần thao tác sai mỗi 15 phút theo IP và email, vi phạm trả `429 TOO_MANY_ATTEMPTS`.
- **Frontend Auth (`apps/web`)**:
  - `src/lib/api.ts`: HTTP client tự động gắn Bearer token từ memory (không lưu localStorage), tự động bắt 401 để gọi `/auth/refresh` một lần rồi thử lại; thất bại đưa về `/login`.
  - `src/stores/authStore.ts`: Zustand store quản lý user, accessToken, khôi phục phiên (`restoreSession`) khi tải lại trang.
  - Giao diện Auth:
    - `/register`: Form đăng ký với ô tick cam kết đủ 18 tuổi và đồng ý điều khoản.
    - `/login`: Form đăng nhập với link quên mật khẩu / đăng ký.
    - `/forgot-password`: Form yêu cầu reset password, hướng dẫn mở Mailpit ở localhost:8025.
    - `/reset-password`: Form nhập mật khẩu mới từ link token.
    - `ProtectedRoute`: Chặn truy cập chưa đăng nhập.
    - `HomePage`: Trang chủ sau khi đăng nhập, hiển thị thông tin tài khoản và nút Đăng xuất.
    - Hiển thị thông báo lỗi tiếng Việt thân thiện theo mã lỗi API (`UNDER_AGE`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`...).
- **Kiểm thử Supertest bắt buộc (`apps/api/test/auth.e2e-spec.ts`)**:
  - Đã pass 100% (11/11 tests) bao gồm: đăng ký thành công, email trùng, dưới 18 tuổi bị từ chối, sai mật khẩu, refresh xoay vòng, reuse token cũ bị thu hồi hàng loạt, rate limit 10 lần sai, và AuthGuard.

### 2. Quyết định kỹ thuật quan trọng
- **Argon2id**: Dùng thuật toán băm mật khẩu `argon2id` hiện đại, an toàn trước tấn công GPU/ASIC và side-channel.
- **Token an toàn**: Access token JWT sống ngắn hạn 15 phút chỉ giữ trong memory của frontend; refresh token ngẫu nhiên 64 ký tự, băm SHA-256 trong DB, gửi qua cookie `httpOnly`, `SameSite=Lax`.
- **Phát hiện tái sử dụng Refresh Token**: Khi một token đã revoke mà vẫn được gửi lên, hệ thống đánh dấu thu hồi toàn bộ token của tài khoản đó ngay lập tức (phòng chống token theft).
- **Phòng chống dò email (User Enumeration)**: `POST /auth/login` và `POST /auth/forgot-password` luôn dùng thông điệp chung để không làm lộ email có tồn tại trong hệ thống hay không.

### 3. Biến môi trường mới trong .env.example
- `JWT_SECRET`: Khóa bí mật ký JWT (tối thiểu 16 ký tự).
- `JWT_EXPIRES_IN`: Thời gian sống của access token (mặc định `15m`).

### 4. Lệnh để chạy và kiểm tra lại bước này
```bash
# 1. Chạy toàn bộ test suite (unit + e2e auth + health)
pnpm test

# 2. Kiểm tra typecheck và lint
pnpm typecheck
pnpm lint

# 3. Build monorepo
pnpm build

# 4. Chạy dev server
pnpm dev
```

### 5. Việc còn nợ hoặc rủi ro đã biết
- Chưa làm hồ sơ chi tiết (ảnh, giới tính, sở thích, vị trí) - nằm trong phạm vi Bước 3.

### 6. Bước kế tiếp
- **Bước 3: Hồ sơ và ảnh**: Onboarding tạo hồ sơ (tên, giới tính, bio, sở thích), vị trí GPS / PostGIS, upload ảnh qua URL ký sẵn (S3/R2), worker xử lý ảnh (sharp, xóa EXIF GPS, kiểm duyệt ảnh), TanStack Query trên frontend.

---
**Gợi ý commit message**:
`feat: implement auth module, token rotation, rate limiting, and web auth screens`
