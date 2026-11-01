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
import type {
  FriendVoteResponse,
  RandomPairedPartner,
} from '@meetcall/shared';

interface WaitingUser {
  userId: string;
  socketId: string;
  displayName: string;
  gender: string;
  age: number;
  preferredGender?: string;
}

@Injectable()
export class RandomService {
  private readonly logger = new Logger(RandomService.name);
  private readonly QUEUE_KEY = 'random:waiting_queue';
  private readonly MAX_NEXT_PER_HOUR = 200;
  private readonly PAIR_COOLDOWN_SECONDS = 5; // 5 seconds for responsive testing and matching

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async assertEligibleForRandom(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        photos: {
          where: { moderationStatus: { not: 'rejected' } },
          take: 1,
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: 'Tài khoản không hoạt động hoặc đã bị khoá.',
      });
    }

    if (!user.ageVerified) {
      throw new ForbiddenException({
        code: 'AGE_NOT_VERIFIED',
        message: 'Bạn cần hoàn tất xác minh độ tuổi 18+ trước khi tham gia gọi ngẫu nhiên.',
      });
    }

    if (user.randomBannedUntil && user.randomBannedUntil > new Date()) {
      throw new ForbiddenException({
        code: 'RANDOM_BANNED',
        message: `Tính năng gọi ngẫu nhiên của bạn đang bị khoá đến ${user.randomBannedUntil.toLocaleString('vi-VN')}.`,
      });
    }

    if (!user.profile) {
      throw new ForbiddenException({
        code: 'ONBOARDING_INCOMPLETE',
        message: 'Vui lòng hoàn tất thông tin hồ sơ trước khi tham gia.',
      });
    }

    const birthdate = user.profile.birthdate;
    const age = birthdate
      ? Math.floor((Date.now() - birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 20;

    return {
      userId: user.id,
      displayName: user.profile.displayName || 'Người dùng MeetCall',
      gender: user.profile.gender || 'other',
      age,
    };
  }

  async getVipStatus(userId: string) {
    const redis = this.redisService.getClient();
    const vipVal = await redis.get(`user:vip:videocall:${userId}`);
    return {
      isVip: Boolean(vipVal),
      expiresAt: vipVal || null,
    };
  }

  async upgradeVip(userId: string, packageId = 'vip_1month') {
    const redis = this.redisService.getClient();
    const durationDays = packageId === 'vip_1day' ? 1 : 30;
    const packageName = packageId === 'vip_1day' ? 'Gói VIP 1 Ngày' : 'Gói VIP 1 Tháng';
    const expiresAt = new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString();

    await redis.set(`user:vip:videocall:${userId}`, expiresAt, 'EX', durationDays * 24 * 3600);

    return {
      success: true,
      message: `Kích hoạt thành công ${packageName}!`,
      isVip: true,
      expiresAt,
    };
  }

  async joinQueue(
    userId: string,
    socketId: string,
    preferredGender?: string,
    minAge?: number,
    maxAge?: number,
    preferredCity?: string,
  ): Promise<{ paired: boolean; callId?: string }> {
    const user = await this.assertEligibleForRandom(userId);

    // Paid VIP filter check
    const isFiltered = Boolean(
      (preferredGender && preferredGender !== 'other') ||
      (minAge && minAge > 18) ||
      (maxAge && maxAge < 60) ||
      preferredCity,
    );

    const redis = this.redisService.getClient();
    if (isFiltered) {
      const isVip = await redis.get(`user:vip:videocall:${userId}`);
      if (!isVip) {
        throw new HttpException(
          {
            code: 'VIP_FILTER_REQUIRED',
            message: 'Tính năng chọn riêng giới tính, độ tuổi và khu vực là tính năng nâng cao (trả phí). Vui lòng nâng cấp gói VIP để sử dụng.',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    // Rate limit check: 200 next/hour
    const rateKey = `rate:random:next:${userId}`;
    const nextCount = await redis.get(rateKey);

    if (nextCount && parseInt(nextCount, 10) >= this.MAX_NEXT_PER_HOUR) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Bạn đã đạt giới hạn 200 lượt chuyển người dùng trong 1 giờ. Vui lòng quay lại sau.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await redis.multi().incr(rateKey).expire(rateKey, 3600).exec();

    // Check waiting users in Redis list
    const rawQueue = await redis.lrange(this.QUEUE_KEY, 0, -1);
    let matchedPartner: WaitingUser | null = null;
    let matchedIndex = -1;

    for (let i = 0; i < rawQueue.length; i++) {
      try {
        const item: WaitingUser = JSON.parse(rawQueue[i]);
        if (item.userId === userId) continue;

        // Verify waiting user is still online on websocket; remove stale ghost entries
        if (!this.realtimeGateway.isUserOnline(item.userId)) {
          void redis.lrem(this.QUEUE_KEY, 1, rawQueue[i]);
          continue;
        }

        // Check if recently paired (5 sec cooldown)
        const cooldownKey = `random:cooldown:${userId}:${item.userId}`;
        const isCooldown = await redis.get(cooldownKey);
        if (isCooldown) continue;

        // Check gender filter
        if (preferredGender && preferredGender !== 'other' && item.gender !== preferredGender) {
          continue;
        }
        if (item.preferredGender && item.preferredGender !== 'other' && item.preferredGender !== user.gender) {
          continue;
        }

        // Check blocks both ways
        const blocked = await this.prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: item.userId },
              { blockerId: item.userId, blockedId: userId },
            ],
          },
        });
        if (blocked) continue;

        matchedPartner = item;
        matchedIndex = i;
        break;
      } catch {
        // Ignore JSON parse errors for corrupt entries
      }
    }

    if (matchedPartner && matchedIndex >= 0) {
      // Remove partner from queue
      await redis.lrem(this.QUEUE_KEY, 1, rawQueue[matchedIndex]);

      // Set cooldown for 10 minutes
      await redis.set(
        `random:cooldown:${userId}:${matchedPartner.userId}`,
        '1',
        'EX',
        this.PAIR_COOLDOWN_SECONDS,
      );
      await redis.set(
        `random:cooldown:${matchedPartner.userId}:${userId}`,
        '1',
        'EX',
        this.PAIR_COOLDOWN_SECONDS,
      );

      // Create random call record in DB
      const call = await this.prisma.call.create({
        data: {
          kind: 'random',
          callerId: userId,
          calleeId: matchedPartner.userId,
          startedAt: new Date(),
        },
      });

      // Emit random:paired to both
      this.realtimeGateway.emitToUser(userId, 'random:paired', {
        callId: call.id,
        partner: {
          id: matchedPartner.userId,
          displayName: matchedPartner.displayName,
          gender: matchedPartner.gender,
          age: matchedPartner.age,
        },
        initiator: true,
      });

      this.realtimeGateway.emitToUser(matchedPartner.userId, 'random:paired', {
        callId: call.id,
        partner: {
          id: userId,
          displayName: user.displayName,
          gender: user.gender,
          age: user.age,
        },
        initiator: false,
      });

      return { paired: true, callId: call.id };
    }

    // No match yet, push self into queue
    // First remove any existing entry for this user
    await this.leaveQueue(userId);

    const queueItem: WaitingUser = {
      userId,
      socketId,
      displayName: user.displayName,
      gender: user.gender,
      age: user.age,
      preferredGender,
    };

    await redis.rpush(this.QUEUE_KEY, JSON.stringify(queueItem));
    return { paired: false };
  }

  async leaveQueue(userId: string): Promise<void> {
    const redis = this.redisService.getClient();
    const rawQueue = await redis.lrange(this.QUEUE_KEY, 0, -1);
    for (const itemStr of rawQueue) {
      try {
        const item: WaitingUser = JSON.parse(itemStr);
        if (item.userId === userId) {
          await redis.lrem(this.QUEUE_KEY, 1, itemStr);
        }
      } catch {
        // Ignore
      }
    }
  }

  async skipCall(userId: string, callId: string): Promise<void> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (call && !call.endedAt) {
      await this.prisma.call.update({
        where: { id: callId },
        data: {
          endedAt: new Date(),
          endReason: 'skipped',
        },
      });

      const partnerId = call.callerId === userId ? call.calleeId : call.callerId;
      this.realtimeGateway.emitToUser(partnerId, 'random:partner_left', { callId });
    }
  }

  async voteFriend(
    userId: string,
    callId: string,
    wantsFriend: boolean,
  ): Promise<FriendVoteResponse> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call || call.kind !== 'random') {
      throw new NotFoundException({
        code: 'CALL_NOT_FOUND',
        message: 'Không tìm thấy cuộc gọi ngẫu nhiên này.',
      });
    }

    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không thuộc cuộc gọi này.',
      });
    }

    // Save vote
    await this.prisma.callFriendVote.upsert({
      where: {
        callId_userId: {
          callId,
          userId,
        },
      },
      create: {
        callId,
        userId,
        wantsFriend,
      },
      update: {
        wantsFriend,
      },
    });

    if (!wantsFriend) {
      return { matchCreated: false };
    }

    // Check if the other person also voted true
    const otherVote = await this.prisma.callFriendVote.findFirst({
      where: {
        callId,
        userId: { not: userId },
        wantsFriend: true,
      },
    });

    if (otherVote) {
      // Mutual like -> CREATE MATCH!
      const partnerId = call.callerId === userId ? call.calleeId : call.callerId;
      const [userA, userB] =
        userId < partnerId ? [userId, partnerId] : [partnerId, userId];

      const match = await this.prisma.match.upsert({
        where: {
          userA_userB: { userA, userB },
        },
        create: { userA, userB },
        update: {},
      });

      // Get user profiles for celebration notification
      const [u1, u2] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          include: { profile: true, photos: { take: 1 } },
        }),
        this.prisma.user.findUnique({
          where: { id: partnerId },
          include: { profile: true, photos: { take: 1 } },
        }),
      ]);

      this.realtimeGateway.emitToUser(userId, 'match:new', {
        matchId: match.id,
        matchedUser: {
          id: partnerId,
          displayName: u2?.profile?.displayName || 'Người dùng',
          avatar: u2?.photos[0]?.url || null,
        },
      });

      this.realtimeGateway.emitToUser(partnerId, 'match:new', {
        matchId: match.id,
        matchedUser: {
          id: userId,
          displayName: u1?.profile?.displayName || 'Người dùng',
          avatar: u1?.photos[0]?.url || null,
        },
      });

      return { matchCreated: true, matchId: match.id };
    }

    return { matchCreated: false };
  }
}
