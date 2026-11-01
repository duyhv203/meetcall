import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import type {
  IceServersResponse,
  InitiateCallResponse,
} from '@meetcall/shared';
import type { CallEndReason } from '@prisma/client';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly timeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  getIceServers(userId: string): IceServersResponse {
    const turnSecret = this.configService.get<string>(
      'TURN_SECRET',
      'meetcall-turn-secret-change-in-production',
    );
    const turnHost = this.configService.get<string>('TURN_HOST', 'localhost');
    const turnPort = this.configService.get<number>('TURN_PORT', 3478);
    const turnsPort = this.configService.get<number>('TURNS_PORT', 5349);

    const ttl = 86400; // 24 hours
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiry}:${userId}`;
    const credential = crypto
      .createHmac('sha1', turnSecret)
      .update(username)
      .digest('base64');

    return {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        {
          urls: [
            `turn:${turnHost}:${turnPort}?transport=udp`,
            `turn:${turnHost}:${turnPort}?transport=tcp`,
            `turns:${turnHost}:${turnsPort}?transport=tcp`,
          ],
          username,
          credential,
        },
      ],
      ttl,
    };
  }

  async initiateCall(callerId: string, matchId: string): Promise<InitiateCallResponse> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.unmatchedAt !== null) {
      throw new NotFoundException({
        code: 'MATCH_NOT_FOUND',
        message: 'Không tìm thấy thông tin tương hợp.',
      });
    }

    if (match.userA !== callerId && match.userB !== callerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền gọi điện trong tương hợp này.',
      });
    }

    const calleeId = match.userA === callerId ? match.userB : match.userA;

    // Busy check: neither caller nor callee can be in an active call
    const activeCall = await this.prisma.call.findFirst({
      where: {
        OR: [
          { callerId: { in: [callerId, calleeId] } },
          { calleeId: { in: [callerId, calleeId] } },
        ],
        endedAt: null,
        createdAt: {
          gte: new Date(Date.now() - 3600 * 1000), // Within last 1 hour
        },
      },
    });

    if (activeCall) {
      throw new ConflictException({
        code: 'USER_BUSY',
        message: 'Người dùng hiện đang bận trong một cuộc gọi khác.',
      });
    }

    // Create call record
    const call = await this.prisma.call.create({
      data: {
        kind: 'match',
        callerId,
        calleeId,
      },
    });

    // Fetch caller info for incoming call prompt
    const callerUser = await this.prisma.user.findUnique({
      where: { id: callerId },
      include: {
        profile: true,
        photos: {
          where: { moderationStatus: 'approved' },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });

    // Set 30s auto-missed timer
    const timeout = setTimeout(async () => {
      try {
        const checkCall = await this.prisma.call.findUnique({
          where: { id: call.id },
        });
        if (checkCall && !checkCall.startedAt && !checkCall.endedAt) {
          await this.prisma.call.update({
            where: { id: call.id },
            data: {
              endedAt: new Date(),
              endReason: 'missed',
            },
          });
          this.realtimeGateway.emitToUser(callerId, 'call:missed', { callId: call.id });
          this.realtimeGateway.emitToUser(calleeId, 'call:missed', { callId: call.id });
        }
      } catch (err) {
        this.logger.error(`Error in 30s call timeout: ${(err as Error).message}`);
      } finally {
        this.timeouts.delete(call.id);
      }
    }, 30000);

    this.timeouts.set(call.id, timeout);

    // Emit call:incoming to callee
    this.realtimeGateway.emitToUser(calleeId, 'call:incoming', {
      callId: call.id,
      caller: {
        id: callerId,
        displayName: callerUser?.profile?.displayName || 'Người dùng',
        avatar: callerUser?.photos[0]?.url || null,
      },
      matchId,
    });

    return { callId: call.id, calleeId };
  }

  async acceptCall(calleeId: string, callId: string): Promise<{ success: boolean }> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call || call.endedAt !== null) {
      throw new NotFoundException({
        code: 'CALL_NOT_FOUND',
        message: 'Cuộc gọi không tồn tại hoặc đã kết thúc.',
      });
    }

    if (call.calleeId !== calleeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền nhận cuộc gọi này.',
      });
    }

    // Cancel 30s timeout
    const timeout = this.timeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(callId);
    }

    await this.prisma.call.update({
      where: { id: callId },
      data: {
        startedAt: new Date(),
      },
    });

    this.realtimeGateway.emitToUser(call.callerId, 'call:accepted', { callId });
    this.realtimeGateway.emitToUser(calleeId, 'call:accepted', { callId });

    return { success: true };
  }

  async declineCall(calleeId: string, callId: string): Promise<{ success: boolean }> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call || call.endedAt !== null) {
      return { success: true };
    }

    if (call.calleeId !== calleeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền từ chối cuộc gọi này.',
      });
    }

    const timeout = this.timeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(callId);
    }

    await this.prisma.call.update({
      where: { id: callId },
      data: {
        endedAt: new Date(),
        endReason: 'declined',
      },
    });

    this.realtimeGateway.emitToUser(call.callerId, 'call:declined', { callId });

    return { success: true };
  }

  async endCall(
    userId: string,
    callId: string,
    reason?: CallEndReason,
  ): Promise<{ success: boolean; durationSeconds: number }> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException({
        code: 'CALL_NOT_FOUND',
        message: 'Không tìm thấy cuộc gọi.',
      });
    }

    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không thuộc cuộc gọi này.',
      });
    }

    const timeout = this.timeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(callId);
    }

    if (call.endedAt) {
      const dur = call.startedAt
        ? Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000)
        : 0;
      return { success: true, durationSeconds: Math.max(0, dur) };
    }

    const now = new Date();
    const finalReason: CallEndReason =
      reason || (call.startedAt ? 'completed' : 'cancelled');

    await this.prisma.call.update({
      where: { id: callId },
      data: {
        endedAt: now,
        endReason: finalReason,
      },
    });

    const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
    this.realtimeGateway.emitToUser(otherUserId, 'call:ended', {
      callId,
      reason: finalReason,
    });

    const durationSeconds = call.startedAt
      ? Math.floor((now.getTime() - call.startedAt.getTime()) / 1000)
      : 0;

    return { success: true, durationSeconds: Math.max(0, durationSeconds) };
  }

  forwardSignal(
    senderId: string,
    callId: string,
    targetUserId: string,
    signal: unknown,
  ): void {
    // 16 KB signal payload validation limit
    const jsonStr = JSON.stringify(signal);
    if (Buffer.byteLength(jsonStr, 'utf8') > 16384) {
      throw new BadRequestException({
        code: 'SIGNAL_TOO_LARGE',
        message: 'Dữ liệu signaling vượt quá giới hạn tối đa 16 KB.',
      });
    }

    this.realtimeGateway.emitToUser(targetUserId, 'rtc:signal', {
      callId,
      senderId,
      signal,
    });
  }
}
