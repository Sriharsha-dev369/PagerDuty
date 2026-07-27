import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  createTestAccount,
  createTransport,
  getTestMessageUrl,
  type Transporter,
} from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl?: string;
}

/**
 * Queue-free email sender. Tries an Ethereal test SMTP account (real send,
 * viewable via a preview URL, zero setup); if that can't be reached (offline /
 * network-blocked), falls back to an in-memory stream transport so the app
 * still runs and the message is logged rather than lost.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: Transporter;
  private usingEthereal = false;

  async onModuleInit(): Promise<void> {
    await this.init();
  }

  private async init(): Promise<void> {
    try {
      const testAccount = await createTestAccount();
      this.transporter = createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      this.usingEthereal = true;
      this.logger.log(`Mailer: using Ethereal test account (${testAccount.user})`);
    } catch (err) {
      this.transporter = createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
      this.usingEthereal = false;
      this.logger.warn(
        `Mailer: Ethereal unavailable, using stream transport — ${(err as Error).message}`,
      );
    }
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.transporter) {
      await this.init();
    }
    const info = await this.transporter!.sendMail({
      from: 'PagerDuty Lite <alerts@pagerduty-lite.local>',
      to: input.to,
      subject: input.subject,
      text: input.text,
    });

    const previewUrl = this.usingEthereal
      ? getTestMessageUrl(info) || undefined
      : undefined;

    if (previewUrl) {
      this.logger.log(`Email → ${input.to} — preview: ${previewUrl}`);
    } else {
      this.logger.log(
        `Email → ${input.to} — "${input.subject}" (stream transport; not delivered)`,
      );
    }

    return { messageId: info.messageId, previewUrl };
  }
}
