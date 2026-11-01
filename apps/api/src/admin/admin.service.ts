import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import type {
  AdminActionLogItem,
  AdminReportItem,
  AdminStatsResponse,
  AdminUserItem,
  ModeratePhotoRequest,
  ReportStatusType,
  ResolveReportRequest,
  SuspendUserRequest,
  UpdateUserRoleRequest,
  VerifyUserAgeRequest,
} from '@meetcall/shared';
import type { PhotoModerationStatus, ReportStatus, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getStats(): Promise<AdminStatsResponse> {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      ageVerifiedUsers,
      adminUsers,
      totalMatches,
      totalMessages,
      totalCalls,
      completedCalls,
      totalReports,
      openReports,
      urgentReports,
      pendingPhotos,
      totalPhotos,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active', role: 'user' } }),
      this.prisma.user.count({ where: { status: 'suspended' } }),
      this.prisma.user.count({ where: { ageVerified: true } }),
      this.prisma.user.count({ where: { role: 'admin' } }),
      this.prisma.match.count(),
      this.prisma.message.count(),
      this.prisma.call.count(),
      this.prisma.call.count({ where: { endReason: 'completed' } }),
      this.prisma.report.count(),
      this.prisma.report.count({ where: { status: 'open' } }),
      this.prisma.report.count({ where: { status: 'open', reason: 'minor' } }),
      this.prisma.photo.count({ where: { moderationStatus: 'pending' } }),
      this.prisma.photo.count(),
    ]);

    let postgresStatus: 'healthy' | 'error' = 'healthy';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      postgresStatus = 'error';
    }

    let redisStatus: 'healthy' | 'error' = 'healthy';
    try {
      const pong = await this.redisService.getClient().ping();
      if (pong !== 'PONG') redisStatus = 'error';
    } catch {
      redisStatus = 'error';
    }

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        ageVerified: ageVerifiedUsers,
        admins: adminUsers,
      },
      activity: {
        totalMatches,
        totalMessages,
        totalCalls,
        completedCalls,
      },
      safety: {
        totalReports,
        openReports,
        urgentReports,
        pendingPhotos,
        totalPhotos,
      },
      system: {
        postgres: postgresStatus,
        redis: redisStatus,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    };
  }

  async getUsers(
    search?: string,
    status?: string,
    role?: string,
    ageVerified?: string,
    page = 1,
    limit = 20,
  ): Promise<{ users: AdminUserItem[]; total: number; page: number; totalPages: number }> {
    const where: any = {};

    if (status && status !== 'all') {
      where.status = status as UserStatus;
    }
    if (role && role !== 'all') {
      where.role = role as UserRole;
    }
    if (ageVerified && ageVerified !== 'all') {
      where.ageVerified = ageVerified === 'true' || ageVerified === 'verified';
    }

    if (search && search.trim()) {
      const query = search.trim();
      where.OR = [
        { email: { contains: query, mode: 'insensitive' } },
        { profile: { displayName: { contains: query, mode: 'insensitive' } } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          profile: true,
          photos: {
            orderBy: { position: 'asc' },
          },
          matchesAsA: true,
          matchesAsB: true,
          reportsAgainst: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const items: AdminUserItem[] = users.map((u) => {
      const avatarPhoto = u.photos.find((p) => p.position === 0) || u.photos[0];
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        ageVerified: u.ageVerified,
        randomBannedUntil: u.randomBannedUntil?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        profile: u.profile
          ? {
              displayName: u.profile.displayName,
              gender: u.profile.gender,
              birthdate: u.profile.birthdate.toISOString(),
              city: u.profile.city,
              bio: u.profile.bio,
              avatarUrl: avatarPhoto?.url ?? null,
              photoCount: u.photos.length,
            }
          : null,
        photos: u.photos.map((p) => ({
          id: p.id,
          url: p.url,
          position: p.position,
          moderationStatus: p.moderationStatus,
        })),
        stats: {
          matchesCount: u.matchesAsA.length + u.matchesAsB.length,
          swipesUsed: 0,
          swipesPurchased: 0,
          reportsCount: u.reportsAgainst.length,
        },
      };
    });

    return {
      users: items,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async updateUserRole(
    adminId: string,
    targetUserId: string,
    dto: UpdateUserRoleRequest,
  ): Promise<{ success: boolean; userId: string; role: string }> {
    if (adminId === targetUserId && dto.role !== 'admin') {
      throw new BadRequestException({
        code: 'CANNOT_DEMOTE_SELF',
        message: 'Bạn không thể tự hạ quyền quản trị viên của chính mình.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { role: dto.role as UserRole },
      });

      await tx.adminAction.create({
        data: {
          adminId,
          targetUserId,
          action: 'dismiss',
          note: `Đã đổi vai trò người dùng từ ${user.role} thành ${dto.role}`,
        },
      });
    });

    return {
      success: true,
      userId: targetUserId,
      role: dto.role,
    };
  }

  async verifyUserAge(
    adminId: string,
    targetUserId: string,
    dto: VerifyUserAgeRequest,
  ): Promise<{ success: boolean; userId: string; ageVerified: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { ageVerified: dto.ageVerified },
      });

      await tx.adminAction.create({
        data: {
          adminId,
          targetUserId,
          action: 'dismiss',
          note: `Admin đã ${dto.ageVerified ? 'xác nhận' : 'thu hồi'} xác minh độ tuổi 18+`,
        },
      });
    });

    return {
      success: true,
      userId: targetUserId,
      ageVerified: dto.ageVerified,
    };
  }

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
    if (adminId === targetUserId && dto.suspend) {
      throw new BadRequestException({
        code: 'CANNOT_SUSPEND_SELF',
        message: 'Bạn không thể tự khoá tài khoản của chính mình.',
      });
    }

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

    await this.prisma.$transaction(async (tx) => {
      await tx.photo.update({
        where: { id: photoId },
        data: { moderationStatus: dto.status },
      });

      await tx.adminAction.create({
        data: {
          adminId,
          targetUserId: photo.userId,
          action: dto.status === 'approved' ? 'dismiss' : 'warn',
          note: `Admin đã ${dto.status === 'approved' ? 'phê duyệt' : 'từ chối'} ảnh ${photo.id}`,
        },
      });
    });

    return {
      success: true,
      photoId,
      status: dto.status,
    };
  }

  async getLogs(page = 1, limit = 50): Promise<AdminActionLogItem[]> {
    const actions = await this.prisma.adminAction.findMany({
      include: {
        admin: { select: { email: true } },
        targetUser: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return actions.map((a) => ({
      id: a.id,
      adminId: a.adminId,
      adminEmail: a.admin.email,
      targetUserId: a.targetUserId,
      targetEmail: a.targetUser?.email ?? null,
      reportId: a.reportId,
      action: a.action,
      note: a.note,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}
