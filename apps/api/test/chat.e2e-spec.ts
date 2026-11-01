import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';

describe('Chat Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisService: RedisService;

  let tokenUserA: string;
  let tokenUserB: string;
  let tokenUserC: string;
  let userAId: string;
  let userBId: string;
  let userCId: string;
  let matchId: string;

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

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `usera_chat_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1998-02-02',
      });
    tokenUserA = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userb_chat_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1999-03-03',
      });
    tokenUserB = resB.body.accessToken;
    userBId = resB.body.user.id;

    // Register User C (stranger)
    const resC = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userc_chat_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1997-04-04',
      });
    tokenUserC = resC.body.accessToken;
    userCId = resC.body.user.id;

    // Create match between A and B
    const [userA, userB] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
    const createdMatch = await prisma.match.create({
      data: {
        userA,
        userB,
      },
    });
    matchId = createdMatch.id;
  });

  afterAll(async () => {
    await prisma.message.deleteMany({
      where: { matchId },
    });
    await prisma.match.deleteMany({
      where: { id: matchId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId, userCId] } },
    });
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/matches/:id/messages', () => {
    it('1. Gửi tin nhắn thành công giữa 2 người dùng đã match (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ content: 'Chào bạn, rất vui được làm quen!' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.body).toBe('Chào bạn, rất vui được làm quen!');
      expect(res.body.senderId).toBe(userAId);
      expect(res.body.readAt).toBeNull();
    });

    it('2. Chặn người dùng lạ không thuộc match gửi tin nhắn (403 FORBIDDEN)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokenUserC}`)
        .send({ content: 'Tôi là người lạ xen vào!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('3. Từ chối tin nhắn rỗng (400 EMPTY_MESSAGE)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ content: '    ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMPTY_MESSAGE');
    });

    it('4. Chặn spam liên kết: Quá 2 link trong 1 tin nhắn (400 TOO_MANY_LINKS)', async () => {
      const spamMessage =
        'Xem tại https://scam1.com và https://scam2.com và https://scam3.com ngay!';
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ content: spamMessage });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOO_MANY_LINKS');
    });

    it('5. Rate Limiting: Chặn sau 30 tin nhắn trong 1 phút (429 RATE_LIMIT_EXCEEDED)', async () => {
      const redis = redisService.getClient();
      const rateKey = `rate:chat:${userAId}`;
      await redis.set(rateKey, '30');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ content: 'Tin nhắn thứ 31 sẽ bị chặn' });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');

      await redis.del(rateKey);
    });
  });

  describe('GET /api/v1/matches/:id/messages & Cursor Pagination', () => {
    it('6. Lấy danh sách tin nhắn và hỗ trợ cursor phân trang', async () => {
      // User B replies
      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({ content: 'Chào A, mình cũng rất vui!' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}/messages?limit=1`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.nextCursor).toBeDefined();

      // Fetch next page via nextCursor
      const nextPageRes = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}/messages?limit=1&cursor=${encodeURIComponent(res.body.nextCursor)}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(nextPageRes.status).toBe(200);
      expect(nextPageRes.body.items.length).toBe(1);
      expect(nextPageRes.body.items[0].body).toBe('Chào bạn, rất vui được làm quen!');
    });
  });

  describe('POST /api/v1/matches/:id/read & Presence', () => {
    it('7. Đánh dấu đã xem (read_at) cho các tin nhắn chưa đọc từ đối phương', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/read`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.readCount).toBeGreaterThanOrEqual(1);

      // Verify messages sent by User B are now read
      const verifyRes = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      const bMsg = verifyRes.body.items.find((m: any) => m.senderId === userBId);
      expect(bMsg.readAt).not.toBeNull();
    });

    it('8. Kiểm tra trạng thái hiện diện (Presence) của người dùng', async () => {
      const redis = redisService.getClient();
      // Set User A online
      await redis.set(`presence:${userAId}`, '1', 'EX', 60);

      const resA = await request(app.getHttpServer())
        .get(`/api/v1/users/${userAId}/presence`)
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(resA.status).toBe(200);
      expect(resA.body.isOnline).toBe(true);

      const resOffline = await request(app.getHttpServer())
        .get(`/api/v1/users/${userCId}/presence`)
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(resOffline.status).toBe(200);
      expect(resOffline.body.isOnline).toBe(false);
    });
  });
});
