import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { I18nModule } from '../i18n';
import { MailCatalogue } from './mail-catalogue.service';
import { MailService } from './mail.service';
import { MAILER } from './ports/mailer';
import { PublicLinks } from './public-links.service';
import { SmtpMailer } from './smtp-mailer';

/**
 * Outgoing e-mail through the organization's own SMTP server (F8).
 *
 * Three parts, in the order a message passes through them: {@link MailCatalogue}
 * decides which language it can be written in and fetches the words,
 * `templates/` puts them together, and the SMTP transport bound to the
 * {@link MAILER} port hands it over — so tests, and a later transport should an
 * organization need one, replace the last of the three in one place.
 *
 * Imports {@link I18nModule} since AP 10 of phase 2: the mail text lives in the
 * catalogue an organization maintains (E22), not in this module. The dependency
 * runs one way — the catalogue knows nothing about mail — and it does not close
 * a circle through {@link ConfigurationModule}, which knows about neither.
 *
 * Since AP 12 of phase 1 this module also carries {@link PublicLinks}: the
 * absolute addresses into the participant client that every message needs, built
 * from one configured origin instead of in each sending module.
 *
 * Still to come: the reply to an interested person without an account (F11).
 * There is no newsletter sending in v1 and there will not be one — inviting
 * former participants (FR 2.4) writes to addresses that registered for an event
 * of the same series and confirmed, which is a different thing (F8, E15).
 */
@Module({
  imports: [ConfigurationModule, I18nModule],
  providers: [
    MailCatalogue,
    MailService,
    PublicLinks,
    SmtpMailer,
    { provide: MAILER, useExisting: SmtpMailer },
  ],
  exports: [MailCatalogue, MailService, PublicLinks],
})
export class MailModule {}
