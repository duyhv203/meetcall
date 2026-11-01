# Sổ Tay Vận Hành & Xử Lý Sự Cố (Production Runbook)

Sổ tay này cung cấp các kịch bản vận hành thực tế, sao lưu dữ liệu, bảo trì định kỳ, và quy trình ứng cứu sự cố khẩn cấp (Incident Response) cho hệ thống MeetCall.

---

## 1. Giám Sát & Nhật Ký Hoạt Động (Logs & Monitoring)

### Xem nhật ký realtime của từng dịch vụ
```bash
# Xem log toàn bộ hệ thống
docker compose -f docker-compose.prod.yml logs -f --tail=100

# Xem riêng log Backend API (các cảnh báo, lỗi, HTTP requests)
docker compose -f docker-compose.prod.yml logs -f api

# Xem log Reverse Proxy Caddy (chứng chỉ SSL, truy cập HTTPS)
docker compose -f docker-compose.prod.yml logs -f caddy

# Xem log STUN / TURN Server (kết nối WebRTC, ICE candidates)
docker compose -f docker-compose.prod.yml logs -f coturn
```

---

## 2. Sao Lưu & Phục Hồi Dữ Liệu (Backup & Restore)

### 2.1. Sao lưu Cơ sở dữ liệu PostgreSQL & PostGIS
```bash
# Tạo bản sao lưu định dạng nén SQL
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U meetcall -d meetcall -F c -b -v -f /tmp/backup.dump
docker cp $(docker compose -f docker-compose.prod.yml ps -q postgres):/tmp/backup.dump ./backups/meetcall_$(date +%Y%m%d_%H%M%S).dump

# Thiết lập cronjob sao lưu tự động hàng ngày vào 02:00 sáng
0 2 * * * /opt/meetcall/scripts/backup-db.sh >> /var/log/meetcall-backup.log 2>&1
```

### 2.2. Phục hồi dữ liệu (Restore)
```bash
# Dừng API để tránh ghi đè dữ liệu mới trong khi phục hồi
docker compose -f docker-compose.prod.yml stop api

# Phục hồi dữ liệu từ file dump
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U meetcall -d meetcall --clean --if-exists /tmp/backup.dump

# Khởi động lại API
docker compose -f docker-compose.prod.yml start api
```

### 2.3. Sao lưu Redis AOF / RDB
Dữ liệu Redis (hàng đợi ngẫu nhiên, presence, rate limit) được lưu trữ liên tục tại volume `redis_prod`.
```bash
# Kích hoạt snapshot ngay lập tức
docker compose -f docker-compose.prod.yml exec redis redis-cli -a "<REDIS_PASSWORD>" BGSAVE
```

---

## 3. Kịch Bản Xử Lý Sự Cố Khẩn Cấp (Troubleshooting & Runbook)

### Kịch bản 1: Không kết nối được Video Call giữa 2 người (WebRTC Failed)
1. **Triệu chứng**: Giao diện hiển thị "Đang kết nối...", sau đó báo lỗi hoặc đứng hình đen.
2. **Nguyên nhân phổ biến**:
   - Tường lửa (Firewall) chưa mở cổng UDP STUN/TURN (cổng 3478 hoặc dải 49152:65535).
   - Secret key `TURN_SECRET` cấu hình lệch giữa file `.env.production` và `turnserver.conf`.
3. **Cách khắc phục**:
   - Kiểm tra log coturn: `docker compose -f docker-compose.prod.yml logs coturn`.
   - Kiểm tra mở port bằng lệnh: `sudo ufw status verbose` hoặc `nc -z -v -u <IP_MAY_CHU> 3478`.
   - Kiểm tra endpoint lấy credential: `curl -H "Authorization: Bearer <TOKEN>" https://meetcall.yourdomain.com/api/v1/calls/ice-servers`.

### Kịch bản 2: Báo cáo vi phạm dồn dập hoặc nghi ngờ tấn công Bot
1. **Triệu chứng**: Số lượng báo cáo hoặc swipe tăng đột biến trong thời gian ngắn.
2. **Cơ chế tự động**:
   - Người dùng nhận >= 3 báo cáo trong 24h tự động bị khoá gọi ngẫu nhiên (`randomBannedUntil = NOW() + 24h`).
   - Giới hạn 100 like / 12h và 200 next / 1h tự động ngăn chặn bot.
3. **Hành động thủ công khẩn cấp của Quản trị viên**:
   - Đăng nhập trang `/admin`.
   - Tab "Báo cáo vi phạm": các báo cáo lý do `minor` được gắn cờ đỏ khẩn cấp.
   - Nhấn "Khoá tài khoản (Suspend)" hoặc "Cấm vĩnh viễn (Ban)" để đình chỉ ngay lập tức và thu hồi toàn bộ tokens của kẻ tấn công.

### Kịch bản 3: Hết dung lượng đĩa hoặc RAM cao (OOM)
1. **Kiểm tra**: `docker stats` và `df -h`.
2. **Dọn dẹp**:
   ```bash
   docker system prune -f
   docker volume prune -f
   ```
