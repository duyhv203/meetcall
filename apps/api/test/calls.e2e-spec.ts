import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CallsService } from '../src/calls/calls.service.js';

describe('Calls & WebRTC Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let callsService: CallsService;

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
    callsService = app.get(CallsService);

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `usera_call_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1995-05-05',
      });
    tokenUserA = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userb_call_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1996-06-06',
      });
    tokenUserB = resB.body.accessToken;
    userBId = resB.body.user.id;

    // Register User C (Stranger)
    const resC = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userc_call_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1994-04-04',
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
    await prisma.call.deleteMany({
      where: {
        OR: [
          { callerId: { in: [userAId, userBId, userCId] } },
          { calleeId: { in: [userAId, userBId, userCId] } },
        ],
      },
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

  describe('GET /api/v1/calls/ice-servers', () => {
    it('1. Trả về cấu hình STUN và TURN credentials HMAC-SHA1 hợp lệ', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/ice-servers')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('iceServers');
      expect(res.body.iceServers.length).toBeGreaterThanOrEqual(2);

      const turnConfig = res.body.iceServers.find((s: any) =>
        s.urls.some?.((u: string) => u.startsWith('turn:')) ||
        (typeof s.urls === 'string' && s.urls.startsWith('turn:')),
      );

      expect(turnConfig).toBeDefined();
      expect(turnConfig).toHaveProperty('username');
      expect(turnConfig).toHaveProperty('credential');

      // Verify HMAC-SHA1 formula
      const secret = 'meetcall-turn-secret-change-in-production';
      const expectedPassword = crypto
        .createHmac('sha1', secret)
        .update(turnConfig.username)
        .digest('base64');

      expect(turnConfig.credential).toBe(expectedPassword);
    });
  });

  describe('Call Lifecycle: Initiate, Busy Check, Accept, End', () => {
    let callId: string;

    it('2. Khởi tạo cuộc gọi match thành công (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/initiate')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ matchId });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('callId');
      expect(res.body.calleeId).toBe(userBId);
      callId = res.body.callId;
    });

    it('3. Chặn người lạ không thuộc match khởi tạo cuộc gọi (403 FORBIDDEN)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/initiate')
        .set('Authorization', `Bearer ${tokenUserC}`)
        .send({ matchId });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('4. Bận máy: Từ chối cuộc gọi mới khi một trong hai bên đang trong cuộc gọi (409 USER_BUSY)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls/initiate')
        .set('Authorization', `Bearer ${tokenUserB}`)
        .send({ matchId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USER_BUSY');
    });

    it('5. Nhận cuộc gọi thành công (200 OK, cập nhật startedAt)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/accept`)
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbCall = await prisma.call.findUnique({
        where: { id: callId },
      });
      expect(dbCall!.startedAt).not.toBeNull();
    });

    it('6. Kết thúc cuộc gọi thành công và lưu thời lượng cuộc gọi', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/end`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ reason: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('durationSeconds');

      const dbCall = await prisma.call.findUnique({
        where: { id: callId },
      });
      expect(dbCall!.endedAt).not.toBeNull();
      expect(dbCall!.endReason).toBe('completed');
    });

    it('7. Từ chối signaling nếu payload vượt quá giới hạn 16 KB (400 SIGNAL_TOO_LARGE)', () => {
      // 17 KB payload
      const largePayload = 'A'.repeat(17 * 1024);

      expect(() => {
        callsService.forwardSignal(userAId, callId, userBId, { largeData: largePayload });
      }).toThrow();
    });
  });
});
