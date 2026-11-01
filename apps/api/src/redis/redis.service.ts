import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { InMemoryRedis } from './in-memory-redis.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis | InMemoryRedis;
  private inMemoryFallback = new InMemoryRedis();
  private isUsingFallback = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
    const hasExternalRedis = Boolean(redisUrl || (!isLocalhost && host !== 'memory' && host !== 'in-memory'));

    // In production without external Redis, or if memory store is requested:
    if (host === 'memory' || host === 'in-memory' || (isProduction && !hasExternalRedis)) {
      this.logger.log('📦 Using built-in In-Memory Redis store (no external Redis required).');
      this.isUsingFallback = true;
      this.client = this.inMemoryFallback;
      return;
    }

    try {
      const redisOptions = {
        host,
        port,
        password: password || undefined,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => {
          if (times > 2) {
            this.logger.warn('⚠️ Redis connection failed. Operating in in-memory mode.');
            this.isUsingFallback = true;
            return null;
          }
          return 1000;
        },
      };

      const realRedis = redisUrl ? new Redis(redisUrl, redisOptions) : new Redis(redisOptions);

      realRedis.on('error', (err) => {
        if (!this.isUsingFallback) {
          this.logger.warn(`⚠️ Redis error: ${err.message}. Operating in in-memory mode.`);
          this.isUsingFallback = true;
        }
      });

      realRedis.on('connect', () => {
        this.logger.log('✅ Connected to Redis successfully');
        this.isUsingFallback = false;
      });

      this.client = realRedis;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`⚠️ Could not instantiate Redis (${msg}). Using in-memory store.`);
      this.isUsingFallback = true;
      this.client = this.inMemoryFallback;
    }
  }

  getClient(): Redis {
    if (this.isUsingFallback) {
      return this.inMemoryFallback as unknown as Redis;
    }
    const target = this.client as unknown as Record<string, any>;
    const fallback = this.inMemoryFallback as unknown as Record<string, any>;
    const self = this;

    return new Proxy(target, {
      get(obj, prop: string) {
        if (self.isUsingFallback || typeof obj[prop] !== 'function') {
          return fallback[prop] ?? obj[prop];
        }
        return async (...args: any[]) => {
          try {
            return await obj[prop](...args);
          } catch (err) {
            self.logger.warn(`Redis command '${prop}' failed. Falling back to in-memory.`);
            self.isUsingFallback = true;
            if (typeof fallback[prop] === 'function') {
              return await fallback[prop](...args);
            }
            throw err;
          }
        };
      },
    }) as unknown as Redis;
  }

  async ping(): Promise<string> {
    if (this.isUsingFallback) {
      return this.inMemoryFallback.ping();
    }
    try {
      const client = this.client as Redis;
      if (client.status === 'wait') {
        await client.connect();
      }
      return await client.ping();
    } catch {
      this.isUsingFallback = true;
      return this.inMemoryFallback.ping();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && !this.isUsingFallback && typeof (this.client as Redis).quit === 'function') {
      try {
        await (this.client as Redis).quit();
      } catch {
        // ignore
      }
    }
  }
}
