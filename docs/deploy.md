# Hướng Dẫn Triển Khai Production (Deployment Guide)

Tài liệu này cung cấp quy trình từng bước đưa hệ thống MeetCall lên máy chủ Production (VPS / Dedicated Server chạy Ubuntu / Debian).

---

## 1. Yêu Cầu Phần Cứng & Môi Trường

- **Cấu hình tối thiểu**: 2 vCPU, 4GB RAM, 40GB SSD (khuyến nghị 4 vCPU, 8GB RAM).
- **Hệ điều hành**: Ubuntu 22.04 LTS hoặc 24.04 LTS.
- **Phần mềm bắt buộc**:
  - Docker >= 24.0 & Docker Compose V2.
  - Tên miền (Domain) đã trỏ DNS A Record về IP của máy chủ (ví dụ: `meetcall.com` và `turn.meetcall.com`).
  - Mở các cổng mạng tường lửa (UFW / Cloud Firewall):
    - Cổng HTTP/HTTPS: `80/tcp`, `443/tcp`.
    - Cổng STUN/TURN: `3478/tcp`, `3478/udp`, `5349/tcp`, `5349/udp`.
    - Dải cổng Relay WebRTC UDP: `49152:65535/udp`.

---

## 2. Các Bước Triển Khai

### Bước 2.1: Chuẩn bị máy chủ
```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Cấu hình tường lửa UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
sudo ufw enable
```

### Bước 2.2: Clone mã nguồn & Cấu hình biến môi trường
```bash
sudo mkdir -p /opt/meetcall
sudo chown $USER:$USER /opt/meetcall
cd /opt/meetcall

git clone <URL_REPO_CUA_BAN> .
cp .env.production.example .env.production

# Chỉnh sửa các giá trị bí mật
nano .env.production
```

### Bước 2.3: Chạy khởi động hệ thống qua Docker Compose
```bash
# Build và chạy ngầm toàn bộ dịch vụ
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Chạy migration database PostGIS
docker compose -f docker-compose.prod.yml exec -T api pnpm prisma migrate deploy

# Chạy nạp dữ liệu mẫu ban đầu (nếu cần)
docker compose -f docker-compose.prod.yml exec -T api pnpm prisma db seed
```

### Bước 2.4: Kiểm tra trạng thái hoạt động (Healthcheck)
```bash
# Kiểm tra trạng thái các container
docker compose -f docker-compose.prod.yml ps

# Kiểm tra endpoint sức khoẻ hệ thống
curl https://meetcall.yourdomain.com/api/v1/health
# Kết quả mong đợi: {"status":"ok","info":{"postgres":{"status":"up"},"redis":{"status":"up"}}}
```
