import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from './storage.service.js';
import {
  MODERATION_PROVIDER,
  type ModerationProvider,
} from './moderation.provider.js';

export interface PhotoJobData {
  photoId: string;
  key: string;
  userId: string;
}

@Injectable()
export class PhotoProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PhotoProcessorService.name);
  private queue!: Queue<PhotoJobData>;
  private worker!: Worker<PhotoJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    @Inject(MODERATION_PROVIDER)
    private readonly moderationProvider: ModerationProvider,
  ) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    const connection = {
      host,
      port,
      password: password || undefined,
    };

    this.queue = new Queue<PhotoJobData>('photo-processing', { connection });

    this.worker = new Worker<PhotoJobData>(
      'photo-processing',
      async (job: Job<PhotoJobData>) => {
        await this.processPhotoJob(job.data);
      },
      { connection, concurrency: 4 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Photo job ${job?.id} failed:`, err);
    });

    this.logger.log('PhotoProcessorService initialized with BullMQ worker.');
  }

  async addPhotoJob(data: PhotoJobData): Promise<void> {
    await this.queue.add('process', data);
  }

  async processPhotoJob(data: PhotoJobData): Promise<void> {
    const { photoId, key } = data;
    this.logger.log(`Processing photo ${photoId} from key: ${key}`);

    try {
      const rawBuffer = await this.storageService.downloadBuffer(key);

      // 1. Resize & Strip EXIF (sharp by default removes all EXIF and GPS tags unless withMetadata() is called)
      const processedBuffer = await sharp(rawBuffer)
        .rotate() // auto-orient based on EXIF before stripping
        .resize(1600, 1600, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // 2. Moderation check
      const moderation = await this.moderationProvider.evaluateImage(processedBuffer);

      // 3. Save processed buffer back
      const processedKey = key.replace(/\.[^.]+$/, '_processed.jpg');
      const publicUrl = await this.storageService.saveBuffer(
        processedKey,
        processedBuffer,
        'image/jpeg',
      );

      // 4. Update photo in DB
      await this.prisma.photo.update({
        where: { id: photoId },
        data: {
          url: publicUrl,
          moderationStatus: moderation.approved ? 'approved' : 'rejected',
        },
      });

      this.logger.log(`Photo ${photoId} processed successfully: status=${moderation.approved ? 'approved' : 'rejected'}`);
    } catch (error) {
      this.logger.error(`Failed to process photo ${photoId}:`, error);
      await this.prisma.photo.update({
        where: { id: photoId },
        data: { moderationStatus: 'rejected' },
      });
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}
