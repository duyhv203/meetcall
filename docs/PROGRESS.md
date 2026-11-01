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

---

## Bước 4: Khám phá, vuốt thẻ và tạo match (Đã hoàn thành)

### 1. Đã làm
- **Shared Types & DTOs**:
  - `packages/shared/src/discovery.dto.ts`: `DiscoverCandidate`, `SwipeAction`, `SwipeRequest`, `SwipeResponse`, `MatchItem`, `MatchPartner`.
- **Backend Realtime Gateway (`apps/api`)**:
  - `RealtimeGateway` & `RealtimeModule` (@nestjs/websockets + socket.io):
    - Xác thực JWT Bearer trong handshake.
    - Đưa từng user vào room riêng biệt `user:{userId}`.
    - Helper `emitToUser(userId, event, payload)` phát thông báo match tức thời.
- **Backend Khám phá (`DiscoveryService` & `DiscoveryController`)**:
  - `GET /api/v1/discover`:
    - Truy vấn PostGIS không gian `ST_DWithin` theo bán kính `maxDistanceKm`.
    - Tính khoảng cách bảo mật, làm tròn theo bội số 5 km: `GREATEST(5, ROUND(ST_Distance(...) / 5000.0) * 5)`.
    - Lọc theo độ tuổi (`minAge` đến `maxAge`) và giới tính (`genderFilter`).
    - Loại trừ chính mình, loại trừ người đã từng quẹt, loại trừ người đã bị chặn cả 2 chiều (block).
    - Chỉ hiển thị người có trạng thái `active` và có ít nhất 1 ảnh đã kiểm duyệt (`moderationStatus = 'approved'`).
- **Backend Quẹt thẻ (`SwipesService` & `SwipesController`)**:
  - `POST /api/v1/swipes`:
    - Chặn tự quẹt chính mình (`400 CANNOT_SWIPE_SELF`).
    - Giới hạn Like (Rate Limit): Tối đa 100 lượt thích trong 12 giờ qua Redis key `rate:likes:{userId}`, vi phạm trả `429 LIKE_LIMIT`. Thao tác 'pass' không bị giới hạn.
    - Transaction nguyên tử: ghi nhận bảng `swipes`, kiểm tra like tương hỗ (`reciprocalLike`).
    - Nếu hai bên cùng thích nhau:
      - Tạo bản ghi trong bảng `matches` đảm bảo ràng buộc `user_a < user_b` với `ON CONFLICT DO NOTHING`.
      - Phát sự kiện WebSocket `match:new` tới room của cả 2 user.
      - Trả về `{ match: true, matchId, matchedUser }`.
- **Backend Quản lý Tương hợp (`MatchesService` & `MatchesController`)**:
  - `GET /api/v1/matches`: Trả danh sách tương hợp kèm thông tin đối phương (tên, tuổi, avatar, vị trí, tin nhắn mới nhất).
  - `DELETE /api/v1/matches/:id`: Huỷ tương hợp an toàn (đánh dấu `unmatched_at`), chỉ thành viên tham gia mới có quyền huỷ (`403 FORBIDDEN` nếu không thuộc match).
- **Frontend Web (`apps/web`)**:
  - `src/lib/socket.ts`: Client Socket.IO tự động xác thực token và duy trì kết nối.
  - `src/stores/discoverStore.ts` & `src/stores/matchStore.ts`: Zustand stores quản lý ứng viên, lượt quẹt lạc quan (optimistic swipe), và danh sách match.
  - `src/features/discover/DiscoverPage.tsx`:
    - Thẻ quẹt vuốt ảnh đa chiều (ảnh chính/phụ, nút like/pass, hiệu ứng vuốt thẻ).
    - Hỗ trợ phím tắt: mũi tên trái (Pass), mũi tên phải (Like), mũi tên lên/xuống (chuyển ảnh).
    - Popup "It's a Match!" rực rỡ khi tạo match thành công với nút "Nhắn tin ngay" và "Tiếp tục quẹt thẻ".
    - Màn hình trống khi hết hồ sơ kèm nút tìm kiếm lại và mở rộng bán kính.
  - `src/features/matches/MatchesPage.tsx`:
    - Danh sách tương hợp dạng lưới responsive, hiển thị avatar, tuổi, thành phố, bio, tin nhắn mới nhất.
    - Nút "Nhắn tin" và nút "Huỷ tương hợp" kèm hộp thoại xác nhận cảnh báo.
