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

  async getQuota(swiperId: string) {
    const swiper = await this.prisma.user.findUnique({
      where: { id: swiperId },
      include: {
        profile: true,
        photos: true,
      },
    });

    const isProfileComplete = Boolean(
      swiper?.profile?.displayName &&
      swiper?.profile?.city,
    );
    const photoCount = swiper?.photos?.length || 0;
    const isUnlocked = Boolean(isProfileComplete && photoCount >= 3);

    const redis = this.redisService.getClient();
    const [usedStr, purchasedStr] = await Promise.all([
      redis.get(`swipes:used:${swiperId}`),
      redis.get(`swipes:purchased:${swiperId}`),
    ]);

    const usedSwipes = usedStr ? parseInt(usedStr, 10) : 0;
    const purchasedSwipes = purchasedStr ? parseInt(purchasedStr, 10) : 0;
    const totalAllowed = 20 + purchasedSwipes;
    const remainingSwipes = Math.max(0, totalAllowed - usedSwipes);

    return {
      isUnlocked,
      photosCount: photoCount,
      requiredPhotos: 3,
      isProfileComplete,
      freeQuota: 20,
      usedSwipes,
      purchasedSwipes,
      remainingSwipes,
    };
  }

  async topup(swiperId: string, packageId: string) {
    let addedSwipes = 20;
    let packageName = 'Gói 20 lượt quẹt';

    if (packageId === 'swipe_50') {
      addedSwipes = 50;
      packageName = 'Gói 50 lượt quẹt';
    } else if (packageId === 'swipe_100') {
      addedSwipes = 100;
      packageName = 'Gói 100 lượt quẹt';
    } else if (packageId === 'swipe_unlimited') {
      addedSwipes = 9999;
      packageName = 'Gói VIP Không giới hạn';
    }

    const redis = this.redisService.getClient();
    await redis.incrby(`swipes:purchased:${swiperId}`, addedSwipes);

    const quota = await this.getQuota(swiperId);
    return {
      success: true,
      message: `Nạp thành công ${packageName}!`,
      addedSwipes,
      quota,
    };
  }

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

    // 1. Check swiper profile & photos requirement (>= 3 photos & complete profile)
    const swiper = await this.prisma.user.findUnique({
      where: { id: swiperId },
      include: {
        profile: true,
        photos: true,
      },
    });

    if (swiper?.role === 'admin') {
      throw new BadRequestException({
        code: 'ADMIN_CANNOT_SWIPE',
        message: 'Tài khoản Quản trị viên (Admin) chỉ dùng để quản trị hệ thống, không tham gia quẹt thẻ hẹn hò.',
      });
    }

    const isProfileComplete = Boolean(
      swiper?.profile?.displayName &&
      swiper?.profile?.city,
    );
    const photoCount = swiper?.photos?.length || 0;

    if (!isProfileComplete || photoCount < 3) {
      throw new BadRequestException({
        code: 'SWIPES_LOCKED_REQUIRE_3_PHOTOS',
        message: 'Bạn cần điền đầy đủ thông tin và đăng từ 3 ảnh trở lên để mở khóa 20 lượt quẹt miễn phí.',
        photosCount: photoCount,
        requiredPhotos: 3,
        isProfileComplete,
      });
    }

    // 2. Check 20 swipes quota + purchased swipes
    const redis = this.redisService.getClient();
    const usedKey = `swipes:used:${swiperId}`;
    const purchasedKey = `swipes:purchased:${swiperId}`;

    const [usedStr, purchasedStr] = await Promise.all([
      redis.get(usedKey),
      redis.get(purchasedKey),
    ]);

    const usedSwipes = usedStr ? parseInt(usedStr, 10) : 0;
    const purchasedSwipes = purchasedStr ? parseInt(purchasedStr, 10) : 0;
    const totalAllowed = 20 + purchasedSwipes;

    if (usedSwipes >= totalAllowed) {
      throw new HttpException(
        {
          code: 'SWIPE_QUOTA_EXCEEDED',
          message: 'Bạn đã sử dụng hết 20 lượt quẹt miễn phí. Vui lòng nạp thêm lượt quẹt để tiếp tục.',
          remainingSwipes: 0,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
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
    const result = await this.prisma.$transaction(async (tx) => {
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

    await redis.incr(`swipes:used:${swiperId}`);
    return result;
  }
}
