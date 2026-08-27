import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import type { Mailer, OutgoingMail } from './ports/mailer';

/**
 * Delivery through the organization's own SMTP server (F8).
 *
 * Never a third-party sending service: the recipients of these mails are people
 * who registered for a political event, and handing that list to a provider
 * would undo the reason this application is self-hosted at all (NFR 9).
 *
 * The transport is created on first use rather than at startup. A mail server
 * that is briefly unreachable must not keep the instance from booting — the
 * public event pages have nothing to do with mail, and they should stay up.
 */
@Injectable()
export class SmtpMailer implements Mailer {
  private readonly logger = new Logger(SmtpMailer.name);
  private transport: Transporter | null = null;

  constructor(@Inject(ENV) private readonly env: TrefaroEnv) {}

  async send(mail: OutgoingMail): Promise<void> {
    const info = await this.transporter().sendMail({
      from: this.env.smtp.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    // The message id, not the recipient: a log file is read by more people than
    // the participant list is, and it has no business holding addresses.
    this.logger.debug(`Handed over to SMTP: ${info.messageId}`);
  }

  private transporter(): Transporter {
    const { host, port, secure, user, password } = this.env.smtp;
    this.transport ??= createTransport({
      host,
      port,
      secure,
      // Anonymous submission is normal for a mail server on the same host or in
      // the same compose network, which is how a small organization runs this.
      auth: user && password ? { user, pass: password } : undefined,
    });
    return this.transport;
  }
}
