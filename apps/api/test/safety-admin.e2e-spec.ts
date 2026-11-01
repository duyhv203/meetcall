import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';

describe('Safety & Admin Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisService: RedisService;

  const testEmailPrefix = `safety_test_${Date.now()}`;
  let tokenUserA: string;
  let userAId: string;
  let tokenUserB: string;
  let userBId: string;
  let tokenUserTarget: string;
  let userTargetId: string;
  let tokenAdmin: string;
  let adminId: string;

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
    redisService = app.get(RedisService);

    // Register User A
    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${testEmailPrefix}_a@meetcall.local`,
        password: 'Password123!',
        birthdate: '1995-05-15',
      });
    tokenUserA = regA.body.accessToken;
    userAId = regA.body.user.id;

    // Complete Onboarding A
    await prisma.profile.update({
      where: { userId: userAId },
      data: { displayName: 'User A', gender: 'male' },
    });
    await prisma.photo.create({
      data: {
        userId: userAId,
        url: 'https://cdn.meetcall.local/photo_a.jpg',
        position: 0,
        moderationStatus: 'approved',
      },
    });

    // Register User B
    const regB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${testEmailPrefix}_b@meetcall.local`,
        password: 'Password123!',
        birthdate: '1996-06-16',
      });
    tokenUserB = regB.body.accessToken;
    userBId = regB.body.user.id;

    // Complete Onboarding B
    await prisma.profile.update({
      where: { userId: userBId },
      data: { displayName: 'User B', gender: 'female' },
    });
    await prisma.photo.create({
      data: {
        userId: userBId,
        url: 'https://cdn.meetcall.local/photo_b.jpg',
        position: 0,
        moderationStatus: 'approved',
      },
    });

    // Register Target User (for reports & bans)
    const regTarget = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${testEmailPrefix}_target@meetcall.local`,
        password: 'Password123!',
        birthdate: '1998-08-18',
      });
    tokenUserTarget = regTarget.body.accessToken;
    userTargetId = regTarget.body.user.id;

    await prisma.profile.update({
      where: { userId: userTargetId },
      data: { displayName: 'Target User', gender: 'other' },
    });
    await prisma.photo.create({
      data: {
        userId: userTargetId,
        url: 'https://cdn.meetcall.local/photo_target.jpg',
        position: 0,
        moderationStatus: 'approved',
      },
    });
    // Set Target ageVerified so we can test random eligibility
    await prisma.user.update({
      where: { id: userTargetId },
      data: { ageVerified: true },
    });

    // Register Admin User and promote in DB
    const regAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${testEmailPrefix}_admin@meetcall.local`,
        password: 'Password123!',
        birthdate: '1990-01-01',
      });
    adminId = regAdmin.body.user.id;
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'admin' },
    });
    // Re-login as Admin to get updated role in token
    const loginAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `${testEmailPrefix}_admin@meetcall.local`,
        password: 'Password123!',
      });
    tokenAdmin = loginAdmin.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: {
        email: { contains: testEmailPrefix },
      },
    });
    await app.close();
  });

  describe('Chặn người dùng (Blocks)', () => {
    let matchId: string;

    beforeAll(async () => {
      // Create a match between User A and User B
      const [uA, uB] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
      const match = await prisma.match.create({
        data: {
          userA: uA,
          userB: uB,
        },
      });
      matchId = match.id;
    });

    it('1. Từ chối khi tự chặn chính mình (400 CANNOT_BLOCK_SELF)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ blockedId: userAId });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_BLOCK_SELF');
    });

    it('2. Chặn User B thành công và tự động unmatch', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/blocks')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ blockedId: userBId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check match is now unmatched
      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });
      expect(match?.unmatchedAt).not.toBeNull();
    });

    it('3. Lấy danh sách người đã chặn chứa User B', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/blocks')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const blocked = res.body.find((b: any) => b.blockedId === userBId);
      expect(blocked).toBeDefined();
      expect(blocked.blockedUser.displayName).toBe('User B');
    });

    it('4. Chặn 2 chiều: User B không thể gửi tin nhắn cho User A', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({ content: 'Xin chào, bạn có đó không?' });

      // Match is either UNMATCHED / MATCH_NOT_FOUND or USER_BLOCKED
      expect([403, 404]).toContain(res.status);
    });

    it('5. Bỏ chặn User B thành công', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/blocks/${userBId}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check list is now without User B
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/blocks')
        .set('Authorization', `Bearer ${tokenUserA}`);
      const stillBlocked = listRes.body.find((b: any) => b.blockedId === userBId);
      expect(stillBlocked).toBeUndefined();
    });
  });

  describe('Báo cáo vi phạm & Tự động khoá Random Call (Reports)', () => {
    it('6. Từ chối khi tự báo cáo chính mình (400 CANNOT_REPORT_SELF)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          targetId: userAId,
          reason: 'harassment',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_REPORT_SELF');
    });

    it('7. Nhận 3 báo cáo trong 24h tự động kích hoạt khoá Random Call 24h', async () => {
      // Report 1 by User A
      const rep1 = await request(app.getHttpServer())
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          targetId: userTargetId,
          reason: 'harassment',
          details: 'Nói năng thô lỗ',
        });
      expect(rep1.status).toBe(201);
      expect(rep1.body.autoBannedRandom).toBe(false);

      // Report 2 by User B
      const rep2 = await request(app.getHttpServer())
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({
          targetId: userTargetId,
          reason: 'nudity',
          details: 'Hở hang không phù hợp',
        });
      expect(rep2.status).toBe(201);
      expect(rep2.body.autoBannedRandom).toBe(false);

      // Report 3 by Admin User (acting as regular reporter)
      const rep3 = await request(app.getHttpServer())
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          targetId: userTargetId,
          reason: 'scam',
          details: 'Gạ gẫm chuyển tiền',
        });
      expect(rep3.status).toBe(201);
      expect(rep3.body.autoBannedRandom).toBe(true);

      // Verify Target User is now rejected from random calls (403 RANDOM_BANNED)
      const eligRes = await request(app.getHttpServer())
        .get('/api/v1/random/eligibility')
        .set('Authorization', `Bearer ${tokenUserTarget}`);

      expect(eligRes.status).toBe(403);
      expect(eligRes.body.error.code).toBe('RANDOM_BANNED');
    });
  });

  describe('Quản trị viên & RBAC (Admin Module)', () => {
    let reportToResolveId: string;

    it('8. Người dùng thông thường bị từ chối khi truy cập Admin endpoint (403 FORBIDDEN)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('9. Admin xem danh sách báo cáo, báo cáo lý do "minor" được ưu tiên hàng đầu', async () => {
      // File an urgent report with reason 'minor'
      const minorRep = await request(app.getHttpServer())
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          targetId: userTargetId,
          reason: 'minor',
          details: 'Nghi ngờ người dùng là học sinh dưới 18 tuổi',
        });
      reportToResolveId = minorRep.body.id;

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // First item must be priority urgent
      expect(res.body[0].priority).toBe('urgent');
      expect(res.body[0].reason).toBe('minor');
    });

    it('10. Admin giải quyết báo cáo với hành động suspend -> khoá tài khoản người vi phạm', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/reports/${reportToResolveId}/resolve`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          action: 'suspend',
          note: 'Xác minh vi phạm quy định cộng đồng',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify Target User is now suspended
      const targetUser = await prisma.user.findUnique({
        where: { id: userTargetId },
      });
      expect(targetUser?.status).toBe('suspended');

      // Target User cannot access protected endpoints anymore
      const tryMe = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${tokenUserTarget}`);
      expect(tryMe.status).toBe(403);
      expect(tryMe.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('11. Admin mở khoá tài khoản người dùng thành công', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/users/${userTargetId}/suspend`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          suspend: false,
          note: 'Đã hoàn tất kiểm tra, mở khoá tài khoản',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');

      const targetUser = await prisma.user.findUnique({
        where: { id: userTargetId },
      });
      expect(targetUser?.status).toBe('active');
    });

    it('12. Admin kiểm duyệt ảnh: xem danh sách pending và duyệt ảnh', async () => {
      // Create a pending photo
      const newPhoto = await prisma.photo.create({
        data: {
          userId: userTargetId,
          url: 'https://cdn.meetcall.local/pending_avatar.jpg',
          position: 1,
          moderationStatus: 'pending',
        },
      });

      // Admin gets pending photos
      const getPhotosRes = await request(app.getHttpServer())
        .get('/api/v1/admin/photos?status=pending')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(getPhotosRes.status).toBe(200);
      const found = getPhotosRes.body.find((p: any) => p.id === newPhoto.id);
      expect(found).toBeDefined();

      // Admin approves photo
      const modRes = await request(app.getHttpServer())
        .post(`/api/v1/admin/photos/${newPhoto.id}/moderate`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ status: 'approved' });

      expect(modRes.status).toBe(200);
      expect(modRes.body.status).toBe('approved');

      const updatedPhoto = await prisma.photo.findUnique({
        where: { id: newPhoto.id },
      });
      expect(updatedPhoto?.moderationStatus).toBe('approved');
    });
  });

  describe('Webhook xác thực độ tuổi (Age Verification Webhook)', () => {
    const webhookSecret = 'meetcall_age_webhook_secret_dev_only';

    it('13. Từ chối webhook khi sai hoặc thiếu chữ ký HMAC (401 INVALID_SIGNATURE)', async () => {
      const payload = {
        userId: userAId,
        verified: true,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/age-verification/webhook')
        .set('x-webhook-signature', 'invalid_signature_hex')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('14. Xác thực thành công khi có chữ ký HMAC hợp lệ và cập nhật ageVerified = true', async () => {
      // Initially User A ageVerified is false
      await prisma.user.update({
        where: { id: userAId },
        data: { ageVerified: false },
      });

      const payload = {
        userId: userAId,
        verified: true,
      };

      const rawPayload = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');

      const res = await request(app.getHttpServer())
        .post('/api/v1/age-verification/webhook')
        .set('x-webhook-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ageVerified).toBe(true);

      const userA = await prisma.user.findUnique({
        where: { id: userAId },
      });
      expect(userA?.ageVerified).toBe(true);
    });

    it('15. Webhook từ chối nếu phát hiện dưới 18 tuổi và đình chỉ tài khoản', async () => {
      const payload = {
        userId: userBId,
        verified: true,
        birthdate: '2015-01-01', // Under 18
      };

      const rawPayload = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');

      const res = await request(app.getHttpServer())
        .post('/api/v1/age-verification/webhook')
        .set('x-webhook-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawPayload);

      expect(res.status).toBe(200);
      expect(res.body.ageVerified).toBe(false);

      const userB = await prisma.user.findUnique({
        where: { id: userBId },
      });
      expect(userB?.ageVerified).toBe(false);
      expect(userB?.status).toBe('suspended');
    });
  });
});
