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
- Đã giải quyết hoàn toàn trong Bước 3.

---

## Bước 3: Hồ sơ, ảnh, tuỳ chọn tìm kiếm & vị trí (Đã hoàn thành)

### 1. Đã làm
- **Shared Types & DTOs**:
  - `packages/shared/src/profile.dto.ts`: `ProfileData`, `PreferencesData`, `PhotoData`, `MeResponse`, `UpdateProfileRequest`, `UpdatePreferencesRequest`, `UpdateLocationRequest`, `GetUploadUrlRequest`, `GetUploadUrlResponse`, `ConfirmPhotoRequest`, `ReorderPhotosRequest`.
- **Backend Photos & Storage (`apps/api`)**:
  - `StorageService`: Hỗ trợ dual mode lưu trữ ảnh: Cloud S3/R2 presigned URL và Local Filesystem storage cho môi trường dev (`/api/v1/storage/upload` & `/api/v1/storage/file`).
  - `MockModerationProvider` (`ModerationProvider` interface): Kiểm duyệt ảnh tự động, gắn cờ duyệt (approved) hoặc từ chối (rejected).
  - `PhotoProcessorService`: BullMQ processor dùng `sharp` tự động:
    - Loại bỏ triệt để metadata nhạy cảm (đặc biệt toạ độ EXIF GPS).
    - Xoay đúng chiều theo orientation và resize chuẩn kích thước tối đa 1600px, nén JPEG quality 85.
  - `PhotosService`:
    - `POST /api/v1/me/photos/upload-url`: Kiểm tra định dạng (chỉ chấp nhận JPEG, PNG, WebP) và dung lượng tối đa 8 MB. Sinh presigned upload URL.
    - `POST /api/v1/me/photos`: Xác thực quyền sở hữu key ảnh, lưu DB với `moderationStatus: approved`, gán thứ tự `position`.
    - `DELETE /api/v1/me/photos/:id`: Xoá ảnh khỏi DB và storage với xác thực quyền sở hữu.
    - `PUT /api/v1/me/photos/reorder`: Cập nhật lại thứ tự ảnh, đổi ảnh đại diện chính.
- **Backend Profiles & Preferences (`apps/api`)**:
  - `GET /api/v1/me`: Trả về dữ liệu tổng hợp user, profile, preferences, photos và tính toán trạng thái `onboardingCompleted` (yêu cầu displayName, giới tính, city/location và ít nhất 1 ảnh đã được duyệt).
  - `PUT /api/v1/me/profile`: Cập nhật tên hiển thị (2-30 ký tự), giới tính, bio (tối đa 300 ký tự), danh sách sở thích `interests` (PostgreSQL text array), thành phố.
  - `PUT /api/v1/me/preferences`: Cập nhật bộ lọc tìm kiếm (`minAge >= 18`, `maxAge`, `genderFilter`, `maxDistanceKm`).
  - `PUT /api/v1/me/location`: Nhận toạ độ GPS (lat, lng), cập nhật cột PostGIS `geography(Point, 4326)` bằng hàm `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`. Toạ độ GPS tuyệt đối không bao giờ bị trả về trực tiếp trong response API.
- **Frontend Web (`apps/web`)**:
  - `src/stores/profileStore.ts`: Quản lý state profile, preferences, photos, upload trực tiếp lên uploadUrl và cập nhật thông tin.
  - `src/features/onboarding/OnboardingPage.tsx`: Flow Onboarding 4 bước:
    1. Tên hiển thị (2-30 ký tự) & Giới tính.
    2. Bio (tối đa 300 ký tự) & Sở thích (chips chọn nhanh + tag tự nhập).
    3. Tải ảnh lên: xem danh sách, đặt làm ảnh chính, xoá ảnh, yêu cầu tối thiểu 1 ảnh.
    4. Vị trí & Tiêu chuẩn tìm kiếm: Nút "Lấy vị trí GPS" (Geolocation API), slider khoảng cách (5-100 km), slider độ tuổi (tối thiểu 18), giới tính quan tâm.
  - `src/features/settings/ProfileSettingsPage.tsx`: Màn hình xem và cập nhật hồ sơ, quản lý ảnh, cập nhật bộ lọc, kèm modal "Xem trước thẻ hồ sơ" (Profile Card view).
  - `src/components/ProtectedRoute.tsx`: Route guard tự động redirect sang `/onboarding` nếu tài khoản đăng nhập nhưng chưa hoàn tất onboarding.
- **Kiểm thử Supertest bắt buộc (`apps/api/test/profile-photos.e2e-spec.ts`)**:
  - Đã pass 100% (8/8 tests): từ chối định dạng sai, từ chối file > 8MB, cấp presigned upload URL, chặn quyền xác nhận ảnh của người khác (403), từ chối minAge < 18, cập nhật preferences hợp lệ, cập nhật toạ độ GPS không làm lộ toạ độ nhạy cảm, và loại bỏ metadata EXIF GPS bằng Sharp.

### 2. Quyết định kỹ thuật quan trọng
- **Bảo mật toạ độ GPS**: Toạ độ người dùng được lưu trữ bằng kiểu `geography(Point,4326)` trong PostgreSQL PostGIS; API chỉ cập nhật toạ độ và không bao giờ phản hồi toạ độ thô ra ngoài, chuẩn bị cho thuật toán tính khoảng cách làm tròn 5 km ở Bước 4.
- **Bảo mật ảnh & EXIF Stripping**: Xử lý ảnh bằng thư viện `sharp` loại bỏ hoàn toàn thẻ EXIF GPS trước khi lưu trữ nhằm chống lộ vị trí chụp ảnh của người dùng.
- **Ràng buộc tuổi tìm kiếm**: Ràng buộc `minAge >= 18` được thực thi nghiêm ngặt ở tầng Shared DTO, Controller validation pipe, và Service layer.

### 3. Lệnh để chạy và kiểm tra lại bước này
```bash
# 1. Chạy e2e tests cho Hồ sơ & Ảnh
pnpm --filter @meetcall/api test:e2e test/profile-photos.e2e-spec.ts

# 2. Chạy toàn bộ e2e test suite
pnpm --filter @meetcall/api test:e2e

# 3. Build toàn bộ monorepo
pnpm build
```

### 4. Bước kế tiếp
- **Bước 4: Khám phá, vuốt thẻ và tạo match**: Query tìm kiếm PostGIS `ST_DWithin`, làm tròn khoảng cách 5 km, ghi nhận lượt quẹt (swipe), transaction kiểm tra like chéo và tạo match, thông báo realtime qua Socket.IO.
