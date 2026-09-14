import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import {
  TemporaryMailFailure,
  type Mailer,
  type OutgoingMail,
} from './ports/mailer';

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
 *
 * **There is no option here that weakens TLS, and there never will be** (E62).
 * A mail server with a certificate of its own — a test server, an internal one,
 * one behind a private CA — is trusted by naming its certificate in
 * `NODE_EXTRA_CA_CERTS`, which is a decision of the deployment and visible in
 * it. `rejectUnauthorized: false` would be the same decision taken invisibly,
 * for every server, forever; `smtp-mailer.spec.ts` fails if anybody adds it.
 */
@Injectable()
export class SmtpMailer implements Mailer {
  private readonly logger = new Logger(SmtpMailer.name);
  private transport: Transporter | null = null;

  constructor(@Inject(ENV) private readonly env: TrefaroEnv) {}

  async send(mail: OutgoingMail): Promise<void> {
    let info;
    try {
      info = await this.transporter().sendMail({
        from: this.env.smtp.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: mail.headers,
      });
    } catch (error: unknown) {
      throw temporaryRejection(error) ? new TemporaryMailFailure(error) : error;
    }

    // The message id, not the recipient: a log file is read by more people than
    // the participant list is, and it has no business holding addresses.
    this.logger.debug(`Handed over to SMTP: ${info.messageId}`);
  }

  private transporter(): Transporter {
    const { host, port, secure, requireTls, user, password } = this.env.smtp;
    this.transport ??= createTransport({
      host,
      port,
      secure,
      // The difference between "encrypt if you feel like it" and "encrypt":
      // submission on 587 starts in the clear and upgrades, and an upgrade
      // nobody insists on is one a network can strip out silently (E62).
      // Ignored by nodemailer when `secure` is on — there is nothing to
      // upgrade from.
      requireTLS: requireTls,
      // Anonymous submission is normal for a mail server on the same host or in
      // the same compose network, which is how a small organization runs this.
      auth: user && password ? { user, pass: password } : undefined,
    });
    return this.transport;
  }
}

/**
 * Whether the mail server answered "not now".
 *
 * A 4xx reply and nothing else. Deliberately **not** a failed connection: a
 * mail server that is down refuses two hundred recipients in a row, and
 * treating each of them as worth a second attempt would turn one outage into
 * twice the work and twice the wait — while the invitation sender already
 * leaves those rows pending and picks them up on the next boot.
 */
function temporaryRejection(error: unknown): boolean {
  const code: unknown =
    typeof error === 'object' && error !== null
      ? (error as { responseCode?: unknown }).responseCode
      : undefined;
  return typeof code === 'number' && code >= 400 && code < 500;
}
