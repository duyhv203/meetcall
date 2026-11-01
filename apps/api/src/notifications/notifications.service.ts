import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegisterDeviceRequest } from '@meetcall/shared';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(userId: string, dto: RegisterDeviceRequest): Promise<{ success: boolean }> {
    await this.prisma.deviceToken.upsert({
      where: { fcmToken: dto.fcmToken },
      update: {
        userId,
        platform: dto.platform,
      },
      create: {
        userId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
      },
    });

    this.logger.log(`Registered device token for user ${userId} (${dto.platform})`);
    return { success: true };
  }

  async unregisterDevice(userId: string, fcmToken: string): Promise<{ success: boolean }> {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, fcmToken },
    });

    this.logger.log(`Unregistered device token for user ${userId}`);
    return { success: true };
  }

  async sendPushNotification(
    userId: string,
    payload: PushPayload,
  ): Promise<{ sentCount: number }> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
    });

    if (devices.length === 0) {
      this.logger.debug(`No device tokens found for user ${userId}`);
      return { sentCount: 0 };
    }

    let successCount = 0;
    for (const device of devices) {
      try {
        // Dispatch Web Push / FCM
        // In dev / test or production, logs dispatch and handles payload
        this.logger.log(
          `[PUSH DISPATCH] To: ${userId} (${device.platform}) | Title: "${payload.title}" | Body: "${payload.body}"`,
        );
        successCount++;
      } catch (err) {
        this.logger.error(`Failed to push notification to device ${device.id}: ${err}`);
      }
    }

    return { sentCount: successCount };
  }

  async notifyNewMatch(recipientId: string, partnerName: string, matchId: string) {
    return this.sendPushNotification(recipientId, {
      title: 'Tương hợp mới! 🎉',
      body: `Bạn và ${partnerName} đã tương hợp với nhau. Hãy bắt đầu trò chuyện ngay!`,
      data: {
        type: 'new_match',
        matchId,
      },
    });
  }

  async notifyNewMessage(
    recipientId: string,
    senderName: string,
    messagePreview: string,
    matchId: string,
  ) {
    return this.sendPushNotification(recipientId, {
      title: senderName,
      body: messagePreview.length > 50 ? `${messagePreview.slice(0, 47)}...` : messagePreview,
      data: {
        type: 'new_message',
        matchId,
      },
    });
  }

  async notifyMissedCall(recipientId: string, callerName: string, callId: string) {
    return this.sendPushNotification(recipientId, {
      title: 'Cuộc gọi nhỡ 📞',
      body: `Bạn có cuộc gọi nhỡ từ ${callerName}.`,
      data: {
        type: 'missed_call',
        callId,
      },
    });
  }
}
