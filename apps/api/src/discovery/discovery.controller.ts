import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { DiscoveryService } from './discovery.service.js';
import type { AuthUser, DiscoverCandidate } from '@meetcall/shared';

@Controller('discover')
@UseGuards(AuthGuard)
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get()
  async getCandidates(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ): Promise<DiscoverCandidate[]> {
    const parsedLimit = limit ? Math.min(50, Math.max(1, parseInt(limit, 10))) : 20;
    return this.discoveryService.getCandidates(user.id, parsedLimit);
  }
}
