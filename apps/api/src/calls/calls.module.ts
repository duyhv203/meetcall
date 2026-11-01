import { forwardRef, Module } from '@nestjs/common';
import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [AuthModule, forwardRef(() => RealtimeModule)],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
