import { Module } from '@nestjs/common';
import { PhotosService } from './photos.service.js';
import { StorageService } from './services/storage.service.js';
import { PhotoProcessorService } from './services/photo-processor.service.js';
import {
  MODERATION_PROVIDER,
  MockModerationProvider,
} from './services/moderation.provider.js';
import { StorageController } from './storage.controller.js';

@Module({
  controllers: [StorageController],
  providers: [
    StorageService,
    PhotoProcessorService,
    {
      provide: MODERATION_PROVIDER,
      useClass: MockModerationProvider,
    },
    PhotosService,
  ],
  exports: [PhotosService, StorageService],
})
export class PhotosModule {}
