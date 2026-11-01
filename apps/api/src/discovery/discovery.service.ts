import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DiscoverCandidate } from '@meetcall/shared';

interface RawCandidateRow {
  userId: string;
  displayName: string;
  age: number;
  gender: string;
  bio: string | null;
  interests: string[] | null;
  city: string | null;
  distanceKm: number;
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCandidates(
    userId: string,
    limit = 20,
  ): Promise<DiscoverCandidate[]> {
    // 1. Fetch user's preferences & location
    const [userProfile, userPrefs] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { city: true },
      }),
      this.prisma.preferences.findUnique({
        where: { userId },
      }),
    ]);

    const minAge = userPrefs?.minAge ?? 18;
    const maxAge = userPrefs?.maxAge ?? 100;
    const maxDistMeters = (userPrefs?.maxDistanceKm ?? 50) * 1000;
    const genderFilter = userPrefs?.genderFilter ?? [];

    // Query candidates with PostGIS ST_DWithin and 5km rounded distance
    const candidates = await this.prisma.$queryRaw<RawCandidateRow[]>`
      SELECT 
        u.id as "userId",
        p.display_name as "displayName",
        EXTRACT(YEAR FROM age(CURRENT_DATE, p.birthdate))::int as "age",
        p.gender as "gender",
        p.bio as "bio",
        p.interests as "interests",
        p.city as "city",
        CASE 
          WHEN me_p.location IS NOT NULL AND p.location IS NOT NULL THEN
            GREATEST(5, ROUND(ST_Distance(p.location, me_p.location) / 5000.0) * 5)::int
          ELSE 5
        END as "distanceKm"
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN profiles me_p ON me_p.user_id = ${userId}::uuid
      WHERE p.user_id != ${userId}::uuid
        AND u.status = 'active'
        AND u.role = 'user'
        AND p.user_id NOT IN (
          SELECT to_user FROM swipes WHERE from_user = ${userId}::uuid
        )
        AND p.user_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}::uuid
          UNION
          SELECT blocker_id FROM blocks WHERE blocked_id = ${userId}::uuid
        )
        AND EXISTS (
          SELECT 1 FROM photos ph 
          WHERE ph.user_id = p.user_id AND ph.moderation_status = 'approved'
        )
        AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.birthdate)) >= ${minAge}
        AND EXTRACT(YEAR FROM age(CURRENT_DATE, p.birthdate)) <= ${maxAge}
        AND (
          ${genderFilter.length === 0} 
          OR p.gender = ANY(${genderFilter}::varchar[])
        )
        AND (
          me_p.location IS NULL 
          OR p.location IS NULL 
          OR ST_DWithin(p.location, me_p.location, ${maxDistMeters})
        )
      ORDER BY p.last_active_at DESC
      LIMIT ${limit}
    `;

    if (!candidates || candidates.length === 0) {
      return [];
    }

    // 2. Fetch approved photos for candidates
    const candidateIds = candidates.map((c) => c.userId);
    const photos = await this.prisma.photo.findMany({
      where: {
        userId: { in: candidateIds },
        moderationStatus: 'approved',
      },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        userId: true,
        url: true,
        position: true,
      },
    });

    const photoMap = new Map<string, Array<{ id: string; url: string; position: number }>>();
    for (const ph of photos) {
      const list = photoMap.get(ph.userId) || [];
      list.push({ id: ph.id, url: ph.url, position: ph.position });
      photoMap.set(ph.userId, list);
    }

    return candidates.map((c) => ({
      userId: c.userId,
      displayName: c.displayName,
      age: c.age,
      gender: c.gender,
      bio: c.bio,
      interests: c.interests || [],
      city: c.city,
      distanceKm: Number(c.distanceKm) || 5,
      photos: photoMap.get(c.userId) || [],
    }));
  }
}
