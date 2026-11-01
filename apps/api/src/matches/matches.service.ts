import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MatchItem } from '@meetcall/shared';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatches(userId: string): Promise<MatchItem[]> {
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ userA: userId }, { userB: userId }],
        unmatchedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            body: true,
            createdAt: true,
            senderId: true,
          },
        },
      },
    });

    if (matches.length === 0) {
      return [];
    }

    const partnerIds = matches.map((m) =>
      m.userA === userId ? m.userB : m.userA,
    );

    const partners = await this.prisma.user.findMany({
      where: { id: { in: partnerIds } },
      include: {
        profile: true,
        photos: {
          where: { moderationStatus: 'approved' },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });

    const partnerMap = new Map<string, (typeof partners)[0]>();
    for (const p of partners) {
      partnerMap.set(p.id, p);
    }

    const calculateAge = (birthdate: Date) => {
      const diffMs = Date.now() - birthdate.getTime();
      return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
    };

    const results: MatchItem[] = [];

    for (const m of matches) {
      const partnerId = m.userA === userId ? m.userB : m.userA;
      const partner = partnerMap.get(partnerId);
      if (!partner || !partner.profile) continue;

      const latestMsg = m.messages[0];
      const lastMessage = latestMsg
        ? {
            content: latestMsg.body,
            createdAt: latestMsg.createdAt.toISOString(),
            senderId: latestMsg.senderId,
          }
        : null;

      results.push({
        id: m.id,
        createdAt: m.createdAt.toISOString(),
        lastMessage,
        partner: {
          id: partner.id,
          displayName: partner.profile.displayName,
          age: calculateAge(partner.profile.birthdate),
          gender: partner.profile.gender,
          city: partner.profile.city,
          avatar: partner.photos[0]?.url || null,
          bio: partner.profile.bio,
          lastActiveAt: partner.profile.lastActiveAt.toISOString(),
        },
      });
    }

    return results;
  }

  async unmatch(userId: string, matchId: string): Promise<{ success: boolean }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.unmatchedAt !== null) {
      throw new NotFoundException({
        code: 'MATCH_NOT_FOUND',
        message: 'Không tìm thấy thông tin tương hợp này.',
      });
    }

    if (match.userA !== userId && match.userB !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền huỷ tương hợp này.',
      });
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: { unmatchedAt: new Date() },
    });

    return { success: true };
  }
}
