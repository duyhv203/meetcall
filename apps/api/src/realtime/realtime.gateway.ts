import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

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
