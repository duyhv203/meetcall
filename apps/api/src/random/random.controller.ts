import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RandomService } from './random.service.js';
import type {
  AuthUser,
  FriendVoteRequest,
  FriendVoteResponse,
} from '@meetcall/shared';

@Controller()
@UseGuards(AuthGuard)
export class RandomController {
  constructor(private readonly randomService: RandomService) {}

  @Get('random/eligibility')
  async checkEligibility(@CurrentUser() user: AuthUser) {
    const info = await this.randomService.assertEligibleForRandom(user.id);
    return {
      eligible: true,
      user: info,
    };
  }

  @Get('random/vip-status')
  async getVipStatus(@CurrentUser() user: AuthUser) {
    return this.randomService.getVipStatus(user.id);
  }

  @Post('random/vip-upgrade')
  @HttpCode(HttpStatus.OK)
  async upgradeVip(
    @CurrentUser() user: AuthUser,
    @Body() body: { packageId?: string },
  ) {
    return this.randomService.upgradeVip(user.id, body?.packageId || 'vip_1month');
  }

  @Post('calls/:id/friend-vote')
  @HttpCode(HttpStatus.OK)
  async voteFriend(
    @CurrentUser() user: AuthUser,
    @Param('id') callId: string,
    @Body() dto: FriendVoteRequest,
  ): Promise<FriendVoteResponse> {
    return this.randomService.voteFriend(user.id, callId, dto.wantsFriend);
  }
}
