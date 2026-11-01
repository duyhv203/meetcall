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
  private queue?: Queue<PhotoJobData>;
  private worker?: Worker<PhotoJobData>;
  private isAsyncQueueEnabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    @Inject(MODERATION_PROVIDER)
    private readonly moderationProvider: ModerationProvider,
  ) {}

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
    const hasExternalRedis = Boolean(
      redisUrl || (!isLocalhost && host !== 'memory' && host !== 'in-memory'),
    );

    // In production without external Redis, or when memory store is used, process directly in-process
    if (host === 'memory' || host === 'in-memory' || (isProduction && !hasExternalRedis)) {
      this.logger.log(
        'PhotoProcessorService initialized with Direct Background Processing (in-process).',
      );
      this.isAsyncQueueEnabled = false;
      return;
    }

    try {
      const connection = redisUrl
        ? { url: redisUrl }
        : {
            host,
            port,
            password: password || undefined,
            maxRetriesPerRequest: null,
          };

      this.queue = new Queue<PhotoJobData>('photo-processing', {
        connection: connection as any,
      });

      this.worker = new Worker<PhotoJobData>(
        'photo-processing',
        async (job: Job<PhotoJobData>) => {
          await this.processPhotoJob(job.data);
        },
        { connection: connection as any, concurrency: 4 },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Photo job ${job?.id} failed:`, err);
      });

      this.isAsyncQueueEnabled = true;
      this.logger.log('PhotoProcessorService initialized with BullMQ worker.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not initialize BullMQ worker (${msg}). Using direct background processing.`,
      );
      this.isAsyncQueueEnabled = false;
    }
  }

  async addPhotoJob(data: PhotoJobData): Promise<void> {
    if (this.isAsyncQueueEnabled && this.queue) {
      await this.queue.add('process', data);
    } else {
      setImmediate(() => {
        void this.processPhotoJob(data);
      });
    }
  }

  async processPhotoJob(data: PhotoJobData): Promise<void> {
    const { photoId, key } = data;
    this.logger.log(`Processing photo ${photoId} from key: ${key}`);

    try {
      const rawBuffer = await this.storageService.downloadBuffer(key);

      // 1. Resize & Strip EXIF
      const processedBuffer = await sharp(rawBuffer)
        .rotate()
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

      this.logger.log(
        `Photo ${photoId} processed successfully: status=${moderation.approved ? 'approved' : 'rejected'}`,
      );
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