- **Kiểm thử Supertest bắt buộc (`apps/api/test/discovery-swipes.e2e-spec.ts`)**:
  - Đã pass 100% (8/8 tests): trả ứng viên làm tròn 5km, quẹt pass không tạo match, loại trừ người đã quẹt khỏi discover, quẹt like 1 chiều, quẹt like tương hỗ tạo match đúng chuẩn DB `user_a < user_b`, rate limit 100 likes/12h (429 LIKE_LIMIT), lấy danh sách matches, huỷ match thành công.

### 2. Quyết định kỹ thuật quan trọng
- **Bảo mật tuyệt đối vị trí**: Sử dụng hàm PostGIS `ST_Distance` kết hợp `ROUND(... / 5000.0) * 5` đảm bảo khoảng cách luôn hiển thị là ~5 km, ~10 km, ~15 km... bảo vệ quyền riêng tư người dùng.
- **Ràng buộc duy nhất & Chống Race Condition**: Khớp nối match bằng cặp `user_a < user_b` trong transaction đảm bảo không bao giờ sinh ra match kép giữa cùng một cặp người dùng dù cả hai cùng quẹt thích cùng một thời điểm.
- **Rate Limit Redis**: Sử dụng `INCR` và `EXPIRE` của Redis cho giới hạn 100 like/12h vừa nhẹ vừa hiệu năng cao.

### 3. Lệnh để chạy và kiểm tra lại bước này
```bash
# 1. Chạy e2e tests cho Khám phá, Vuốt thẻ & Tương hợp
pnpm --filter @meetcall/api test:e2e test/discovery-swipes.e2e-spec.ts

# 2. Chạy toàn bộ e2e test suite (27 tests)
pnpm --filter @meetcall/api test:e2e

# 3. Build toàn bộ monorepo
pnpm build
```

---

## Bước 5: Chat Realtime (Đã hoàn thành)

### 1. Đã làm
- **Shared Types & DTOs**:
  - `packages/shared/src/chat.dto.ts`: `ChatMessage`, `MessagesResponse`, `SendMessageRequest`, `ChatTypingPayload`, `UserPresenceResponse`.
- **Backend Chat & Presence Module (`apps/api`)**:
  - `ChatService`:
    - Phân trang cursor theo thời gian tạo tin nhắn `createdAt`: `GET /api/v1/matches/:id/messages?cursor=&limit=30`.
    - Kiểm tra bảo mật chặt chẽ: Chỉ thành viên trong match (`userA` hoặc `userB`) và chưa unmatch mới có quyền xem / gửi tin nhắn (`403 FORBIDDEN`).
    - Gửi tin nhắn (`sendMessage` qua REST hoặc WebSocket):
      - Kiểm tra nội dung rỗng / quá 2000 ký tự (`400 EMPTY_MESSAGE`).
      - Chống link spam / lừa đảo: Tối đa 2 link trong 1 tin nhắn (`400 TOO_MANY_LINKS`).
      - Rate limiting Redis: Tối đa 30 tin nhắn / phút cho mỗi tài khoản, vượt quá trả `429 RATE_LIMIT_EXCEEDED`.
      - Cập nhật `profiles.last_active_at` cho người gửi.
      - Phát sự kiện WebSocket `chat:message` tới room của cả 2 user.
    - Đánh dấu đã xem (`markAsRead`):
      - Cập nhật `read_at = NOW()` cho toàn bộ tin nhắn chưa đọc từ đối phương trong match.
      - Phát sự kiện WebSocket `chat:read` để đối phương cập nhật trạng thái đã xem tức thời.
    - Trạng thái Presence (Online / Offline):
      - Ghi nhận `presence:{userId}` trong Redis với TTL 60 giây khi kết nối hoặc khi nhận `presence:heartbeat`.
      - Endpoint `GET /api/v1/users/:id/presence` trả về trạng thái online.
  - `RealtimeGateway`:
    - Đón nhận sự kiện `@SubscribeMessage('chat:send')`, `@SubscribeMessage('chat:typing')`, `@SubscribeMessage('chat:read')`, `@SubscribeMessage('presence:heartbeat')`.
