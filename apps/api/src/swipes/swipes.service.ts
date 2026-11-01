import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { SwipeRequest, SwipeResponse } from '@meetcall/shared';

@Injectable()
export class SwipesService {
  private readonly logger = new Logger(SwipesService.name);
  private readonly MAX_LIKES_PER_12H = 100;
  private readonly LIKE_WINDOW_SECONDS = 12 * 3600; // 12 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async swipe(swiperId: string, dto: SwipeRequest): Promise<SwipeResponse> {
    if (swiperId === dto.targetUserId) {
      throw new BadRequestException({
        code: 'CANNOT_SWIPE_SELF',
        message: 'Bạn không thể quẹt chính hồ sơ của mình.',
      });
    }

    if (!['like', 'pass'].includes(dto.action)) {
      throw new BadRequestException({
        code: 'INVALID_ACTION',
        message: 'Hành động phải là like hoặc pass.',
      });
    }

    // Target user must exist and be active
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      include: {
        profile: true,
        photos: {
          where: { moderationStatus: 'approved' },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });

    if (!targetUser || targetUser.status !== 'active') {
      throw new NotFoundException({
        code: 'TARGET_NOT_FOUND',
        message: 'Người dùng này không tồn tại hoặc đã bị khoá.',
      });
    }

    // Rate limit for likes (100 likes per 12 hours)
    if (dto.action === 'like') {
      const rateKey = `rate:likes:${swiperId}`;
      const redis = this.redisService.getClient();
      const currentLikes = await redis.get(rateKey);

      if (currentLikes && parseInt(currentLikes, 10) >= this.MAX_LIKES_PER_12H) {
        throw new HttpException(
          {
            code: 'LIKE_LIMIT',
            message: 'Bạn đã đạt giới hạn 100 lượt thích trong 12 giờ. Vui lòng quay lại sau.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await redis
        .multi()
        .incr(rateKey)
        .expire(rateKey, this.LIKE_WINDOW_SECONDS)
        .exec();
    }

    // Atomic transaction: record swipe, check reciprocal like, create match
    return this.prisma.$transaction(async (tx) => {
      // 1. Record swipe (upsert to handle any retry)
      await tx.swipe.upsert({
        where: {
          fromUser_toUser: {
            fromUser: swiperId,
            toUser: dto.targetUserId,
          },
        },
        create: {
          fromUser: swiperId,
          toUser: dto.targetUserId,
          direction: dto.action,
        },
        update: {
          direction: dto.action,
        },
      });

      if (dto.action === 'pass') {
        return { match: false };
      }

      // 2. Check if target user has liked swiper
      const reciprocalSwipe = await tx.swipe.findUnique({
        where: {
          fromUser_toUser: {
            fromUser: dto.targetUserId,
            toUser: swiperId,
          },
        },
      });

      if (!reciprocalSwipe || reciprocalSwipe.direction !== 'like') {
        return { match: false };
      }

      // 3. Reciprocal like exists -> CREATE MATCH!
      const [userA, userB] =
        swiperId < dto.targetUserId
          ? [swiperId, dto.targetUserId]
          : [dto.targetUserId, swiperId];

      const match = await tx.match.upsert({
        where: {
          userA_userB: { userA, userB },
        },
        create: { userA, userB },
        update: {},
      });

      // Get swiper's info for socket notification
      const swiperUser = await tx.user.findUnique({
        where: { id: swiperId },
        include: {
          profile: true,
          photos: {
            where: { moderationStatus: 'approved' },
            orderBy: { position: 'asc' },
            take: 1,
          },
        },
      });

      // 4. Emit realtime events to both users
      const targetAvatar = targetUser.photos[0]?.url || null;
      const swiperAvatar = swiperUser?.photos[0]?.url || null;

      // Event for swiper
      this.realtimeGateway.emitToUser(swiperId, 'match:new', {
        matchId: match.id,
        matchedUser: {
          id: targetUser.id,
          displayName: targetUser.profile?.displayName || 'Người dùng',
          avatar: targetAvatar,
        },
      });

      // Event for target user
      this.realtimeGateway.emitToUser(dto.targetUserId, 'match:new', {
        matchId: match.id,
        matchedUser: {
          id: swiperId,
          displayName: swiperUser?.profile?.displayName || 'Người dùng',
          avatar: swiperAvatar,
        },
      });

      // Send push notification to target user
      void this.notificationsService.notifyNewMatch(
        dto.targetUserId,
        swiperUser?.profile?.displayName || 'Một người dùng',
        match.id,
      );

      return {
        match: true,
        matchId: match.id,
        matchedUser: {
          id: targetUser.id,
          displayName: targetUser.profile?.displayName || 'Người dùng',
          avatar: targetAvatar,
        },
      };
    });
  }
}
