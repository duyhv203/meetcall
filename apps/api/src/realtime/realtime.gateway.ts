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

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
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

  emitToUser(userId: string, event: string, data: unknown): void {
    if (this.server) {
      this.server.to(`user:${userId}`).emit(event, data);
    }
  }

  emitToMatch(matchId: string, event: string, data: unknown): void {
    if (this.server) {
      this.server.to(`match:${matchId}`).emit(event, data);
    }
  }
}