- **Frontend Web (`apps/web`)**:
  - `src/stores/chatStore.ts`: Zustand store quản lý tin nhắn, phân trang cursor vô tận (infinite scroll), chỉ báo typing và sự kiện realtime.
  - `src/features/chat/ChatPage.tsx`:
    - Header: Avatar đối phương, tên, tuổi, chấm xanh trực tuyến (online presence), nút bắt đầu cuộc gọi video.
    - Khung chat cuộn mượt:
      - Tin nhắn của mình (bên phải, màu rose/gradient), tin nhắn đối phương (bên trái, màu slate).
      - Trạng thái gửi / đã xem (icon tick xám / tick kép rose).
      - Chỉ báo typing animation (3 chấm nảy) khi đối phương đang soạn tin.
      - Nút tải tin nhắn cũ hơn khi cuộn lên đầu.
    - Khung nhập tin nhắn:
      - Ô nhập text, hỗ trợ Enter để gửi, tự động phát sự kiện typing và debounce tự tắt.
- **Kiểm thử Supertest bắt buộc (`apps/api/test/chat.e2e-spec.ts`)**:
  - Đã pass 100% (8/8 tests): gửi tin nhắn thành công, chặn người ngoài match (403), từ chối tin nhắn rỗng, chặn spam > 2 link, rate limit 30 msg/min, phân trang cursor 2 chiều, đánh dấu đã xem `readAt`, kiểm tra presence online / offline.

### 2. Quyết định kỹ thuật quan trọng
- **Bảo mật & Phòng chống Gian lận (Anti-Phishing / Anti-Spam)**: Thực thi bộ lọc regex link trực tiếp ở server giới hạn tối đa 2 link/tin nhắn, kết hợp rate limiting 30 tin nhắn/phút trong Redis để ngăn bot quấy rối người dùng.
- **Phân trang Cursor**: Không sử dụng `offset` vì dễ bị lệch khi có tin nhắn mới gửi đến; sử dụng `createdAt` cursor pagination đảm bảo cuộn xem lịch sử tin nhắn luôn ổn định và hiệu năng cao.
- **Presence TTL Redis**: Sử dụng Redis key với TTL ngắn 60 giây và heartbeat chu kỳ giúp phát hiện người dùng ngắt kết nối chính xác mà không làm nặng cơ sở dữ liệu chính.

### 3. Lệnh để chạy và kiểm tra lại bước này
```bash
# 1. Chạy e2e tests cho Chat & Realtime
pnpm --filter @meetcall/api test:e2e test/chat.e2e-spec.ts

# 2. Chạy toàn bộ e2e test suite (35 tests)
pnpm --filter @meetcall/api test:e2e

# 3. Build toàn bộ monorepo
pnpm build
```

---

## Bước 6: Gọi video giữa 2 người đã match & Cấu hình TURN (Đã hoàn thành)

### 1. Đã làm
- **Shared Types & DTOs**:
  - `packages/shared/src/call.dto.ts`: `RtcIceServer`, `IceServersResponse`, `InitiateCallRequest`, `InitiateCallResponse`, `EndCallRequest`, `CallIncomingPayload`, `RtcSignalPayload`.
- **Hạ tầng Coturn STUN / TURN Server**:
  - `infra/coturn/turnserver.conf`: Cấu hình coturn với cơ chế xác thực ngắn hạn `use-auth-secret`, `static-auth-secret`, realm `meetcall.local`, cổng UDP/TCP 3478, TLS 5349, dải port relay 49152-65535, chống loopback và multicast abuse.
  - `docs/turn.md`: Tài liệu chi tiết hướng dẫn vận hành STUN/TURN, cơ chế NAT Traversal và triển khai qua Docker.
