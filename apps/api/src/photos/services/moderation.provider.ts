import { Injectable, Logger } from '@nestjs/common';

export interface ModerationResult {
  approved: boolean;
  confidence?: number;
  reason?: string;
}

export interface ModerationProvider {
  evaluateImage(imageBuffer: Buffer): Promise<ModerationResult>;
}

export const MODERATION_PROVIDER = 'MODERATION_PROVIDER';

@Injectable()
export class MockModerationProvider implements ModerationProvider {
  private readonly logger = new Logger(MockModerationProvider.name);

  async evaluateImage(_imageBuffer: Buffer): Promise<ModerationResult> {
    this.logger.log('Evaluating image using MockModerationProvider -> APPROVED');
    return {
      approved: true,
      confidence: 0.99,
    };
  }
}
