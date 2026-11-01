import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service.js';
import { ChatService } from '../chat/chat.service.js';
import { CallsService } from '../calls/calls.service.js';
import { RandomService } from '../random/random.service.js';
import type { CallEndReason } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, true);
    },
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => CallsService))
    private readonly callsService: CallsService,
    @Inject(forwardRef(() => RandomService))
    private readonly randomService: RandomService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const authHeader =
        (client.handshake.auth?.token as string | undefined) ||
        (client.handshake.headers.authorization as string | undefined);

      if (!authHeader) {
        this.logger.debug(`Socket ${client.id} rejected: No auth token`);
        client.disconnect(true);
        return;
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      client.data.userId = payload.sub;
      client.data.email = payload.email;

      // Join individual room for private notifications
      await client.join(`user:${payload.sub}`);

      // Set online presence with 60s TTL
      await this.redisService.getClient().set(`presence:${payload.sub}`, '1', 'EX', 60);

      this.logger.debug(`User ${payload.sub} connected on socket ${client.id}`);
    } catch (err) {
      this.logger.debug(`Socket authentication failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    if (client.data.userId) {
      this.logger.debug(`User ${client.data.userId} disconnected socket ${client.id}`);
      void this.randomService.leaveQueue(client.data.userId);
    }
  }

  @SubscribeMessage('presence:heartbeat')
  async handlePresenceHeartbeat(@ConnectedSocket() client: Socket): Promise<{ status: string }> {
    const userId = client.data.userId;
    if (userId) {
      await this.redisService.getClient().set(`presence:${userId}`, '1', 'EX', 60);
    }
    return { status: 'ok' };
  }

  // CHAT EVENTS
  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; content: string },
  ): Promise<{ success: boolean; error?: string }> {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }
    try {
      await this.chatService.sendMessage(userId, data.matchId, data.content);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send message failed';
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('chat:typing')
  async handleChatTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; isTyping: boolean },
  ): Promise<void> {
    const userId = client.data.userId;
    if (!userId) return;
    await this.chatService.sendTyping(userId, data.matchId, data.isTyping);
  }

  @SubscribeMessage('chat:read')
  async handleChatRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ): Promise<{ success: boolean }> {
    const userId = client.data.userId;
    if (!userId) return { success: false };
    const res = await this.chatService.markAsRead(userId, data.matchId);
    return { success: res.success };
  }

  // DIRECT CALL EVENTS
  @SubscribeMessage('call:accept')
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ): Promise<{ success: boolean }> {
    const userId = client.data.userId;
    if (!userId) return { success: false };
    return this.callsService.acceptCall(userId, data.callId);
  }

  @SubscribeMessage('call:decline')
  async handleCallDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ): Promise<{ success: boolean }> {
    const userId = client.data.userId;
    if (!userId) return { success: false };
    return this.callsService.declineCall(userId, data.callId);
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; reason?: CallEndReason },
  ): Promise<{ success: boolean }> {
    const userId = client.data.userId;
    if (!userId) return { success: false };
    await this.callsService.endCall(userId, data.callId, data.reason);
    return { success: true };
  }

  // WEBRTC SIGNALING
  @SubscribeMessage('rtc:signal')
  handleRtcSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; targetUserId: string; signal: unknown },
  ): void {
    const userId = client.data.userId;
    if (!userId) return;
    this.callsService.forwardSignal(userId, data.callId, data.targetUserId, data.signal);
  }

  // RANDOM OMEGLE CALL EVENTS
  @SubscribeMessage('random:join')
  async handleRandomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data?: {
      preferredGender?: string;
      minAge?: number;
      maxAge?: number;
      preferredCity?: string;
    },
  ): Promise<{ paired: boolean; error?: string }> {
    const userId = client.data.userId;
    if (!userId) return { paired: false, error: 'UNAUTHORIZED' };
    try {
      const res = await this.randomService.joinQueue(
        userId,
        client.id,
        data?.preferredGender,
        data?.minAge,
        data?.maxAge,
        data?.preferredCity,
      );
      return res;
    } catch (err) {
      const resp = (err as any)?.response || {};
      const message = resp.message || (err instanceof Error ? err.message : 'Join random queue failed');
      const code = resp.code || 'ERROR';
      client.emit('random:error', { code, message });
      return { paired: false, error: message };
    }
  }

  @SubscribeMessage('random:next')
  async handleRandomNext(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      callId?: string;
      preferredGender?: string;
      minAge?: number;
      maxAge?: number;
      preferredCity?: string;
    },
  ): Promise<{ paired: boolean; error?: string }> {
    const userId = client.data.userId;
    if (!userId) return { paired: false, error: 'UNAUTHORIZED' };
    try {
      if (data.callId) {
        await this.randomService.skipCall(userId, data.callId);
      }
      return await this.randomService.joinQueue(
        userId,
        client.id,
        data.preferredGender,
        data.minAge,
        data.maxAge,
        data.preferredCity,
      );
    } catch (err) {
      const resp = (err as any)?.response || {};
      const message = resp.message || (err instanceof Error ? err.message : 'Next random failed');
      const code = resp.code || 'ERROR';
      client.emit('random:error', { code, message });
      return { paired: false, error: message };
    }
  }

  @SubscribeMessage('random:leave')
  async handleRandomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { callId?: string },
  ): Promise<{ success: boolean }> {
    const userId = client.data.userId;
    if (!userId) return { success: false };
    await this.randomService.leaveQueue(userId);
    if (data?.callId) {
      await this.randomService.skipCall(userId, data.callId);
    }
    return { success: true };
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    if (this.server) {
      this.server.to(`user:${userId}`).emit(event, data);
    }
  }

  isUserOnline(userId: string): boolean {
    if (!this.server?.sockets?.adapter?.rooms) return false;
    const room = this.server.sockets.adapter.rooms.get(`user:${userId}`);
    return Boolean(room && room.size > 0);
  }

  emitToMatch(matchId: string, event: string, data: unknown): void {
    if (this.server) {
      this.server.to(`match:${matchId}`).emit(event, data);
    }
  }
}