- **Backend Calls Module (`apps/api`)**:
  - `CallsService`:
    - `GET /api/v1/calls/ice-servers`: Sinh thông tin STUN và TURN credentials động sử dụng HMAC-SHA1 (`username = timestamp:userId`, `password = Base64(HMAC-SHA1(username, secret))`, TTL 24 giờ).
    - `POST /api/v1/calls/initiate`: Khởi tạo cuộc gọi match, kiểm tra người dùng bận máy (`409 USER_BUSY`), lưu bản ghi bảng `calls`, hẹn giờ 30 giây tự động huỷ nếu đối phương không trả lời (`endReason = 'missed'`).
    - `POST /api/v1/calls/:id/accept`: Nhận cuộc gọi, huỷ timer 30s, cập nhật `started_at = NOW()`.
    - `POST /api/v1/calls/:id/decline`: Từ chối cuộc gọi, cập nhật `endReason = 'declined'`.
    - `POST /api/v1/calls/:id/end`: Kết thúc cuộc gọi, tính toán chính xác thời lượng đàm thoại (`durationSeconds`).
    - `forwardSignal`: Chuyển tiếp gói tin WebRTC SDP Offer/Answer và ICE Candidate, thực thi giới hạn kích thước payload tối đa 16 KB chống tấn công tràn bộ nhớ (`400 SIGNAL_TOO_LARGE`).
  - `RealtimeGateway`:
    - Đón nhận và điều phối các sự kiện signaling: `call:accept`, `call:decline`, `call:end`, `rtc:signal`.
- **Frontend Web (`apps/web`)**:
  - `src/stores/callStore.ts`: Quản lý `RTCPeerConnection`, `localStream`, `remoteStream`, đệm ICE candidate (`pendingCandidates`), bật/tắt mic/camera, dọn dẹp dừng stream (`track.stop()`) khi gác máy.
  - `src/components/IncomingCallModal.tsx`: Hộp thoại cuộc gọi đến toàn cục kèm chuông báo synth audio (Web Audio API), hiển thị avatar/tên caller và nút Nhận/Từ chối.
  - `src/features/calls/CallPage.tsx`: Màn hình Video Call toàn màn hình, remote video lớn, local video dạng PiP ở góc, đồng hồ đếm thời lượng gọi, thanh điều khiển nổi (Bật/Tắt Mic, Camera, Kết thúc cuộc gọi).
- **Kiểm thử Supertest bắt buộc (`apps/api/test/calls.e2e-spec.ts`)**:
  - Đã pass 100% (7/7 tests): sinh TURN credentials đúng công thức HMAC-SHA1, khởi tạo cuộc gọi match, chặn người ngoài match (403), kiểm tra bận máy (409 USER_BUSY), nhận cuộc gọi cập nhật `startedAt`, kết thúc cuộc gọi tính thời lượng, và từ chối signal > 16 KB.

### 2. Quyết định kỹ thuật quan trọng
- **Bảo mật TURN Ephemeral Credentials**: Áp dụng chuẩn RFC 5766 sinh username và password theo thuật toán HMAC-SHA1 thời hạn 24 giờ, tránh việc lộ mật khẩu TURN server tĩnh ra client.
- **Quản lý tài nguyên MediaStream**: Triệt để lặp qua tất cả tracks của `MediaStream` và gọi `track.stop()` ngay khi cuộc gọi kết thúc nhằm giải phóng camera/microphone của thiết bị và tắt đèn báo phần cứng.
- **Chống DoS Signaling**: Giới hạn payload của các gói tin signaling (SDP và ICE candidates) không được vượt quá 16 KB.

### 3. Lệnh để chạy và kiểm tra lại bước này
```bash
# 1. Chạy e2e tests cho Gọi Video & WebRTC
pnpm --filter @meetcall/api test:e2e test/calls.e2e-spec.ts

# 2. Chạy toàn bộ e2e test suite (42 tests)
pnpm --filter @meetcall/api test:e2e

# 3. Build toàn bộ monorepo
pnpm build
```

### 4. Bước kế tiếp
- **Bước 7: Gọi video ngẫu nhiên kiểu Omegle / Azar (Đã hoàn thành)**

---

## Bước 7: Gọi video ngẫu nhiên kiểu Omegle / Azar (Đã hoàn thành)

### 1. Đã làm
- **Shared Types & DTOs**:
  - `packages/shared/src/random.dto.ts`: `RandomEligibilityResponse`, `FriendVoteRequest`, `FriendVoteResponse`, `RandomSocketEvents`.
