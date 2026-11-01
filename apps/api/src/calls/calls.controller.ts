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
import { CallsService } from './calls.service.js';
import type {
  AuthUser,
  EndCallRequest,
  IceServersResponse,
  InitiateCallRequest,
  InitiateCallResponse,
} from '@meetcall/shared';

@Controller('calls')
@UseGuards(AuthGuard)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get('ice-servers')
  getIceServers(@CurrentUser() user: AuthUser): IceServersResponse {
    return this.callsService.getIceServers(user.id);
  }

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  async initiateCall(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiateCallRequest,
  ): Promise<InitiateCallResponse> {
    return this.callsService.initiateCall(user.id, dto.matchId);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptCall(
    @CurrentUser() user: AuthUser,
    @Param('id') callId: string,
  ): Promise<{ success: boolean }> {
    return this.callsService.acceptCall(user.id, callId);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  async declineCall(
    @CurrentUser() user: AuthUser,
    @Param('id') callId: string,
  ): Promise<{ success: boolean }> {
    return this.callsService.declineCall(user.id, callId);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async endCall(
    @CurrentUser() user: AuthUser,
    @Param('id') callId: string,
    @Body() dto?: EndCallRequest,
  ): Promise<{ success: boolean; durationSeconds: number }> {
    return this.callsService.endCall(user.id, callId, dto?.reason);
  }
}
