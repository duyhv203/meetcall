import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { JwtPayload } from '../services/token.service.js';
import type { AuthUser } from '@meetcall/shared';

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Bạn chưa đăng nhập hoặc thiếu token xác thực.',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          ageVerified: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Tài khoản không tồn tại.',
        });
      }

      if (user.status === 'suspended') {
        throw new ForbiddenException({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Tài khoản của bạn đã bị tạm khoá.',
        });
      }

      if (user.status === 'deleted') {
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Tài khoản đã bị xoá.',
        });
      }

      request.user = user;
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Token không hợp lệ hoặc đã hết hạn.',
      });
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
