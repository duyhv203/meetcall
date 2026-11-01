import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service.js';

@Injectable()
export class AuthRateLimitService {
  private readonly MAX_ATTEMPTS = 10;
  private readonly WINDOW_SECONDS = 15 * 60; // 15 minutes

  constructor(private readonly redisService: RedisService) {}

  async checkRateLimit(ip: string, email?: string): Promise<void> {
    const redis = this.redisService.getClient();

    const ipKey = `rate:auth:ip:${ip}`;
    const ipAttempts = await redis.get(ipKey);

    if (ipAttempts && parseInt(ipAttempts, 10) >= this.MAX_ATTEMPTS) {
      throw new HttpException(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Bạn đã thao tác sai quá nhiều lần từ IP này. Vui lòng thử lại sau 15 phút.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (email) {
      const emailKey = `rate:auth:email:${email.toLowerCase()}`;
      const emailAttempts = await redis.get(emailKey);

      if (emailAttempts && parseInt(emailAttempts, 10) >= this.MAX_ATTEMPTS) {
        throw new HttpException(
          {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Tài khoản này đã bị tạm khóa thao tác do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  async recordFailedAttempt(ip: string, email?: string): Promise<void> {
    const redis = this.redisService.getClient();

    const ipKey = `rate:auth:ip:${ip}`;
    const newIpCount = await redis.incr(ipKey);
    if (newIpCount === 1) {
      await redis.expire(ipKey, this.WINDOW_SECONDS);
    }

    if (email) {
      const emailKey = `rate:auth:email:${email.toLowerCase()}`;
      const newEmailCount = await redis.incr(emailKey);
      if (newEmailCount === 1) {
        await redis.expire(emailKey, this.WINDOW_SECONDS);
      }
    }
  }

  async resetFailureCount(email: string): Promise<void> {
    const redis = this.redisService.getClient();
    const emailKey = `rate:auth:email:${email.toLowerCase()}`;
    await redis.del(emailKey);
  }
}
