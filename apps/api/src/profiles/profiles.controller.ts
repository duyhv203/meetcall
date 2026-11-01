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
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type {
  AuthUser,
  ConfirmPhotoRequest,
  GetUploadUrlRequest,
  GetUploadUrlResponse,
  MeResponse,
  PhotoData,
  ProfileData,
  ReorderPhotosRequest,
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
  ) {}

  @Get()
  async getMe(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.profilesService.getMe(user.id);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileRequest,
  ): Promise<ProfileData> {
    return this.profilesService.updateProfile(user.id, dto);
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferencesRequest,
  ): Promise<{ success: boolean }> {
    return this.profilesService.updatePreferences(user.id, dto);
  }

  @Put('location')
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
  async reorderPhotos(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderPhotosRequest,
  ): Promise<PhotoData[]> {
    return this.photosService.reorderPhotos(user.id, dto.ids);
  }

  @Delete('photos/:id')
  @HttpCode(HttpStatus.OK)
  async deletePhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.photosService.deletePhoto(user.id, id);
  }
}
