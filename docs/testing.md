# Hướng Dẫn Kiểm Thử Toàn Diện MeetCall (Testing Guide)

Tài liệu này hướng dẫn cách chạy toàn bộ các cấp độ kiểm thử trong hệ thống MeetCall: Kiểm thử tích hợp Backend (Supertest E2E), Kiểm thử luồng người dùng Frontend (Playwright E2E), và Kiểm thử tải (k6 Load Testing).

---

## 1. Kiểm thử Tích hợp Backend (Jest + Supertest)

Backend MeetCall sở hữu 9 bộ test suites với hơn 70 test cases kiểm tra từ Database constraints tới Realtime WebSocket:

```bash
# 1. Chạy toàn bộ 9 suites test e2e
pnpm --filter @meetcall/api test:e2e

# 2. Chạy riêng từng tính năng cụ thể
pnpm --filter @meetcall/api test:e2e test/underage.spec.ts
pnpm --filter @meetcall/api test:e2e test/auth.e2e-spec.ts
pnpm --filter @meetcall/api test:e2e test/profile-photos.e2e-spec.ts
pnpm --filter @meetcall/api test:e2e test/discovery-swipes.e2e-spec.ts
pnpm --filter @meetcall/api test:e2e test/chat.e2e-spec.ts
pnpm --filter @meetcall/api test:e2e test/calls.e2e-spec.ts
pnpm --filter @meetcall/api test:e2e test/random.e2e-spec.ts
pnpm --filter @meetcall/api test:e2e test/safety-admin.e2e-spec.ts
pnpm --filter @meetcall/api test:e2e test/notifications-account.e2e-spec.ts
```

---

## 2. Kiểm thử Giao diện Người dùng Đầu-cuối (Playwright E2E)

Playwright kiểm tra 5 kịch bản hành vi người dùng chính:
1. `01-auth-onboarding.spec.ts`: Đăng ký, chặn < 18 tuổi, hoàn tất onboarding.
2. `02-discover-swipe.spec.ts`: Khám phá thẻ ứng viên, khoảng cách 5km, vuốt Like/Pass, Match modal.
3. `03-chat-realtime.spec.ts`: Nhắn tin phòng chat, typing indicator, bộ lọc chống link spam.
4. `04-call-webrtc.spec.ts`: Gọi video 1-1, khởi tạo fake mic/cam, đồng hồ thời lượng.
5. `05-random-call.spec.ts`: Cam kết quy tắc cộng đồng 18+, radar tìm kiếm, Next & Friend Vote.

### Cách chạy Playwright:
```bash
# Khởi động backend và frontend trước khi chạy
pnpm dev

# Chạy kiểm thử Playwright
pnpm --filter @meetcall/web exec playwright test

# Xem báo cáo HTML kết quả kiểm thử
pnpm --filter @meetcall/web exec playwright show-report
```

---

## 3. Kiểm thử Tải & Hiệu Năng (k6 Load Testing)

Script `scripts/k6/load-test.js` mô phỏng hành vi của 100 người dùng đồng thời (VUs) thực hiện liên tục các tác vụ: Health, Login JWT, PostGIS ST_DWithin candidate discovery, Random queue eligibility, và Matches querying.

### Tiêu chuẩn đạt (Thresholds):
- `http_req_duration`: 95% số request có thời gian phản hồi dưới 500 ms (`p(95) < 500ms`).
- `http_req_failed`: Tỷ lệ lỗi dưới 1% (`rate < 0.01`).

### Cách chạy k6:
```bash
# Chạy kiểm thử tải với k6
k6 run scripts/k6/load-test.js
```
