import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ChatService } from './chat.service.js';
import type {
  AuthUser,
  ChatMessage,
  MessagesResponse,
  SendMessageRequest,
  UserPresenceResponse,
} from '@meetcall/shared';

@Controller()
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('matches/:id/messages')
  async getMessages(
    @CurrentUser() user: AuthUser,
    @Param('id') matchId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<MessagesResponse> {
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    return this.chatService.getMessages(user.id, matchId, cursor, parsedLimit);
  }

  @Post('matches/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') matchId: string,
    @Body() dto: SendMessageRequest,
  ): Promise<ChatMessage> {
    return this.chatService.sendMessage(user.id, matchId, dto.content);
  }

  @Post('matches/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id') matchId: string,
  ): Promise<{ success: boolean; readCount: number }> {
    return this.chatService.markAsRead(user.id, matchId);
  }

  @Get('users/:id/presence')
  async getPresence(
    @Param('id') targetUserId: string,
  ): Promise<UserPresenceResponse> {
    const isOnline = await this.chatService.isUserOnline(targetUserId);
    return {
      userId: targetUserId,
      isOnline,
    };
  }
}
