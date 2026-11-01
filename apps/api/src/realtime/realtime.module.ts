import { forwardRef, Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway.js';
import { ChatModule } from '../chat/chat.module.js';
import { CallsModule } from '../calls/calls.module.js';
import { RandomModule } from '../random/random.module.js';

@Global()
@Module({
  imports: [
    JwtModule,
    forwardRef(() => ChatModule),
    forwardRef(() => CallsModule),
    forwardRef(() => RandomModule),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
