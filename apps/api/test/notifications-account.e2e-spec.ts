import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

describe('Notifications & Account Management Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;

  const testEmailPrefix = `notif_test_${Date.now()}`;
  let tokenUser: string;
  let userId: string;
  const userPassword = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
    prisma = app.get(PrismaService);
    notificationsService = app.get(NotificationsService);

    // Register User
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${testEmailPrefix}@meetcall.local`,
        password: userPassword,
        birthdate: '1996-03-20',
      });

    tokenUser = reg.body.accessToken;
    userId = reg.body.user.id;

    // Complete Onboarding
    await prisma.profile.update({
      where: { userId },
      data: {
        displayName: 'Test User GDPR',
        gender: 'male',
        bio: 'Yêu thích du lịch và lập trình',
        interests: ['Du lịch', 'Công nghệ'],
        city: 'Hà Nội',
      },
    });

    await prisma.preferences.upsert({
      where: { userId },
      create: {
        userId,
        minAge: 20,
        maxAge: 35,
        maxDistanceKm: 30,
        genderFilter: ['female'],
      },
      update: {
        minAge: 20,
        maxAge: 35,
        maxDistanceKm: 30,
        genderFilter: ['female'],
      },
    });

    await prisma.photo.create({
      data: {
        userId,
        url: 'https://cdn.meetcall.local/gdpr_test.jpg',
        position: 0,
        moderationStatus: 'approved',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: testEmailPrefix } },
    });
    await app.close();
  });

  describe('Đăng ký & Huỷ thiết bị nhận thông báo (Device Tokens)', () => {
    const sampleFcmToken = `fcm_token_device_${Date.now()}`;

    it('1. Đăng ký device token Web Push thành công', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/me/devices')
        .set('Authorization', `Bearer ${tokenUser}`)
        .send({
          fcmToken: sampleFcmToken,
          platform: 'web',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const savedToken = await prisma.deviceToken.findUnique({
        where: { fcmToken: sampleFcmToken },
      });
      expect(savedToken).toBeDefined();
      expect(savedToken?.userId).toBe(userId);
      expect(savedToken?.platform).toBe('web');
    });

    it('2. Dịch vụ NotificationsService gửi push thành công đến thiết bị đã đăng ký', async () => {
      const res = await notificationsService.sendPushNotification(userId, {
        title: 'Thử nghiệm thông báo',
        body: 'Nội dung thông báo thử nghiệm từ MeetCall',
      });

      expect(res.sentCount).toBeGreaterThanOrEqual(1);
    });

    it('3. Huỷ đăng ký device token thành công', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/me/devices')
        .set('Authorization', `Bearer ${tokenUser}`)
        .send({
          fcmToken: sampleFcmToken,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deletedToken = await prisma.deviceToken.findUnique({
        where: { fcmToken: sampleFcmToken },
      });
      expect(deletedToken).toBeNull();
    });
  });

  describe('Xuất dữ liệu cá nhân theo GDPR (Data Portability)', () => {
    it('4. Trích xuất toàn bộ dữ liệu cá nhân định dạng JSON đầy đủ theo chuẩn GDPR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/export')
        .set('Authorization', `Bearer ${tokenUser}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(`${testEmailPrefix}@meetcall.local`);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.displayName).toBe('Test User GDPR');
      expect(res.body.preferences).toBeDefined();
      expect(res.body.preferences.minAge).toBe(20);
      expect(Array.isArray(res.body.photos)).toBe(true);
      expect(res.body.photos.length).toBe(1);
      expect(typeof res.body.matchesCount).toBe('number');
      expect(typeof res.body.messagesSentCount).toBe('number');
      expect(typeof res.body.callsCount).toBe('number');
      expect(res.body.exportedAt).toBeDefined();
    });
  });

  describe('Xoá tài khoản & Soft-delete 7 ngày', () => {
    it('5. Thực hiện soft delete tài khoản, thu hồi refresh token và lên lịch xoá vĩnh viễn', async () => {
      // Register a temporary device token first to verify it gets cleaned up
      await prisma.deviceToken.create({
        data: {
          userId,
          fcmToken: `temp_token_${Date.now()}`,
          platform: 'web',
        },
      });

      const res = await request(app.getHttpServer())
        .delete('/api/v1/me')
        .set('Authorization', `Bearer ${tokenUser}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scheduledPermanentDeleteAt).toBeDefined();

      // Check DB user status is 'deleted'
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(user?.status).toBe('deleted');

      // Check device tokens are wiped
      const remainingTokens = await prisma.deviceToken.findMany({
        where: { userId },
      });
      expect(remainingTokens.length).toBe(0);

      // Check refresh tokens are revoked
      const activeRefreshTokens = await prisma.refreshToken.findMany({
        where: { userId, revokedAt: null },
      });
      expect(activeRefreshTokens.length).toBe(0);
    });

    it('6. Tài khoản đã xoá không thể truy cập lại API (401 UNAUTHORIZED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${tokenUser}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('7. Tài khoản đã xoá không thể đăng nhập lại', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `${testEmailPrefix}@meetcall.local`,
          password: userPassword,
        });

      // Status 'deleted' is treated as invalid credentials / deleted
      expect([401, 403]).toContain(res.status);
    });
  });
});
