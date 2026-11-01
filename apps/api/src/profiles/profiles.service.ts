import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  DeleteAccountResponse,
  ExportDataResponse,
  MeResponse,
  PhotoData,
  PreferencesData,
  ProfileData,
  UpdateLocationRequest,
  UpdatePreferencesRequest,
  UpdateProfileRequest,
} from '@meetcall/shared';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
        photos: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy thông tin người dùng.',
      });
    }

    const photos: PhotoData[] = user.photos.map((p) => ({
      id: p.id,
      userId: p.userId,
      url: p.url,
      position: p.position,
      moderationStatus: p.moderationStatus,
      createdAt: p.createdAt.toISOString(),
    }));

    const hasApprovedPhoto = photos.some((p) => p.moderationStatus === 'approved');
    const isProfileComplete = Boolean(
      user.profile.displayName &&
        user.profile.displayName.length >= 2 &&
        Boolean(user.profile.gender) &&
        Boolean(user.profile.city),
    );

    const onboardingCompleted = Boolean(isProfileComplete && hasApprovedPhoto);

    const profileData: ProfileData = {
      userId: user.profile.userId,
      displayName: user.profile.displayName,
      birthdate: user.profile.birthdate.toISOString().split('T')[0] || '',
      gender: user.profile.gender,
      bio: user.profile.bio,
      interests: user.profile.interests,
      city: user.profile.city,
      lastActiveAt: user.profile.lastActiveAt.toISOString(),
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        ageVerified: user.ageVerified,
      },
      profile: profileData,
      preferences: user.preferences
        ? {
            userId: user.preferences.userId,
            genderFilter: user.preferences.genderFilter,
            minAge: user.preferences.minAge,
            maxAge: user.preferences.maxAge,
            maxDistanceKm: user.preferences.maxDistanceKm,
          }
        : null,
      photos,
      onboardingCompleted,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileRequest): Promise<ProfileData> {
    if (dto.displayName !== undefined) {
      const trimmed = dto.displayName.trim();
      if (trimmed.length < 2 || trimmed.length > 30) {
        throw new BadRequestException({
          code: 'INVALID_DISPLAY_NAME',
          message: 'Tên hiển thị phải có độ dài từ 2 đến 30 ký tự.',
        });
      }
    }

    if (dto.bio !== undefined && dto.bio !== null && dto.bio.length > 300) {
      throw new BadRequestException({
        code: 'BIO_TOO_LONG',
        message: 'Tiểu sử giới thiệu tối đa 300 ký tự.',
      });
    }

    if (dto.gender !== undefined) {
      const allowedGenders = ['male', 'female', 'other'];
      if (!allowedGenders.includes(dto.gender)) {
        throw new BadRequestException({
          code: 'INVALID_GENDER',
          message: 'Giới tính không hợp lệ.',
        });
      }
    }

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: {
        ...(dto.displayName && { displayName: dto.displayName.trim() }),
        ...(dto.gender && { gender: dto.gender }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.interests && { interests: dto.interests }),
        ...(dto.city !== undefined && { city: dto.city }),
      },
    });

    return {
      userId: updated.userId,
      displayName: updated.displayName,
      birthdate: updated.birthdate.toISOString().split('T')[0] || '',
      gender: updated.gender,
      bio: updated.bio,
      interests: updated.interests,
      city: updated.city,
      lastActiveAt: updated.lastActiveAt.toISOString(),
    };
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesRequest,
  ): Promise<{ success: boolean; preferences: PreferencesData }> {
    if (dto.minAge < 18) {
      throw new BadRequestException({
        code: 'MIN_AGE_TOO_LOW',
        message: 'Độ tuổi tối thiểu không được dưới 18 tuổi.',
      });
    }

    if (dto.minAge > dto.maxAge) {
      throw new BadRequestException({
        code: 'INVALID_AGE_RANGE',
        message: 'Độ tuổi tối thiểu không thể lớn hơn độ tuổi tối đa.',
      });
    }

    if (dto.maxDistanceKm < 1 || dto.maxDistanceKm > 200) {
      throw new BadRequestException({
        code: 'INVALID_DISTANCE',
        message: 'Khoảng cách tìm kiếm phải từ 1 đến 200 km.',
      });
    }

    const pref = await this.prisma.preferences.upsert({
      where: { userId },
      create: {
        userId,
        genderFilter: dto.genderFilter,
        minAge: dto.minAge,
        maxAge: dto.maxAge,
        maxDistanceKm: dto.maxDistanceKm,
      },
      update: {
        genderFilter: dto.genderFilter,
        minAge: dto.minAge,
        maxAge: dto.maxAge,
        maxDistanceKm: dto.maxDistanceKm,
      },
    });

    return {
      success: true,
      preferences: {
        userId: pref.userId,
        genderFilter: pref.genderFilter,
        minAge: pref.minAge,
        maxAge: pref.maxAge,
        maxDistanceKm: pref.maxDistanceKm,
      },
    };
  }

  async updateLocation(
    userId: string,
    dto: UpdateLocationRequest,
  ): Promise<{ success: boolean; city?: string }> {
    if (dto.lat < -90 || dto.lat > 90 || dto.lng < -180 || dto.lng > 180) {
      throw new BadRequestException({
        code: 'INVALID_COORDINATES',
        message: 'Toạ độ GPS không hợp lệ.',
      });
    }

    // Update location via PostGIS geography Point(lng, lat)
    if (dto.city) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "profiles" SET "location" = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, "city" = $4 WHERE "user_id" = $3::uuid`,
        dto.lng,
        dto.lat,
        userId,
        dto.city,
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "profiles" SET "location" = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE "user_id" = $3::uuid`,
        dto.lng,
        dto.lat,
        userId,
      );
    }

    return { success: true };
  }

  async exportData(userId: string): Promise<ExportDataResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
        photos: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại.',
      });
    }

    const [matchesCount, messagesSentCount, callsCount, blocksCount] = await Promise.all([
      this.prisma.match.count({
        where: {
          OR: [{ userA: userId }, { userB: userId }],
          unmatchedAt: null,
        },
      }),
      this.prisma.message.count({
        where: { senderId: userId },
      }),
      this.prisma.call.count({
        where: {
          OR: [{ callerId: userId }, { calleeId: userId }],
        },
      }),
      this.prisma.block.count({
        where: { blockerId: userId },
      }),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        ageVerified: user.ageVerified,
        createdAt: user.createdAt.toISOString(),
      },
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            birthdate: user.profile.birthdate.toISOString().split('T')[0] || '',
            gender: user.profile.gender,
            bio: user.profile.bio,
            interests: user.profile.interests,
            city: user.profile.city,
          }
        : null,
      preferences: user.preferences
        ? {
            minAge: user.preferences.minAge,
            maxAge: user.preferences.maxAge,
            maxDistanceKm: user.preferences.maxDistanceKm,
            genderFilter: user.preferences.genderFilter,
          }
        : null,
      photos: user.photos.map((p) => ({
        id: p.id,
        url: p.url,
        position: p.position,
        moderationStatus: p.moderationStatus,
        createdAt: p.createdAt.toISOString(),
      })),
      matchesCount,
      messagesSentCount,
      callsCount,
      blocksCount,
      exportedAt: new Date().toISOString(),
    };
  }

  async deleteAccount(userId: string): Promise<DeleteAccountResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại.',
      });
    }

    // 1. Soft-delete user status = 'deleted'
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: 'deleted' },
      });

      // 2. Revoke all refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 3. Delete device tokens
      await tx.deviceToken.deleteMany({
        where: { userId },
      });

      // 4. Unmatch active matches
      await tx.match.updateMany({
        where: {
          OR: [{ userA: userId }, { userB: userId }],
          unmatchedAt: null,
        },
        data: { unmatchedAt: new Date() },
      });
    });

    const scheduledDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return {
      success: true,
      message: 'Tài khoản của bạn đã được đánh dấu xoá và sẽ bị xoá vĩnh viễn sau 7 ngày.',
      scheduledPermanentDeleteAt: scheduledDate.toISOString(),
    };
  }
}
