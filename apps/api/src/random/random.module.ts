import { forwardRef, Module } from '@nestjs/common';
import { RandomController } from './random.controller.js';
import { RandomService } from './random.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [AuthModule, forwardRef(() => RealtimeModule)],
  controllers: [RandomController],
  providers: [RandomService],
  exports: [RandomService],
})
export class RandomModule {}
