import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MAILER } from './ports/mailer';
import { SmtpMailer } from './smtp-mailer';

/**
 * Outgoing e-mail through the organization's own SMTP server (F8).
 *
 * Multilingual templates in `templates/`, one file per language, and the SMTP
 * transport bound to the {@link MAILER} port so tests — and a later transport,
 * should an organization need one — replace it in one place.
 *
 * Still to come: the reply to an interested person without an account (F11,
 * phase 1 AP 12) and the invitation of former participants (FR 2.4). No
 * newsletter sending in v1, only opt-in management (F8).
 */
@Module({
  providers: [
    MailService,
    SmtpMailer,
    { provide: MAILER, useExisting: SmtpMailer },
  ],
  exports: [MailService],
})
export class MailModule {}
