import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { MailService } from './services/mail.service.js';
import { TokenService } from './services/token.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto.js';
import type { AuthResponse, AuthSuccessMessage, AuthUser } from '@meetcall/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly rateLimitService: AuthRateLimitService,
  ) {}

  async register(dto: RegisterDto, ip: string, res: Response): Promise<AuthResponse> {
    await this.rateLimitService.checkRateLimit(ip, dto.email);

    // Calculate age from birthdate
    const birthdate = new Date(dto.birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const monthDiff = today.getMonth() - birthdate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
      age--;
    }

    if (age < 18) {
      await this.rateLimitService.recordFailedAttempt(ip, dto.email);
      throw new BadRequestException({
        code: 'UNDER_AGE',
        message: 'Bạn phải đủ 18 tuổi trở lên để đăng ký tài khoản.',
      });
    }

    // Check existing email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      await this.rateLimitService.recordFailedAttempt(ip, dto.email);
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'Email này đã được sử dụng. Vui lòng chọn email khác.',
      });
    }

    // Hash password with argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    // Create user and initial profile in transaction
    const displayName = dto.email.split('@')[0] || 'User';

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          profile: {
            create: {
              displayName,
              birthdate,
              gender: 'other',
            },
          },
          preferences: {
            create: {
              genderFilter: [],
              minAge: 18,
              maxAge: 100,
              maxDistanceKm: 50,
            },
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          ageVerified: true,
        },
      });

      return newUser;
    });

    // Reset failure counter on success
    await this.rateLimitService.resetFailureCount(dto.email);

    // Issue tokens
    const { rawToken, tokenHash, expiresAt } = this.tokenService.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    this.tokenService.setRefreshTokenCookie(res, rawToken);
    const accessToken = this.tokenService.generateAccessToken(user);

    return {
      accessToken,
      user,
    };
  }

  async login(dto: LoginDto, ip: string, res: Response): Promise<AuthResponse> {
    await this.rateLimitService.checkRateLimit(ip, dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      await this.rateLimitService.recordFailedAttempt(ip, dto.email);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.password);
    if (!isMatch) {
      await this.rateLimitService.recordFailedAttempt(ip, dto.email);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    if (user.status === 'suspended') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Tài khoản của bạn đã bị tạm khoá do vi phạm quy định cộng đồng.',
      });
    }

    if (user.status === 'deleted') {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    // Reset failure counter on success
    await this.rateLimitService.resetFailureCount(dto.email);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      ageVerified: user.ageVerified,
    };

    // Issue rotated refresh token
    const { rawToken, tokenHash, expiresAt } = this.tokenService.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    this.tokenService.setRefreshTokenCookie(res, rawToken);
    const accessToken = this.tokenService.generateAccessToken(authUser);

    return {
      accessToken,
      user: authUser,
    };
  }

  async refresh(rawToken: string | undefined, res: Response): Promise<AuthResponse> {
    if (!rawToken) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Không tìm thấy refresh token trong cookie.',
      });
    }

    const tokenHash = this.tokenService.hashToken(rawToken);

    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      this.tokenService.clearRefreshTokenCookie(res);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Refresh token không hợp lệ.',
      });
    }

    // Check if token was already revoked (Reuse Detection)
    if (record.revokedAt !== null) {
      // Revoke all tokens for this user because token theft is suspected
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { revokedAt: new Date() },
      });

      this.tokenService.clearRefreshTokenCookie(res);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Phát hiện tái sử dụng refresh token cũ. Toàn bộ phiên đăng nhập đã bị thu hồi.',
      });
    }

    // Check expiration
    if (record.expiresAt < new Date()) {
      this.tokenService.clearRefreshTokenCookie(res);
      throw new UnauthorizedException({
        code: 'TOKEN_EXPIRED',
        message: 'Refresh token đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    if (record.user.status === 'suspended') {
      this.tokenService.clearRefreshTokenCookie(res);
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Tài khoản của bạn đã bị tạm khoá.',
      });
    }

    // Revoke current token
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair (Rotation)
    const { rawToken: newRawToken, tokenHash: newTokenHash, expiresAt: newExpiresAt } =
      this.tokenService.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    this.tokenService.setRefreshTokenCookie(res, newRawToken);

    const authUser: AuthUser = {
      id: record.user.id,
      email: record.user.email,
      role: record.user.role,
      status: record.user.status,
      ageVerified: record.user.ageVerified,
    };

    const accessToken = this.tokenService.generateAccessToken(authUser);

    return {
      accessToken,
      user: authUser,
    };
  }

  async logout(rawToken: string | undefined, res: Response): Promise<AuthSuccessMessage> {
    if (rawToken) {
      const tokenHash = this.tokenService.hashToken(rawToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    this.tokenService.clearRefreshTokenCookie(res);
    return { success: true, message: 'Đăng xuất thành công.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<AuthSuccessMessage> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return 200 generic message to prevent email enumeration
    if (!user || user.status !== 'active') {
      return {
        success: true,
        message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const redis = this.redisService.getClient();

    // Store in Redis with TTL 30 minutes (1800 seconds)
    await redis.set(`pwd_reset:${resetToken}`, user.id, 'EX', 1800);

    // Send email asynchronously
    void this.mailService.sendPasswordResetEmail(user.email, resetToken);

    return {
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, res: Response): Promise<AuthSuccessMessage> {
    const redis = this.redisService.getClient();
    const userId = await redis.get(`pwd_reset:${dto.token}`);

    if (!userId) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
      });
    }

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Delete reset token from Redis
    await redis.del(`pwd_reset:${dto.token}`);

    // Revoke all refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.tokenService.clearRefreshTokenCookie(res);

    return {
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới.',
    };
  }
}
