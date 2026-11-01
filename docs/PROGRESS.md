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

### 2. Quyết định kỹ thuật quan trọng
- **PostGIS geography(Point,4326)**: Sử dụng kiểu geography và GIST index để tối ưu các truy vấn khoảng cách bán kính `ST_DWithin` ở các bước khám phá sau này.
- **CHECK ràng buộc 18 tuổi ở tầng DB**: Ràng buộc trực tiếp tại PostgreSQL `CHECK (birthdate <= CURRENT_DATE - INTERVAL '18 years')` nhằm đảm bảo dữ liệu không bao giờ bị vi phạm dù ở bất kỳ tầng nào.
- **Sắp xếp thứ tự ID match**: Luôn lưu `user_a < user_b` kết hợp `UNIQUE(user_a, user_b)` để ngăn ngừa hoàn toàn match trùng lặp khi hai người vuốt cùng lúc.
- **Quản lý cấu hình tập trung**: Bắt buộc kiểm tra biến môi trường qua Zod khi ứng dụng boot để fail-fast ngay lập tức nếu thiếu cấu hình.

### 3. Biến môi trường mới trong .env.example
- `NODE_ENV`, `PORT`, `API_PREFIX`, `WEB_ORIGIN`
- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`

### 4. Lệnh để chạy và kiểm tra lại bước này
```bash
# 1. Khởi động docker
docker compose up -d

# 2. Migration và seed
pnpm db:migrate
pnpm db:seed

# 3. Chạy toàn bộ test
pnpm test

# 4. Kiểm tra code quality & build
pnpm lint
pnpm typecheck
pnpm build
```

### 5. Việc còn nợ hoặc rủi ro đã biết
- Chưa triển khai các endpoint nghiệp vụ và màn hình auth (nằm trong phạm vi Bước 2).

### 6. Bước kế tiếp
- **Bước 2: Xác thực (Auth)**: Làm module đăng ký, đăng nhập, refresh token xoay vòng, quên mật khẩu, AuthGuard, argon2id, rate limit và các màn hình React tương ứng.

---
**Gợi ý commit message**:
`feat: initialize monorepo, docker compose, prisma postgis schema, ci and health check`
