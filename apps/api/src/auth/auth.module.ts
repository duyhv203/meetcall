import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './services/token.service.js';
import { MailService } from './services/mail.service.js';
import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { AuthGuard } from './guards/auth.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN', '15m') || '15m') as `${number}m`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    MailService,
    AuthRateLimitService,
    AuthGuard,
  ],
  exports: [AuthService, TokenService, AuthGuard, JwtModule],
})
export class AuthModule {}
