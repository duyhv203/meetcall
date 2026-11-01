import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { HealthResponse } from '@meetcall/shared';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    let postgresOk = false;
    let redisOk = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      postgresOk = true;
    } catch {
      postgresOk = false;
    }

    try {
      const pong = await this.redis.ping();
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }

    if (!postgresOk || !redisOk) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: `Health check failed: Postgres=${postgresOk ? 'UP' : 'DOWN'}, Redis=${redisOk ? 'UP' : 'DOWN'}`,
      });
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        postgres: postgresOk,
        redis: redisOk,
      },
    };
  }
}
