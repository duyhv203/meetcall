import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RandomService } from '../src/random/random.service.js';

describe('Random Calls (Omegle/Azar Style) Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisService: RedisService;
  let randomService: RandomService;

  let tokenUserA: string;
  let tokenUserB: string;
  let tokenUnderage: string;
  let userAId: string;
  let userBId: string;
  let underageId: string;

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
    randomService = app.get(RandomService);

    // Register User A (Adult, ageVerified = true)
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `usera_random_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1998-07-07',
      });
    tokenUserA = resA.body.accessToken;
    userAId = resA.body.user.id;
    await prisma.user.update({
      where: { id: userAId },
      data: { ageVerified: true },
    });
    await prisma.profile.update({
      where: { userId: userAId },
      data: { displayName: 'Random A', gender: 'male' },
    });
    await prisma.photo.create({
      data: {
        userId: userAId,
        url: 'http://localhost:3000/api/v1/storage/file?key=photos/ra.jpg',
        moderationStatus: 'approved',
      },
    });

    // Register User B (Adult, ageVerified = true)
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userb_random_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1999-08-08',
      });
    tokenUserB = resB.body.accessToken;
    userBId = resB.body.user.id;
    await prisma.user.update({
      where: { id: userBId },
      data: { ageVerified: true },
    });
    await prisma.profile.update({
      where: { userId: userBId },
      data: { displayName: 'Random B', gender: 'female' },
    });
    await prisma.photo.create({
      data: {
        userId: userBId,
        url: 'http://localhost:3000/api/v1/storage/file?key=photos/rb.jpg',
        moderationStatus: 'approved',
      },
    });

    // Register User C (Adult, BUT ageVerified = false)
    const resUnderage = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userc_unverified_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '2000-01-01',
      });
    tokenUnderage = resUnderage.body.accessToken;
    underageId = resUnderage.body.user.id;
  });

  afterAll(async () => {
    await prisma.callFriendVote.deleteMany({
      where: { userId: { in: [userAId, userBId, underageId] } },
    });
    await prisma.call.deleteMany({
      where: {
        OR: [
          { callerId: { in: [userAId, userBId, underageId] } },
          { calleeId: { in: [userAId, userBId, underageId] } },
        ],
      },
    });
    await prisma.match.deleteMany({
      where: {
        OR: [
          { userA: { in: [userAId, userBId] } },
          { userB: { in: [userAId, userBId] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId, underageId] } },
    });
    if (app) {
      await app.close();
    }
  });

  describe('Random Call Eligibility & Safety Gates', () => {
    it('1. Từ chối người dùng chưa xác thực tuổi 18+ (403 AGE_NOT_VERIFIED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/random/eligibility')
        .set('Authorization', `Bearer ${tokenUnderage}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AGE_NOT_VERIFIED');
    });

    it('2. Từ chối người dùng đang bị khoá tính năng ngẫu nhiên (403 RANDOM_BANNED)', async () => {
      // Set random banned until tomorrow
      await prisma.user.update({
        where: { id: userAId },
        data: { randomBannedUntil: new Date(Date.now() + 86400 * 1000) },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/random/eligibility')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RANDOM_BANNED');

      // Unban for subsequent tests
      await prisma.user.update({
        where: { id: userAId },
        data: { randomBannedUntil: null },
      });
    });

    it('3. Người dùng đủ điều kiện nhận được trạng thái hợp lệ (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/random/eligibility')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.eligible).toBe(true);
      expect(res.body.user.displayName).toBe('Random A');
    });
  });

  describe('Atomic Redis Queue Matchmaking & Cooldown', () => {
    let pairedCallId: string;

    it('4. Ghép cặp ngẫu nhiên nguyên tử: User A vào hàng đợi, User B vào và khớp nối ngay', async () => {
      // User A joins queue
      const joinA = await randomService.joinQueue(userAId, 'socket-a-1');
      expect(joinA.paired).toBe(false);

      // User B joins queue -> matches with User A
      const joinB = await randomService.joinQueue(userBId, 'socket-b-1');
      expect(joinB.paired).toBe(true);
      expect(joinB.callId).toBeDefined();
      pairedCallId = joinB.callId!;

      const call = await prisma.call.findUnique({
        where: { id: pairedCallId },
      });
      expect(call).toBeDefined();
      expect(call!.kind).toBe('random');
    });

    it('5. Chống lặp cặp trong 10 phút: A và B vừa gọi nhau sẽ không ghép cặp lại ngay', async () => {
      // Clear queue first
      await randomService.leaveQueue(userAId);
      await randomService.leaveQueue(userBId);

      // A joins queue
      await randomService.joinQueue(userAId, 'socket-a-2');

      // B joins queue -> should NOT pair with A due to 10 min cooldown
      const resB = await randomService.joinQueue(userBId, 'socket-b-2');
      expect(resB.paired).toBe(false);

      // Clean up queue
      await randomService.leaveQueue(userAId);
      await randomService.leaveQueue(userBId);
    });

    it('6. Rate Limit: Chặn khi vượt quá 200 lượt next trong 1 giờ (429 RATE_LIMIT_EXCEEDED)', async () => {
      const redis = redisService.getClient();
      const rateKey = `rate:random:next:${userAId}`;
      await redis.set(rateKey, '200');

      await expect(
        randomService.joinQueue(userAId, 'socket-a-3'),
      ).rejects.toThrow();

      await redis.del(rateKey);
    });

    it('7. Vote kết bạn: Một bên vote chưa tạo match, hai bên cùng vote tạo match tự động', async () => {
      // User A votes true
      const voteA = await request(app.getHttpServer())
        .post(`/api/v1/calls/${pairedCallId}/friend-vote`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ wantsFriend: true });

      expect(voteA.status).toBe(200);
      expect(voteA.body.matchCreated).toBe(false);

      // User B also votes true
      const voteB = await request(app.getHttpServer())
        .post(`/api/v1/calls/${pairedCallId}/friend-vote`)
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({ wantsFriend: true });

      expect(voteB.status).toBe(200);
      expect(voteB.body.matchCreated).toBe(true);
      expect(voteB.body.matchId).toBeDefined();

      // Verify match exists in database
      const dbMatch = await prisma.match.findUnique({
        where: { id: voteB.body.matchId },
      });
      expect(dbMatch).toBeDefined();
      expect(dbMatch!.userA < dbMatch!.userB).toBe(true);
    });
  });
});
