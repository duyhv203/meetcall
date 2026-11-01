import {
  Controller,
  Delete,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { MatchesService } from './matches.service.js';
import type { AuthUser, MatchItem } from '@meetcall/shared';

@Controller('matches')
@UseGuards(AuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  async getMatches(@CurrentUser() user: AuthUser): Promise<MatchItem[]> {
    return this.matchesService.getMatches(user.id);
  }

  @Delete(':id')
  async unmatch(
    @CurrentUser() user: AuthUser,
    @Param('id') matchId: string,
  ): Promise<{ success: boolean }> {
    return this.matchesService.unmatch(user.id, matchId);
  }
}
