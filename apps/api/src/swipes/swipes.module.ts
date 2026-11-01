import { Module } from '@nestjs/common';
import { SwipesController } from './swipes.controller.js';
import { SwipesService } from './swipes.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [SwipesController],
  providers: [SwipesService],
  exports: [SwipesService],
})
export class SwipesModule {}
