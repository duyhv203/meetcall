import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';

describe('Discovery, Swipes & Matches Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisService: RedisService;

  let tokenUserA: string;
  let tokenUserB: string;
  let tokenUserC: string;
  let userAId: string;
  let userBId: string;
  let userCId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    prisma = app.get(PrismaService);
    redisService = app.get(RedisService);

    // Register User A (Male, 24)
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `usera_discover_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '2000-01-01',
      });
    tokenUserA = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B (Female, 22)
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userb_discover_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '2002-05-05',
      });
    tokenUserB = resB.body.accessToken;
    userBId = resB.body.user.id;

    // Register User C (Female, 23)
    const resC = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userc_discover_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '2001-08-08',
      });
    tokenUserC = resC.body.accessToken;
    userCId = resC.body.user.id;

    // Setup User A profile, approved photo, Hanoi location
    await prisma.profile.update({
      where: { userId: userAId },
      data: { displayName: 'User Alpha', gender: 'male', city: 'Hà Nội' },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "profiles" SET "location" = ST_SetSRID(ST_MakePoint(105.8542, 21.0285), 4326)::geography WHERE "user_id" = $1::uuid`,
      userAId,
    );
    await prisma.photo.create({
      data: {
        userId: userAId,
        url: 'http://localhost:3000/api/v1/storage/file?key=photos/a.jpg',
        moderationStatus: 'approved',
      },
    });

    // Setup User B profile, approved photo, Hanoi location (~2 km away)
    await prisma.profile.update({
      where: { userId: userBId },
      data: { displayName: 'User Beta', gender: 'female', city: 'Hà Nội' },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "profiles" SET "location" = ST_SetSRID(ST_MakePoint(105.8400, 21.0300), 4326)::geography WHERE "user_id" = $1::uuid`,
      userBId,
    );
    await prisma.photo.create({
      data: {
        userId: userBId,
        url: 'http://localhost:3000/api/v1/storage/file?key=photos/b.jpg',
        moderationStatus: 'approved',
      },
    });

    // Setup User C profile, approved photo
    await prisma.profile.update({
      where: { userId: userCId },
      data: { displayName: 'User Gamma', gender: 'female', city: 'Hà Nội' },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "profiles" SET "location" = ST_SetSRID(ST_MakePoint(105.8450, 21.0350), 4326)::geography WHERE "user_id" = $1::uuid`,
      userCId,
    );
    await prisma.photo.create({
      data: {
        userId: userCId,
        url: 'http://localhost:3000/api/v1/storage/file?key=photos/c.jpg',
        moderationStatus: 'approved',
      },
    });
  });

  afterAll(async () => {
    await prisma.swipe.deleteMany({
      where: {
        OR: [
          { fromUser: { in: [userAId, userBId, userCId] } },
          { toUser: { in: [userAId, userBId, userCId] } },
        ],
      },
    });
    await prisma.match.deleteMany({
      where: {
        OR: [
          { userA: { in: [userAId, userBId, userCId] } },
          { userB: { in: [userAId, userBId, userCId] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId, userCId] } },
    });
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/v1/discover', () => {
    it('1. Trả danh sách ứng viên phù hợp với khoảng cách làm tròn 5 km', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/discover')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const candidateB = res.body.find((c: any) => c.userId === userBId);
      expect(candidateB).toBeDefined();
      expect(candidateB.displayName).toBe('User Beta');
      expect(candidateB.distanceKm).toBeGreaterThanOrEqual(5);
      expect(candidateB.distanceKm % 5).toBe(0); // Multiple of 5 km
      expect(candidateB.photos.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/swipes', () => {
    it('2. Quẹt Pass người dùng thành công (không tạo Match)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/swipes')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          targetUserId: userCId,
          action: 'pass',
        });

      expect(res.status).toBe(200);
      expect(res.body.match).toBe(false);
    });

    it('3. Người dùng C bị loại khỏi danh sách Discover của A sau khi đã quẹt', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/discover')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      const candidateC = res.body.find((c: any) => c.userId === userCId);
      expect(candidateC).toBeUndefined();
    });

    it('4. Quẹt Like một chiều: chỉ ghi nhận lượt like, chưa tạo Match', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/swipes')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          targetUserId: userBId,
          action: 'like',
        });

      expect(res.status).toBe(200);
      expect(res.body.match).toBe(false);
    });

    let createdMatchId: string;

    it('5. Quẹt Like tương hỗ (Reciprocal Like): Tạo Match thành công trong DB (user_a < user_b)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/swipes')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({
          targetUserId: userAId,
          action: 'like',
        });

      expect(res.status).toBe(200);
      expect(res.body.match).toBe(true);
      expect(res.body).toHaveProperty('matchId');
      expect(res.body).toHaveProperty('matchedUser');
      expect(res.body.matchedUser.id).toBe(userAId);
      createdMatchId = res.body.matchId;

      // Verify DB constraint user_a < user_b
      const dbMatch = await prisma.match.findUnique({
        where: { id: createdMatchId },
      });
      expect(dbMatch).toBeDefined();
      expect(dbMatch!.userA < dbMatch!.userB).toBe(true);
    });

    it('6. Rate Limit: Bị từ chối khi vượt quá 100 lượt like trong 12h (429 LIKE_LIMIT)', async () => {
      const redis = redisService.getClient();
      const rateKey = `rate:likes:${userAId}`;
      await redis.set(rateKey, '100');

      const res = await request(app.getHttpServer())
        .post('/api/v1/swipes')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          targetUserId: userBId,
          action: 'like',
        });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('LIKE_LIMIT');

      // Reset rate limit key
      await redis.del(rateKey);
    });

    it('7. GET /api/v1/matches trả về danh sách Match kèm thông tin partner', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/matches')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const found = res.body.find((m: any) => m.id === createdMatchId);
      expect(found).toBeDefined();
      expect(found.partner.id).toBe(userBId);
      expect(found.partner.displayName).toBe('User Beta');
    });

    it('8. DELETE /api/v1/matches/:id huỷ tương hợp thành công', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/matches/${createdMatchId}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkMatch = await prisma.match.findUnique({
        where: { id: createdMatchId },
      });
      expect(checkMatch).toBeDefined();
      expect(checkMatch!.unmatchedAt).not.toBeNull();
    });
  });
});
