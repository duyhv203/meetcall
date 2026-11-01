import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SwipesService } from './swipes.service.js';
import type { AuthUser, SwipeRequest, SwipeResponse } from '@meetcall/shared';

@Controller('swipes')
@UseGuards(AuthGuard)
export class SwipesController {
  constructor(private readonly swipesService: SwipesService) {}

  @Get('quota')
  async getQuota(@CurrentUser() user: AuthUser) {
    return this.swipesService.getQuota(user.id);
  }

  @Post('topup')
  @HttpCode(HttpStatus.OK)
  async topup(
    @CurrentUser() user: AuthUser,
    @Body() body: { packageId?: string },
  ) {
    return this.swipesService.topup(user.id, body?.packageId || 'swipe_20');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async swipe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SwipeRequest,
  ): Promise<SwipeResponse> {
    return this.swipesService.swipe(user.id, dto);
  }
}
