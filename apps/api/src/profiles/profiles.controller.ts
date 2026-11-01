import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service.js';
import { PhotosService } from '../photos/photos.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type {
  AuthUser,
  ConfirmPhotoRequest,
  DeleteAccountResponse,
  ExportDataResponse,
  GetUploadUrlRequest,
  GetUploadUrlResponse,
  MeResponse,
  PhotoData,
  ProfileData,
  RegisterDeviceRequest,
  ReorderPhotosRequest,
  UnregisterDeviceRequest,
  UpdateLocationRequest,
  UpdatePreferencesRequest,
  UpdateProfileRequest,
} from '@meetcall/shared';

@Controller('me')
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly photosService: PhotosService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async getMe(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.profilesService.getMe(user.id);
  }

  @Patch('profile')
  @Put('profile')
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileRequest,
  ): Promise<ProfileData> {
    return this.profilesService.updateProfile(user.id, dto);
  }

  @Put('preferences')
  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferencesRequest,
  ) {
    return this.profilesService.updatePreferences(user.id, dto);
  }

  @Put('location')
  @Patch('location')
  async updateLocation(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLocationRequest,
  ): Promise<{ success: boolean; city?: string }> {
    return this.profilesService.updateLocation(user.id, dto);
  }

  @Post('photos/upload-url')
  async getUploadUrl(
    @CurrentUser() user: AuthUser,
    @Body() dto: GetUploadUrlRequest,
  ): Promise<GetUploadUrlResponse> {
    return this.photosService.getUploadUrl(user.id, dto);
  }

  @Post('photos')
  async confirmPhoto(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmPhotoRequest,
  ): Promise<PhotoData> {
    return this.photosService.confirmPhoto(user.id, dto.key);
  }

  @Patch('photos/order')
  @Put('photos/reorder')
  @Patch('photos/reorder')
  async reorderPhotos(
    @CurrentUser() user: AuthUser,
    @Body() dto: { ids?: string[]; photoIds?: string[] },
  ): Promise<PhotoData[]> {
    const ids = dto.ids || dto.photoIds || [];
    return this.photosService.reorderPhotos(user.id, ids);
  }

  @Delete('photos/:id')
  @HttpCode(HttpStatus.OK)
  async deletePhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.photosService.deletePhoto(user.id, id);
  }

  @Post('devices')
  @HttpCode(HttpStatus.OK)
  async registerDevice(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDeviceRequest,
  ): Promise<{ success: boolean }> {
    return this.notificationsService.registerDevice(user.id, dto);
  }

  @Delete('devices')
  @HttpCode(HttpStatus.OK)
  async unregisterDevice(
    @CurrentUser() user: AuthUser,
    @Body() dto: UnregisterDeviceRequest,
  ): Promise<{ success: boolean }> {
    return this.notificationsService.unregisterDevice(user.id, dto.fcmToken);
  }

  @Get('export')
  async exportData(@CurrentUser() user: AuthUser): Promise<ExportDataResponse> {
    return this.profilesService.exportData(user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: AuthUser): Promise<DeleteAccountResponse> {
    return this.profilesService.deleteAccount(user.id);
  }
}