- **Backend Random Module (`apps/api`)**:
  - `RandomService`:
    - `GET /api/v1/random/eligibility`: Kiểm tra điều kiện tham gia gọi ngẫu nhiên: bắt buộc đủ 18 tuổi (`403 AGE_NOT_VERIFIED`), không bị cấm tính năng gọi ngẫu nhiên (`403 RANDOM_BANNED` nếu `randomBannedUntil > NOW()`).
    - Khởi tạo hàng đợi ghép cặp Redis Atomic bằng Lua script / Redis transaction (`meetcall:random:queue`), lấy cặp người dùng đồng thời, loại trừ bản thân.
    - Cơ chế chống lặp cặp (10-minute pair cooldown): Sử dụng Redis set với key `meetcall:cooldown:<pairKey>` có TTL 600 giây.
    - Rate limit chống spam Next: Giới hạn tối đa 200 lượt next / 1 giờ (`429 RATE_LIMIT_EXCEEDED`).
    - `POST /api/v1/calls/:id/friend-vote`: Ghi nhận phiếu vote kết bạn vào bảng `call_friend_votes`. Nếu cả 2 bên cùng vote đồng ý, hệ thống tự động tạo match trong bảng `matches` (đảm bảo ràng buộc `user_a < user_b`) và phát sự kiện `random:friend_match` realtime.
  - `RealtimeGateway`:
    - Đón nhận các sự kiện: `random:join`, `random:next`, `random:leave`.
    - Tự động huỷ khỏi hàng đợi khi ngắt kết nối (`disconnect`).
- **Frontend Web (`apps/web`)**:
  - `src/stores/randomStore.ts`: Quản lý trạng thái gọi ngẫu nhiên, radar tìm kiếm, WebRTC PeerConnection, đệm candidate, và xử lý kết bạn / chuyển người khác.
  - `src/features/random/RandomPage.tsx`:
    - Bước xác nhận tuân thủ quy tắc cộng đồng 18+ và điều khoản an toàn trước khi vào phòng.
    - Hiệu ứng radar tìm kiếm đối phương khi đang trong hàng đợi.
    - Giao diện Dual Video (người lạ trên, webcam mình dưới góc phải).
    - Các nút điều khiển: Next (chuyển người khác), Kết thúc, Báo cáo vi phạm, và Nút Thả tim kết bạn (Friend Vote).
    - Modal chúc mừng khi cả 2 cùng vote kết bạn thành công ("It's a Match!").
- **Kiểm thử Supertest bắt buộc (`apps/api/test/random.e2e-spec.ts`)**:
  - Đã pass 100% (7/7 tests):
    1. Chặn người dùng chưa xác minh tuổi 18+ (403 AGE_NOT_VERIFIED)
    2. Chặn người dùng đang bị khoá gọi ngẫu nhiên (403 RANDOM_BANNED)
    3. Trả về hợp lệ 200 OK cho người dùng đủ điều kiện
    4. Ghép cặp ngẫu nhiên nguyên tử qua hàng đợi Redis
    5. Chống lặp cặp trong 10 phút giữa 2 người vừa nói chuyện
    6. Chặn vượt quá giới hạn 200 lượt next / giờ (429 RATE_LIMIT_EXCEEDED)
    7. Vote kết bạn: 1 bên vote chưa tạo match, 2 bên cùng vote tự động tạo match
- **Tổng số tests e2e toàn hệ thống**: 49 tests (7 suites) đều pass tuyệt đối!

### 2. Quyết định kỹ thuật quan trọng
- **Ghép cặp nguyên tử (Atomic Matchmaking)**: Sử dụng Redis queue kết hợp kiểm tra cooldown trực tiếp trước khi ghép cặp, tránh tình trạng race-condition khi hàng ngàn người dùng tìm kiếm đồng thời.
- **Ràng buộc an toàn & Chống quấy rối**: Tách biệt thời gian khoá gọi ngẫu nhiên `randomBannedUntil` trong database, cho phép đình chỉ tính năng gọi ngẫu nhiên mà không cần khoá hẳn toàn bộ tài khoản nếu vi phạm ở mức độ cảnh cáo.

