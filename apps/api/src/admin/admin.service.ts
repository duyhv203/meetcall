import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminReportItem,
  ModeratePhotoRequest,
  ReportStatusType,
  ResolveReportRequest,
  SuspendUserRequest,
} from '@meetcall/shared';
import type { PhotoModerationStatus, ReportStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getReports(
    status?: ReportStatusType,
    page = 1,
    limit = 50,
  ): Promise<AdminReportItem[]> {
    const rawReports = await this.prisma.report.findMany({
      where: status ? { status: status as ReportStatus } : undefined,
      include: {
        reporter: {
          include: { profile: true },
        },
        target: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const items: AdminReportItem[] = rawReports.map((r) => {
      const isUrgent = r.reason === 'minor';
      return {
        id: r.id,
        reporterId: r.reporterId,
        targetId: r.targetId,
        callId: r.callId,
        reason: r.reason,
        priority: isUrgent ? 'urgent' : 'normal',
        status: r.status,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
        reporter: {
          id: r.reporter.id,
          email: r.reporter.email,
          displayName: r.reporter.profile?.displayName ?? 'Chưa đặt tên',
        },
        target: {
          id: r.target.id,
          email: r.target.email,
          displayName: r.target.profile?.displayName ?? 'Chưa đặt tên',
          status: r.target.status,
          randomBannedUntil: r.target.randomBannedUntil?.toISOString() ?? null,
        },
      };
    });

    // Sort urgent ('minor') items to the front
    items.sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items;
  }

  async resolveReport(
    adminId: string,
    reportId: string,
    dto: ResolveReportRequest,
  ): Promise<{ success: boolean; message: string; reportId: string; action: string }> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'Báo cáo vi phạm không tồn tại.',
      });
    }

    const newStatus: ReportStatus = dto.action === 'dismiss' ? 'reviewed' : 'actioned';

    await this.prisma.$transaction(async (tx) => {
      // 1. Update report status
      await tx.report.update({
        where: { id: reportId },
        data: { status: newStatus },
      });

      // 2. If suspend or ban, update target user status and revoke tokens
      if (dto.action === 'suspend' || dto.action === 'ban') {
        await tx.user.update({
          where: { id: report.targetId },
          data: { status: 'suspended' },
        });

        await tx.refreshToken.updateMany({
          where: { userId: report.targetId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      // 3. Log admin action
      await tx.adminAction.create({
        data: {
          adminId,
          targetUserId: report.targetId,
          reportId: report.id,
          action: dto.action,
          note: dto.note || null,
        },
      });
    });

    return {
      success: true,
      message: 'Đã giải quyết báo cáo vi phạm thành công.',
      reportId,
      action: dto.action,
    };
  }

  async suspendUser(
    adminId: string,
    targetUserId: string,
    dto: SuspendUserRequest,
  ): Promise<{ success: boolean; userId: string; status: string }> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại.',
      });
    }

    const nextStatus = dto.suspend ? 'suspended' : 'active';

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { status: nextStatus },
      });

      if (dto.suspend) {
        await tx.refreshToken.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.adminAction.create({
        data: {
          adminId,
          targetUserId,
          action: dto.suspend ? 'suspend' : 'dismiss',
          note: dto.note || `Admin ${dto.suspend ? 'đình chỉ' : 'mở khoá'} tài khoản`,
        },
      });
    });

    return {
      success: true,
      userId: targetUserId,
      status: nextStatus,
    };
  }

  async getPhotos(status: PhotoModerationStatus = 'pending', page = 1, limit = 50) {
    const photos = await this.prisma.photo.findMany({
      where: { moderationStatus: status },
      include: {
        user: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return photos.map((p) => ({
      id: p.id,
      userId: p.userId,
      url: p.url,
      position: p.position,
      moderationStatus: p.moderationStatus,
      createdAt: p.createdAt.toISOString(),
      user: {
        email: p.user.email,
        displayName: p.user.profile?.displayName ?? 'Chưa đặt tên',
      },
    }));
  }

  async moderatePhoto(
    adminId: string,
    photoId: string,
    dto: ModeratePhotoRequest,
  ): Promise<{ success: boolean; photoId: string; status: string }> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException({
        code: 'PHOTO_NOT_FOUND',
        message: 'Ảnh không tồn tại.',
      });
    }

    await this.prisma.photo.update({
      where: { id: photoId },
      data: { moderationStatus: dto.status },
    });

    return {
      success: true,
      photoId,
      status: dto.status,
    };
  }
}
