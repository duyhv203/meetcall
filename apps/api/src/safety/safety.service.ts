import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type {
  AgeVerificationWebhookPayload,
  BlockItemResponse,
  CreateReportRequest,
  CreateReportResponse,
} from '@meetcall/shared';

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async blockUser(blockerId: string, blockedId: string): Promise<{ success: boolean; message: string }> {
    if (blockerId === blockedId) {
      throw new BadRequestException({
        code: 'CANNOT_BLOCK_SELF',
        message: 'Bạn không thể tự chặn chính mình.',
      });
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: blockedId },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng cần chặn không tồn tại.',
      });
    }

    // 1. Check if already blocked
    const existingBlock = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
    });

    if (!existingBlock) {
      await this.prisma.block.create({
        data: {
          blockerId,
          blockedId,
        },
      });
    }

    // 2. Auto unmatch if they have a match
    const [userA, userB] = blockerId < blockedId ? [blockerId, blockedId] : [blockedId, blockerId];
    const match = await this.prisma.match.findUnique({
      where: {
        userA_userB: { userA, userB },
      },
    });

    if (match && !match.unmatchedAt) {
      await this.prisma.match.update({
        where: { id: match.id },
        data: { unmatchedAt: new Date() },
      });
    }

    return {
      success: true,
      message: 'Đã chặn người dùng thành công.',
    };
  }

  async getBlockedUsers(blockerId: string): Promise<BlockItemResponse[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId },
      include: {
        blocked: {
          include: {
            profile: true,
            photos: {
              where: { moderationStatus: 'approved' },
              orderBy: { position: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      blockedId: b.blockedId,
      blockedUser: {
        displayName: b.blocked.profile?.displayName ?? 'Người dùng MeetCall',
        photoUrl: b.blocked.photos[0]?.url ?? null,
      },
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<{ success: boolean; message: string }> {
    const block = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
    });

    if (!block) {
      throw new NotFoundException({
        code: 'BLOCK_NOT_FOUND',
        message: 'Bạn chưa chặn người này hoặc đã bỏ chặn trước đó.',
      });
    }

    await this.prisma.block.delete({
      where: { id: block.id },
    });

    return {
      success: true,
      message: 'Đã bỏ chặn người dùng.',
    };
  }

  async reportUser(reporterId: string, dto: CreateReportRequest): Promise<CreateReportResponse> {
    if (reporterId === dto.targetId) {
      throw new BadRequestException({
        code: 'CANNOT_REPORT_SELF',
        message: 'Bạn không thể tự báo cáo chính mình.',
      });
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.targetId },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng bị báo cáo không tồn tại.',
      });
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetId: dto.targetId,
        callId: dto.callId || null,
        reason: dto.reason,
        details: dto.details || null,
        status: 'open',
      },
    });

    // Auto-ban random call if target receives >= 3 reports in 24 hours
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reportCount = await this.prisma.report.count({
      where: {
        targetId: dto.targetId,
        createdAt: { gte: since24h },
      },
    });

    let autoBannedRandom = false;
    if (reportCount >= 3) {
      const banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: dto.targetId },
        data: { randomBannedUntil: banUntil },
      });
      autoBannedRandom = true;
      this.logger.warn(
        `User ${dto.targetId} is auto-banned from random calls for 24h (received ${reportCount} reports in 24h)`,
      );
    }

    return {
      id: report.id,
      message: 'Báo cáo vi phạm đã được ghi nhận và gửi đến ban quản trị.',
      autoBannedRandom,
    };
  }

  async handleAgeVerificationWebhook(
    signature: string | undefined,
    payload: AgeVerificationWebhookPayload,
    rawBody?: string,
  ): Promise<{ success: boolean; userId: string; ageVerified: boolean }> {
    const secret =
      this.configService.get<string>('AGE_VERIFICATION_SECRET') ||
      'meetcall_age_webhook_secret_dev_only';

    // Verify HMAC-SHA256 signature
    const stringData = rawBody || JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(stringData)
      .digest('hex');

    if (!signature || signature !== expectedSignature) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Chữ ký webhook xác thực tuổi không hợp lệ.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại.',
      });
    }

    // Check birthdate if provided
    let is18Plus = payload.verified;
    if (payload.birthdate) {
      const birth = new Date(payload.birthdate);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 18) {
        is18Plus = false;
      }
    }

    if (is18Plus) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { ageVerified: true },
      });
    } else {
      // Underage or verification failed
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ageVerified: false,
          status: 'suspended',
        },
      });
    }

    return {
      success: true,
      userId: user.id,
      ageVerified: is18Plus,
    };
  }
}
