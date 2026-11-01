import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from './services/storage.service.js';
import { PhotoProcessorService } from './services/photo-processor.service.js';
import type {
  GetUploadUrlRequest,
  GetUploadUrlResponse,
  PhotoData,
} from '@meetcall/shared';

@Injectable()
export class PhotosService {
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
  private readonly MAX_PHOTOS_PER_USER = 6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly photoProcessor: PhotoProcessorService,
  ) {}

  async getUploadUrl(
    userId: string,
    dto: GetUploadUrlRequest,
  ): Promise<GetUploadUrlResponse> {
    if (!this.ALLOWED_MIME_TYPES.includes(dto.contentType)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPEG, PNG hoặc WebP.',
      });
    }

    if (dto.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Dung lượng ảnh vượt quá giới hạn 8 MB.',
      });
    }

    const currentPhotoCount = await this.prisma.photo.count({
      where: { userId },
    });

    if (currentPhotoCount >= this.MAX_PHOTOS_PER_USER) {
      throw new BadRequestException({
        code: 'PHOTO_LIMIT_REACHED',
        message: `Mỗi tài khoản chỉ được tải lên tối đa ${this.MAX_PHOTOS_PER_USER} ảnh.`,
      });
    }

    const ext = dto.contentType === 'image/png' ? 'png' : dto.contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `photos/${userId}/${crypto.randomUUID()}.${ext}`;

    const { uploadUrl } = await this.storageService.getPresignedUploadUrl(
      key,
      dto.contentType,
      300,
    );

    return {
      uploadUrl,
      key,
      expiresIn: 300,
    };
  }

  async confirmPhoto(userId: string, key: string): Promise<PhotoData> {
    if (!key.startsWith(`photos/${userId}/`)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền xác nhận ảnh của người dùng khác.',
      });
    }

    const currentCount = await this.prisma.photo.count({
      where: { userId },
    });

    if (currentCount >= this.MAX_PHOTOS_PER_USER) {
      throw new BadRequestException({
        code: 'PHOTO_LIMIT_REACHED',
        message: `Mỗi tài khoản chỉ được tải lên tối đa ${this.MAX_PHOTOS_PER_USER} ảnh.`,
      });
    }

    const photo = await this.prisma.photo.create({
      data: {
        userId,
        url: '', // Temporary placeholder until worker updates with processed URL
        position: currentCount,
        moderationStatus: 'pending',
      },
    });

    // Enqueue background processing (resize, EXIF strip, moderation)
    await this.photoProcessor.addPhotoJob({
      photoId: photo.id,
      key,
      userId,
    });

    return {
      id: photo.id,
      userId: photo.userId,
      url: photo.url,
      position: photo.position,
      moderationStatus: photo.moderationStatus,
      createdAt: photo.createdAt.toISOString(),
    };
  }

  async reorderPhotos(userId: string, ids: string[]): Promise<PhotoData[]> {
    const userPhotos = await this.prisma.photo.findMany({
      where: { userId },
    });

    const userPhotoIds = new Set(userPhotos.map((p) => p.id));
    const allBelong = ids.every((id) => userPhotoIds.has(id));

    if (!allBelong || ids.length !== userPhotos.length) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Danh sách ảnh cần sắp xếp không hợp lệ hoặc chứa ảnh của người khác.',
      });
    }

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.photo.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    const updated = await this.prisma.photo.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    });

    return updated.map((p) => ({
      id: p.id,
      userId: p.userId,
      url: p.url,
      position: p.position,
      moderationStatus: p.moderationStatus,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async deletePhoto(userId: string, photoId: string): Promise<{ success: boolean }> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Ảnh không tồn tại.',
      });
    }

    if (photo.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền xoá ảnh của người khác.',
      });
    }

    await this.prisma.photo.delete({
      where: { id: photoId },
    });

    return { success: true };
  }
}
