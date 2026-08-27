import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MAILER } from './ports/mailer';
import { PublicLinks } from './public-links.service';
import { SmtpMailer } from './smtp-mailer';

/**
 * Outgoing e-mail through the organization's own SMTP server (F8).
 *
 * Multilingual templates in `templates/`, one file per language, and the SMTP
 * transport bound to the {@link MAILER} port so tests — and a later transport,
 * should an organization need one — replace it in one place.
 *
 * Since AP 12 this module also carries {@link PublicLinks}: the absolute
 * addresses into the participant client that every message needs, built from
 * one configured origin instead of in each sending module.
 *
 * Still to come: the reply to an interested person without an account (F11).
 * There is no newsletter sending in v1 and there will not be one — inviting
 * former participants (FR 2.4) writes to addresses that registered for an event
 * of the same series and confirmed, which is a different thing (F8, E15).
 */
@Module({
  providers: [
    MailService,
    PublicLinks,
    SmtpMailer,
    { provide: MAILER, useExisting: SmtpMailer },
  ],
  exports: [MailService, PublicLinks],
})
export class MailModule {}