### 3. Lệnh để chạy và kiểm tra lại bước này
```bash
# 1. Chạy e2e tests cho Random Calls
pnpm --filter @meetcall/api test:e2e test/random.e2e-spec.ts

# 2. Chạy toàn bộ e2e test suite (49 tests)
pnpm --filter @meetcall/api test:e2e

# 3. Build toàn bộ monorepo
pnpm build
```

### 4. Bước kế tiếp
- **Bước 8: An toàn và quản trị (Đã hoàn thành)**

---

## Bước 8: An toàn và quản trị (Safety & Admin) (Đã hoàn thành)

### 1. Đã làm
- **Shared Types & DTOs**:
  - `packages/shared/src/safety.dto.ts`: `CreateBlockRequest`, `BlockItemResponse`, `CreateReportRequest`, `CreateReportResponse`, `AdminReportItem`, `ResolveReportRequest`, `SuspendUserRequest`, `ModeratePhotoRequest`, `AgeVerificationWebhookPayload`.
- **Backend Safety & Admin Module (`apps/api`)**:
  - `RolesGuard` & `@Roles('admin')`: Phân quyền RBAC quản trị viên nghiêm ngặt, từ chối người dùng thường (`403 FORBIDDEN`).
  - `SafetyService` & `SafetyController`:
    - `POST /api/v1/blocks`: Chặn người dùng, từ chối tự chặn (`400 CANNOT_BLOCK_SELF`), tự động unmatch nếu có match giữa 2 bên, loại trừ 2 chiều trong Discovery, Chat (`403 USER_BLOCKED`), và Random Call.
    - `GET /api/v1/blocks`: Lấy danh sách người đã chặn kèm thông tin hiển thị và ảnh đại diện.
    - `DELETE /api/v1/blocks/:blockedId`: Huỷ chặn người dùng.
    - `POST /api/v1/reports`: Báo cáo vi phạm với các lý do (`nudity`, `harassment`, `minor`, `scam`, `spam`, `other`). Tự động khoá gọi ngẫu nhiên 24 giờ (`randomBannedUntil = NOW() + 24h`) nếu tài khoản nhận từ 3 báo cáo trở lên trong vòng 24 giờ.
    - `POST /api/v1/age-verification/webhook`: Tiếp nhận webhook KYC xác minh tuổi với chữ ký bảo mật HMAC-SHA256 (`x-webhook-signature`), từ chối chữ ký sai (`401 INVALID_SIGNATURE`), cập nhật `ageVerified = true`, hoặc đình chỉ tài khoản (`status = 'suspended'`) nếu phát hiện dưới 18 tuổi.
  - `AdminService` & `AdminController`:
    - `GET /api/v1/admin/reports`: Danh sách báo cáo vi phạm, tự động gắn cờ `priority: 'urgent'` và ưu tiên đưa lên hàng đầu đối với các báo cáo có lý do `minor`.
    - `POST /api/v1/admin/reports/:id/resolve`: Giải quyết báo cáo (`dismiss`, `warn`, `suspend`, `ban`), nếu `suspend`/`ban` sẽ cập nhật `status = 'suspended'`, thu hồi toàn bộ refresh tokens, và ghi vết kiểm toán vào bảng `admin_actions`.
    - `POST /api/v1/admin/users/:id/suspend`: Đình chỉ hoặc mở khoá tài khoản trực tiếp, ghi log `admin_actions`.
    - `GET /api/v1/admin/photos` & `POST /api/v1/admin/photos/:id/moderate`: Kiểm duyệt ảnh đại diện người dùng (`approved` / `rejected`).
- **Frontend Web (`apps/web`)**:
  - `src/components/ReportModal.tsx`: Hộp thoại báo cáo vi phạm chuẩn UI với 6 lý do vi phạm, nhãn ưu tiên xử lý cho `minor`, và ô nhập chi tiết bổ sung.
  - `src/components/BlockButton.tsx`: Nút chặn người dùng kèm hộp thoại xác nhận cảnh báo huỷ tương hợp và ngăn liên lạc.
  - `src/features/settings/BlockedUsersPage.tsx`: Màn hình danh sách người đã chặn tại route `/settings/blocked` kèm nút Bỏ chặn.
  - `src/components/AdminRoute.tsx`: Route guard kiểm tra `user.role === 'admin'`, hiển thị màn hình 403 từ chối nếu không phải admin.
  - `src/features/admin/AdminDashboardPage.tsx`: Trung tâm Quản trị tại route `/admin` gồm 3 tab: Báo cáo vi phạm (thẻ đỏ nhấp nháy cho báo cáo khẩn cấp `minor`, các nút hành động Bỏ qua/Cảnh cáo/Khoá/Cấm), Kiểm duyệt ảnh (lưới duyệt ảnh), và Quản lý tài khoản (khoá/mở khoá theo UUID).
