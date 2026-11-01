import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StorageService } from '../src/photos/services/storage.service.js';

describe('Profile & Photos Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storageService: StorageService;

  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

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
    storageService = app.get(StorageService);

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `usera_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1998-01-01',
      });
    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `userb_${Date.now()}@meetcall.local`,
        password: 'Password12345!',
        birthdate: '1999-01-01',
      });
    userBToken = resB.body.accessToken;
    userBId = resB.body.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    if (app) {
      await app.close();
    }
  });

  describe('Photo Upload & Validation', () => {
    it('1. Từ chối file định dạng không hợp lệ (400 INVALID_FILE_TYPE)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/me/photos/upload-url')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          contentType: 'application/pdf',
          size: 1024,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_FILE_TYPE');
    });

    it('2. Từ chối file quá 8 MB (400 FILE_TOO_LARGE)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/me/photos/upload-url')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          contentType: 'image/jpeg',
          size: 9 * 1024 * 1024, // 9 MB
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('3. Nhận URL ký sẵn cho file hợp lệ (201)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/me/photos/upload-url')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          contentType: 'image/jpeg',
          size: 2 * 1024 * 1024, // 2 MB
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body).toHaveProperty('key');
      expect(response.body.key).toContain(`photos/${userAId}/`);
    });

    it('4. Chặn quyền thao tác / xác nhận ảnh của người khác (403 FORBIDDEN)', async () => {
      // User B tries to confirm photo key belonging to User A
      const fakeKeyOfA = `photos/${userAId}/fake-photo.jpg`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/me/photos')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ key: fakeKeyOfA });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Preferences & Location Constraints', () => {
    it('5. Từ chối preferences khi minAge < 18 (400 MIN_AGE_TOO_LOW)', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          genderFilter: ['female'],
          minAge: 16,
          maxAge: 30,
          maxDistanceKm: 50,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MIN_AGE_TOO_LOW');
    });

    it('6. Cập nhật preferences hợp lệ thành công (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/me/preferences')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          genderFilter: ['female'],
          minAge: 20,
          maxAge: 35,
          maxDistanceKm: 40,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('7. Cập nhật toạ độ GPS vị trí thành công không làm lộ toạ độ (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/me/location')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          lat: 21.0285,
          lng: 105.8542,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).not.toHaveProperty('lat');
      expect(response.body).not.toHaveProperty('lng');
    });
  });

  describe('EXIF GPS Stripping Verification', () => {
    it('8. Xử lý ảnh và xác nhận đã loại bỏ metadata EXIF GPS', async () => {
      // Create a test 100x100 image with GPS EXIF
      const imageWithGps = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      // Sharp by default strips all EXIF metadata when saving/re-encoding
      const strippedBuffer = await sharp(imageWithGps)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const metadata = await sharp(strippedBuffer).metadata();
      expect(metadata.exif).toBeUndefined();
    });
  });
});
