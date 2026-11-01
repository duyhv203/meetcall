import { PrismaClient } from '@prisma/client';

describe('Database Constraints: 18+ Verification', () => {
  let prisma: PrismaClient;
  const testAdultId = '11111111-1111-1111-1111-111111111111';
  const testMinorId = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    // Clean up if already exists
    await prisma.user.deleteMany({
      where: {
        id: { in: [testAdultId, testMinorId] },
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        id: { in: [testAdultId, testMinorId] },
      },
    });
    await prisma.$disconnect();
  });

  it('should successfully create a profile when birthdate is at least 18 years old', async () => {
    const adultBirthdate = new Date();
    adultBirthdate.setFullYear(adultBirthdate.getFullYear() - 20);

    const user = await prisma.user.create({
      data: {
        id: testAdultId,
        email: 'adult-test@meetcall.local',
        passwordHash: 'dummy_hash',
        profile: {
          create: {
            displayName: 'Adult User',
            birthdate: adultBirthdate,
            gender: 'female',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    expect(user).toBeDefined();
    expect(user.profile?.displayName).toBe('Adult User');
  });

  it('should reject creating a profile when birthdate is under 18 years old', async () => {
    const minorBirthdate = new Date();
    minorBirthdate.setFullYear(minorBirthdate.getFullYear() - 16); // 16 years old

    await expect(
      prisma.user.create({
        data: {
          id: testMinorId,
          email: 'minor-test@meetcall.local',
          passwordHash: 'dummy_hash',
          profile: {
            create: {
              displayName: 'Minor User',
              birthdate: minorBirthdate,
              gender: 'male',
            },
          },
        },
      }),
    ).rejects.toThrow();
  });
});
