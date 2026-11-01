import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  const testEmail = `auth_test_${Date.now()}@meetcall.local`;
  const adultBirthdate = '2000-01-01'; // 26 years old
  const minorBirthdate = '2015-01-01'; // 11 years old
  const testPassword = 'Password12345!';

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
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: { email: { contains: 'auth_test_' } },
    });
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/auth/register', () => {
    it('1. Đăng ký thành công tài khoản >= 18 tuổi', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          birthdate: adultBirthdate,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.role).toBe('user');

      // Check cookie refreshToken
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refreshToken=[a-f0-9]{64};/);
    });

    it('2. Từ chối đăng ký nếu email đã tồn tại (409 EMAIL_TAKEN)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          birthdate: adultBirthdate,
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('3. Từ chối đăng ký nếu ngày sinh dưới 18 tuổi (400 UNDER_AGE)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `minor_${Date.now()}@meetcall.local`,
          password: testPassword,
          birthdate: minorBirthdate,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('UNDER_AGE');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('4. Từ chối nếu sai mật khẩu (401 INVALID_CREDENTIALS)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword999!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('Đăng nhập thành công với mật khẩu đúng (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testEmail);
    });
  });

  describe('POST /api/v1/auth/refresh & Token Rotation', () => {
    let initialCookie: string;
    let rotatedCookie: string;

    beforeAll(async () => {
      // Login to get initial cookie
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      initialCookie = res.headers['set-cookie'][0];
    });

    it('5. Xoay vòng Refresh Token thành công (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [initialCookie]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testEmail);

      // Verify a new cookie is issued
      const newCookies = response.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      rotatedCookie = newCookies[0];
      expect(rotatedCookie).not.toBe(initialCookie);
    });

    it('6. Phát hiện dùng lại token cũ (initialCookie) -> thu hồi hàng loạt mọi token (401)', async () => {
      // Try using the already rotated initialCookie
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [initialCookie]);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');

      // Now even the rotatedCookie should be revoked because all tokens were revoked
      const nextResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [rotatedCookie]);

      expect(nextResponse.status).toBe(401);
    });
  });

  describe('Rate Limiting (10 failed attempts -> 429 TOO_MANY_ATTEMPTS)', () => {
    it('7. Rate limit kích hoạt sau 10 lần thử sai', async () => {
      const spamEmail = `rate_limit_test_${Date.now()}@meetcall.local`;

      // 10 failed attempts
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: spamEmail,
            password: 'WrongPassword!',
          });
      }

      // 11th attempt must be rejected with 429
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: spamEmail,
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('TOO_MANY_ATTEMPTS');

      // Cleanup rate limit keys in Redis
      const rClient = redis.getClient();
      await rClient.del(`rate:auth:email:${spamEmail.toLowerCase()}`);
      await rClient.del(`rate:auth:ip:127.0.0.1`);
      await rClient.del(`rate:auth:ip:::ffff:127.0.0.1`);
    });
  });

  describe('GET /api/v1/auth/me & AuthGuard', () => {
    it('Trả thông tin user khi có Bearer token hợp lệ', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      const token = loginRes.body.accessToken;

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testEmail);
    });

    it('Từ chối khi không có Bearer token (401 UNAUTHORIZED)', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