- **Kiểm thử Supertest bắt buộc (`apps/api/test/safety-admin.e2e-spec.ts`)**:
  - Đã pass 100% (15/15 tests):
    1. Từ chối tự chặn chính mình (400 CANNOT_BLOCK_SELF)
    2. Chặn User B thành công và tự động unmatch
    3. Lấy danh sách người đã chặn chứa User B
    4. Chặn 2 chiều: User B không thể nhắn tin cho User A
    5. Bỏ chặn User B thành công
    6. Từ chối tự báo cáo chính mình (400 CANNOT_REPORT_SELF)
    7. Tự động khoá Random Call 24h khi nhận 3 báo cáo trong 24h
    8. User thường bị từ chối truy cập admin (403 FORBIDDEN)
    9. Admin xem danh sách báo cáo, ưu tiên báo cáo lý do `minor` lên đầu
    10. Admin resolve report với action `suspend` -> khoá tài khoản người vi phạm
    11. Admin mở khoá tài khoản người dùng thành công
    12. Admin xem ảnh pending và duyệt ảnh approved
    13. Webhook từ chối sai chữ ký HMAC (401 INVALID_SIGNATURE)
    14. Webhook xác minh độ tuổi thành công với HMAC hợp lệ
    15. Webhook từ chối và đình chỉ tài khoản nếu phát hiện dưới 18 tuổi
- **Tổng số tests e2e toàn hệ thống**: 64 tests (8 suites) đều pass tuyệt đối!

### 2. Quyết định kỹ thuật quan trọng
- **Bảo mật 2 chiều tuyệt đối (Two-Way Block Isolation)**: Thực thi loại trừ ở tầng cơ sở dữ liệu trên cả Discovery (`p.user_id NOT IN (blocks)`), Chat (`findFirst` OR `blocker/blocked`), và Random Matchmaking queue.
- **Bảo vệ trẻ em và ưu tiên khẩn cấp (Child Safety Priority)**: Mọi báo cáo với lý do `minor` được hệ thống tự động gán cờ `urgent` và sắp xếp nổi bật trên cùng bảng điều khiển của Admin để kiểm duyệt viên can thiệp tức thì.
- **Xác thực Webhook KYC bằng HMAC-SHA256**: Đảm bảo cổng tích hợp đối tác KYC (Persona/Stripe Identity) không thể bị giả mạo nhờ so sánh hash chữ ký secret `AGE_VERIFICATION_SECRET`.

### 3. Lệnh để chạy và kiểm tra lại bước này
```bash
# 1. Chạy e2e tests cho An toàn & Quản trị
pnpm --filter @meetcall/api test:e2e test/safety-admin.e2e-spec.ts

# 2. Chạy toàn bộ e2e test suite (64 tests)
pnpm --filter @meetcall/api test:e2e

# 3. Build toàn bộ monorepo
pnpm build
```

### 4. Bước kế tiếp
- **Bước 9: Thông báo đẩy, cài đặt tài khoản, xuất dữ liệu GDPR & Xoá tài khoản (Notifications & Settings)**:
  - Đăng ký Web Push subscription (`POST /api/v1/me/devices`, bảng `device_tokens`).
  - Gửi thông báo đẩy khi có match mới, tin nhắn mới, hoặc cuộc gọi nhỡ.
  - Soft-delete tài khoản (`DELETE /api/v1/me`), huỷ session, đổi trạng thái `deleted`, lên lịch hard-delete sau 7 ngày.
  - Xuất dữ liệu cá nhân theo GDPR (`GET /api/v1/me/export`).
  - Frontend: Service Worker Web Push (`public/sw.js`), trang `/settings` (thông báo, quyền riêng tư, xuất dữ liệu, xoá tài khoản), trang `/terms` và `/privacy`.
