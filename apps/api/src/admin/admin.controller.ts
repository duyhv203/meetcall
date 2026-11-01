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
import { AdminService } from './admin.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type {
  AdminReportItem,
  AuthUser,
  ModeratePhotoRequest,
  ReportStatusType,
  ResolveReportRequest,
  SuspendUserRequest,
} from '@meetcall/shared';
import type { PhotoModerationStatus } from '@prisma/client';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('reports')
  async getReports(
    @Query('status') status?: ReportStatusType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminReportItem[]> {
    return this.adminService.getReports(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveReport(
    @CurrentUser() admin: AuthUser,
    @Param('id') reportId: string,
    @Body() body: ResolveReportRequest,
  ) {
    return this.adminService.resolveReport(admin.id, reportId, body);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @CurrentUser() admin: AuthUser,
    @Param('id') userId: string,
    @Body() body: SuspendUserRequest,
  ) {
    return this.adminService.suspendUser(admin.id, userId, body);
  }

  @Get('photos')
  async getPhotos(
    @Query('status') status?: PhotoModerationStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getPhotos(
      status ?? 'pending',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('photos/:id/moderate')
  @HttpCode(HttpStatus.OK)
  async moderatePhoto(
    @CurrentUser() admin: AuthUser,
    @Param('id') photoId: string,
    @Body() body: ModeratePhotoRequest,
  ) {
    return this.adminService.moderatePhoto(admin.id, photoId, body);
  }
}
