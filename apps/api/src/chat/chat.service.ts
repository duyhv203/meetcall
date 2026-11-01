import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ChatMessage, MessagesResponse } from '@meetcall/shared';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly MAX_MESSAGES_PER_MINUTE = 30;
  private readonly MAX_LINKS_PER_MESSAGE = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMessages(
    userId: string,
    matchId: string,
    cursor?: string,
    limit = 30,
  ): Promise<MessagesResponse> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.unmatchedAt !== null) {
      throw new NotFoundException({
        code: 'MATCH_NOT_FOUND',
        message: 'Cuộc trò chuyện này không tồn tại hoặc đã bị huỷ tương hợp.',
      });
    }

    if (match.userA !== userId && match.userB !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền xem tin nhắn trong cuộc trò chuyện này.',
      });
    }

    const effectiveLimit = Math.min(50, Math.max(1, limit));

    const messages = await this.prisma.message.findMany({
      where: {
        matchId,
        ...(cursor && {
          createdAt: {
            lt: new Date(cursor),
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: effectiveLimit + 1,
    });

    const hasMore = messages.length > effectiveLimit;
    const items = hasMore ? messages.slice(0, effectiveLimit) : messages;
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1].createdAt.toISOString()
        : null;

    const dtos: ChatMessage[] = items.map((m) => ({
      id: m.id,
      matchId: m.matchId,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt ? m.readAt.toISOString() : null,
    }));

    return {
      items: dtos,
      nextCursor,
    };
  }

  async sendMessage(
    senderId: string,
    matchId: string,
    content: string,
  ): Promise<ChatMessage> {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestException({
        code: 'EMPTY_MESSAGE',
        message: 'Nội dung tin nhắn không được để trống.',
      });
    }

    if (trimmed.length > 2000) {
      throw new BadRequestException({
        code: 'MESSAGE_TOO_LONG',
        message: 'Tin nhắn không được vượt quá 2000 ký tự.',
      });
    }

    // 1. Anti-spam Rate Limit: max 30 msg/minute
    const rateKey = `rate:chat:${senderId}`;
    const redis = this.redisService.getClient();
    const currentCount = await redis.get(rateKey);

    if (currentCount && parseInt(currentCount, 10) >= this.MAX_MESSAGES_PER_MINUTE) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng thử lại sau giây lát.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await redis.multi().incr(rateKey).expire(rateKey, 60).exec();

    // 2. Anti-phishing link filter: max 2 links per message
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const links = trimmed.match(urlRegex) || [];
    if (links.length > this.MAX_LINKS_PER_MESSAGE) {
      throw new BadRequestException({
        code: 'TOO_MANY_LINKS',
        message: `Tin nhắn chứa quá nhiều liên kết (tối đa ${this.MAX_LINKS_PER_MESSAGE} link).`,
      });
    }

    // 3. Match participation verification
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.unmatchedAt !== null) {
      throw new NotFoundException({
        code: 'MATCH_NOT_FOUND',
        message: 'Cuộc trò chuyện này không tồn tại hoặc đã bị huỷ tương hợp.',
      });
    }

    if (match.userA !== senderId && match.userB !== senderId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không thuộc cuộc trò chuyện này.',
      });
    }

    // 4. Verify 2-way block
    const otherUserId = match.userA === senderId ? match.userB : match.userA;
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: senderId },
        ],
      },
    });
    if (block) {
      throw new ForbiddenException({
        code: 'USER_BLOCKED',
        message: 'Không thể gửi tin nhắn do quan hệ chặn giữa hai người dùng.',
      });
    }

    // 5. Save message to DB
    const message = await this.prisma.message.create({
      data: {
        matchId,
        senderId,
        body: trimmed,
      },
    });

    // Update last_active_at for sender
    await this.prisma.profile.update({
      where: { userId: senderId },
      data: { lastActiveAt: new Date() },
    });

    const partnerId = match.userA === senderId ? match.userB : match.userA;

    const messageDto: ChatMessage = {
      id: message.id,
      matchId: message.matchId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      readAt: null,
    };

    // 5. Emit realtime event to both participants
    this.realtimeGateway.emitToUser(senderId, 'chat:message', messageDto);
    this.realtimeGateway.emitToUser(partnerId, 'chat:message', messageDto);

    // Send push notification to partner
    void this.prisma.profile
      .findUnique({
        where: { userId: senderId },
        select: { displayName: true },
      })
      .then((p) => {
        const senderName = p?.displayName || 'Tin nhắn mới';
        return this.notificationsService.notifyNewMessage(
          partnerId,
          senderName,
          trimmed,
          matchId,
        );
      })
      .catch((err) => this.logger.error(`Error sending push notification: ${err}`));

    return messageDto;
  }

  async markAsRead(
    userId: string,
    matchId: string,
  ): Promise<{ success: boolean; readCount: number }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.unmatchedAt !== null) {
      throw new NotFoundException({
        code: 'MATCH_NOT_FOUND',
        message: 'Cuộc trò chuyện không tồn tại.',
      });
    }

    if (match.userA !== userId && match.userB !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền truy cập cuộc trò chuyện này.',
      });
    }

    const now = new Date();
    const updateResult = await this.prisma.message.updateMany({
      where: {
        matchId,
        senderId: { not: userId },
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });

    const partnerId = match.userA === userId ? match.userB : match.userA;

    if (updateResult.count > 0) {
      this.realtimeGateway.emitToUser(partnerId, 'chat:read', {
        matchId,
        readBy: userId,
        readAt: now.toISOString(),
      });
    }

    return { success: true, readCount: updateResult.count };
  }

  async sendTyping(
    userId: string,
    matchId: string,
    isTyping: boolean,
  ): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.unmatchedAt !== null) return;
    if (match.userA !== userId && match.userB !== userId) return;

    const partnerId = match.userA === userId ? match.userB : match.userA;
    this.realtimeGateway.emitToUser(partnerId, 'chat:typing', {
      matchId,
      userId,
      isTyping,
    });
  }

  async recordPresence(userId: string): Promise<void> {
    const redis = this.redisService.getClient();
    await redis.set(`presence:${userId}`, '1', 'EX', 60);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const redis = this.redisService.getClient();
    const result = await redis.get(`presence:${userId}`);
    return Boolean(result);
  }
}
