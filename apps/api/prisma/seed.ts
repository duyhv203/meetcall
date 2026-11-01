import { PrismaClient, UserRole, UserStatus, PhotoModerationStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting seed...');

  const passwordHash = await argon2.hash('Password123!', {
    type: argon2.argon2id,
  });

  const sampleUsers = [
    {
      email: 'alex@meetcall.local',
      displayName: 'Alex Rivers',
      gender: 'male',
      birthdate: new Date('1998-05-15'), // 28 years old
      bio: 'Loves hiking, coding in TypeScript, and indie music.',
      city: 'Hà Nội',
      lat: 21.0285,
      lng: 105.8542,
      genderFilter: ['female'],
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
          position: 0,
        },
      ],
    },
    {
      email: 'linh@meetcall.local',
      displayName: 'Linh Trần',
      gender: 'female',
      birthdate: new Date('2001-11-20'), // 24 years old
      bio: 'Coffee enthusiast, book lover, and UX designer.',
      city: 'Hà Nội',
      lat: 21.0333,
      lng: 105.8433,
      genderFilter: ['male'],
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
          position: 0,
        },
      ],
    },
    {
      email: 'minh@meetcall.local',
      displayName: 'Minh Hoàng',
      gender: 'male',
      birthdate: new Date('1995-03-10'), // 31 years old
      bio: 'Photographer & traveler. Always looking for new adventures.',
      city: 'Đà Nẵng',
      lat: 16.0544,
      lng: 108.2022,
      genderFilter: ['female', 'other'],
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
          position: 0,
        },
      ],
    },
    {
      email: 'mai@meetcall.local',
      displayName: 'Mai Anh',
      gender: 'female',
      birthdate: new Date('2003-08-25'), // 22 years old
      bio: 'Cat lover, foodie, and future veterinarian.',
      city: 'TP Hồ Chí Minh',
      lat: 10.7769,
      lng: 106.7009,
      genderFilter: ['male'],
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
          position: 0,
        },
      ],
    },
    {
      email: 'admin@meetcall.local',
      displayName: 'MeetCall Admin',
      gender: 'other',
      birthdate: new Date('1990-01-01'), // 36 years old
      bio: 'Platform safety and community administrator.',
      city: 'Hà Nội',
      lat: 21.0285,
      lng: 105.8542,
      genderFilter: ['male', 'female', 'other'],
      role: UserRole.admin,
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=800&q=80',
          position: 0,
        },
      ],
    },
  ];

  for (const item of sampleUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: item.email },
    });

    if (existing) {
      console.log(`⏩ Skipping existing user: ${item.email}`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: item.email,
        passwordHash,
        role: item.role ?? UserRole.user,
        status: UserStatus.active,
        ageVerified: true,
        profile: {
          create: {
            displayName: item.displayName,
            birthdate: item.birthdate,
            gender: item.gender,
            bio: item.bio,
            city: item.city,
          },
        },
        preferences: {
          create: {
            genderFilter: item.genderFilter,
            minAge: 18,
            maxAge: 45,
            maxDistanceKm: 100,
          },
        },
        photos: {
          create: item.photos.map((photo) => ({
            url: photo.url,
            position: photo.position,
            moderationStatus: PhotoModerationStatus.approved,
          })),
        },
      },
    });

    // Update location with PostGIS ST_SetSRID ST_MakePoint(lng, lat)
    await prisma.$executeRawUnsafe(
      `UPDATE "profiles" SET "location" = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE "user_id" = $3::uuid`,
      item.lng,
      item.lat,
      user.id,
    );

    console.log(`✅ Created seed user: ${item.displayName} (${item.email})`);
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
