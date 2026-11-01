import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { PhotosModule } from './photos/photos.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { SwipesModule } from './swipes/swipes.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { ChatModule } from './chat/chat.module.js';
import { CallsModule } from './calls/calls.module.js';
import { RandomModule } from './random/random.module.js';
import { SafetyModule } from './safety/safety.module.js';
import { AdminModule } from './admin/admin.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          censor: '***REDACTED***',
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                },
              }
            : undefined,
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    ProfilesModule,
    PhotosModule,
    RealtimeModule,
    DiscoveryModule,
    SwipesModule,
    MatchesModule,
    ChatModule,
    CallsModule,
    RandomModule,
    SafetyModule,
    AdminModule,
    NotificationsModule,
  ],
})
export class AppModule {}
