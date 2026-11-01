import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const port = this.configService.get<number>('SMTP_PORT', 1025);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const webOrigin = this.configService.get<string>('WEB_ORIGIN', 'http://localhost:5173');
    const resetUrl = `${webOrigin}/reset-password?token=${resetToken}`;
    const from = this.configService.get<string>('SMTP_FROM', 'no-reply@meetcall.local');

    try {
      await this.transporter.sendMail({
        from: `"MeetCall" <${from}>`,
        to: email,
        subject: 'Đặt lại mật khẩu MeetCall',
        text: `Chào bạn,\n\nBạn đã yêu cầu đặt lại mật khẩu MeetCall. Vui lòng bấm vào liên kết sau trong vòng 30 phút:\n${resetUrl}\n\nNếu bạn không yêu cầu, vui lòng bỏ qua email này.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #e11d48;">MeetCall</h2>
            <p>Chào bạn,</p>
            <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản MeetCall của mình.</p>
            <p>Vui lòng bấm vào nút bên dưới để tạo mật khẩu mới (liên kết có hiệu lực trong 30 phút):</p>
            <p style="margin: 24px 0;">
              <a href="${resetUrl}" style="background-color: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Đặt lại mật khẩu
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">Nếu bạn không thực hiện yêu cầu này, hãy yên tâm rằng tài khoản của bạn vẫn an toàn và bạn có thể bỏ qua email.</p>
          </div>
        `,
      });
      this.logger.log(`Password reset email sent to: ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}:`, err);
    }
  }
}
