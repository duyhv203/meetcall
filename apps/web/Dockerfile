# Multi-stage Dockerfile for MeetCall React Frontend
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# Builder stage
FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @meetcall/shared build
RUN pnpm --filter @meetcall/web build

# Static Server stage using Caddy
FROM caddy:2-alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/caddy
COPY <<EOF /etc/caddy/Caddyfile
:80 {
    root * /usr/share/caddy
    encode gzip zstd
    try_files {path} /index.html
    file_server
}
EOF

EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
