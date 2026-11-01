# Hướng Dẫn Cấu Hình STUN / TURN Server (WebRTC)

## 1. Giới thiệu
WebRTC kết nối Peer-to-Peer (P2P) trực tiếp giữa hai trình duyệt. Tuy nhiên, trong môi trường mạng thực tế (Symmetric NAT của router gia đình, mạng di động 4G/5G, tường lửa doanh nghiệp), có khoảng 15-25% cuộc gọi không thể kết nối trực tiếp P2P nếu chỉ có STUN.

Hệ thống MeetCall sử dụng:
1. **STUN (Session Traversal Utilities for NAT)**: Giúp client tìm ra IP Public và Port công khai của chính mình.
2. **TURN (Traversal Using Relays around NAT)**: Làm trạm trung chuyển (relay) media streams được mã hóa khi không thể thiết lập kết nối trực tiếp.

## 2. Cơ chế Xác thực Ngắn hạn (Ephemeral Credentials - RFC 5766)
Thay vì lưu tài khoản cố định trên server Coturn, MeetCall áp dụng cơ chế xác thực dựa trên bí mật chung (`static-auth-secret`):
- **Username**: `${timestamp}:${userId}` (trong đó timestamp là thời điểm hết hạn tính bằng epoch seconds).
- **Password**: `Base64(HMAC-SHA1(username, TURN_SECRET))`
- **TTL**: 86400 giây (24 giờ).

API `GET /api/v1/calls/ice-servers` sẽ tự động tính toán và trả về danh sách ICE servers kèm username và credential đã ký này.

## 3. Chạy Coturn bằng Docker
Trong môi trường production, chạy container Coturn với các port:
- UDP/TCP 3478 (STUN/TURN)
- UDP/TCP 5349 (TURNS với TLS)
- UDP 49152-65535 (Relay Media Ports)

Ví dụ Docker Run:
```bash
docker run -d --name meetcall-turn \
  --net=host \
  -v $(pwd)/infra/coturn/turnserver.conf:/etc/turnserver.conf \
  coturn/coturn:latest
```
