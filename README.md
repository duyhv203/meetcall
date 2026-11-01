# MeetCall Monorepo

Ứng dụng hẹn hò dạng vuốt thẻ, chat realtime, gọi video 1-1 với người đã match và gọi video ngẫu nhiên kiểu Omegle/Azar.

## Kiến trúc Monorepo

- `apps/api`: Backend REST API & WebSocket gateway (NestJS + TypeScript, Prisma ORM, PostgreSQL + PostGIS, Redis).
- `apps/web`: Frontend SPA (React 19, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand).
- `packages/shared`: Package chia sẻ types, enums, interfaces giữa API và Web.

## Yêu cầu môi trường

- Node.js >= 22
- pnpm >= 12
- Docker Desktop (cho PostgreSQL PostGIS, Redis, Mailpit)

## Hướng dẫn khởi chạy từ đầu

1. **Khởi động các dịch vụ phụ trợ (Postgres, Redis, Mailpit):**
   ```bash
   docker compose up -d
   ```

2. **Cài đặt dependencies:**
   ```bash
   pnpm install
   ```

3. **Chạy Database Migration & Seed dữ liệu mẫu (5 tài khoản):**
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

4. **Khởi động môi trường phát triển (chạy song song API và Web):**
   ```bash
   pnpm dev
   ```
   - API: [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)
   - Web: [http://localhost:5173](http://localhost:5173)
   - Mailpit Web UI: [http://localhost:8025](http://localhost:8025)

## Các lệnh kiểm tra & chất lượng mã nguồn

- `pnpm lint`: Kiểm tra ESLint cho toàn bộ dự án.
- `pnpm typecheck`: Kiểm tra TypeScript strict không lỗi.
- `pnpm test`: Chạy toàn bộ Unit test, DB Constraint test và E2E API test.
- `pnpm build`: Build production cho tất cả packages.
