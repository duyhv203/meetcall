import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type { HealthResponse } from '@meetcall/shared';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
