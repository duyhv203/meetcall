import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SafetyService } from './safety.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type {
  AgeVerificationWebhookPayload,
  AuthUser,
  BlockItemResponse,
  CreateBlockRequest,
  CreateReportRequest,
  CreateReportResponse,
} from '@meetcall/shared';

@Controller()
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @UseGuards(AuthGuard)
  @Post('blocks')
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateBlockRequest,
  ): Promise<{ success: boolean; message: string }> {
    return this.safetyService.blockUser(user.id, body.blockedId);
  }

  @UseGuards(AuthGuard)
  @Get('blocks')
  async getBlockedUsers(
    @CurrentUser() user: AuthUser,
  ): Promise<BlockItemResponse[]> {
    return this.safetyService.getBlockedUsers(user.id);
  }

  @UseGuards(AuthGuard)
  @Delete('blocks/:blockedId')
  @HttpCode(HttpStatus.OK)
  async unblockUser(
    @CurrentUser() user: AuthUser,
    @Param('blockedId') blockedId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.safetyService.unblockUser(user.id, blockedId);
  }

  @UseGuards(AuthGuard)
  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  async reportUser(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateReportRequest,
  ): Promise<CreateReportResponse> {
    return this.safetyService.reportUser(user.id, body);
  }

  @Post('age-verification/webhook')
  @HttpCode(HttpStatus.OK)
  async handleAgeVerificationWebhook(
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() payload: AgeVerificationWebhookPayload,
  ): Promise<{ success: boolean; userId: string; ageVerified: boolean }> {
    return this.safetyService.handleAgeVerificationWebhook(signature, payload);
  }
}
