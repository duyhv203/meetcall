import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PhotoModerationStatus, PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();

    try {
      // Ensure required columns exist even if migrations were skipped or cached
      await this.$executeRawUnsafe(
        'ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not run schema patch for interests: ${msg}`);
    }

    // Auto-seed initial admin account if none exists
    try {
      const adminCount = await this.user.count({ where: { role: UserRole.admin } });
      if (adminCount === 0) {
        const passwordHash = await argon2.hash('Password123!', {
          type: argon2.argon2id,
        });

        const admin = await this.user.create({
          data: {
            email: 'admin@meetcall.local',
            passwordHash,
            role: UserRole.admin,
            ageVerified: true,
            profile: {
              create: {
                displayName: 'Admin MeetCall',
                birthdate: new Date('1990-01-01'),
                gender: 'other',
                bio: 'Quản trị viên hệ thống MeetCall',
                city: 'Hà Nội',
                interests: ['admin', 'moderation'],
              },
            },
            preferences: {
              create: {
                genderFilter: ['male', 'female'],
                minAge: 18,
                maxAge: 100,
                maxDistanceKm: 100,
              },
            },
            photos: {
              create: [
                {
                  url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
                  position: 0,
                  moderationStatus: PhotoModerationStatus.approved,
                },
              ],
            },
          },
        });

        this.logger.log(`👑 Initial admin created: admin@meetcall.local (id: ${admin.id})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Initial admin check/creation skipped: ${msg}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
