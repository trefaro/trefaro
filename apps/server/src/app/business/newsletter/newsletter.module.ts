import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { EventSeriesModule } from '../event-series';
import { MailModule } from '../mail';
import { SecurityModule } from '../security';
import { AdminNewsletterController } from './admin-newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { PublicNewsletterController } from './public-newsletter.controller';

/**
 * The newsletter opt-in administration (FR 4.8, E45).
 *
 * Four imports, and none of them is a dispatch: there is no newsletter module
 * in v1 and this is not one (F8).
 *
 * - `ConfigurationModule` for the guard that makes a switched-off module answer
 *   404 (F53). Unlike the push module, nothing here reads the flag from the
 *   inside — every path into this module starts with a request, so the guard is
 *   the whole of it (E21).
 * - `MailModule` for the ninth mail, the double opt-in of a sign-up (E45).
 * - `SecurityModule` for the token in it, which is signed and stored nowhere
 *   like every other confirmation token in this application (F180).
 * - `EventSeriesModule` for the two questions this module asks about series:
 *   which one a slug means when somebody signs up from a series' page, and what
 *   a page of consents is called in the reader's language.
 *
 * Deliberately **not** `ProfilesModule`. A sign-up needs no account and reads
 * no session, not even optionally: an address is an address, and somebody who
 * happens to be logged in has said nothing different by typing theirs.
 */
@Module({
  imports: [ConfigurationModule, MailModule, SecurityModule, EventSeriesModule],
  controllers: [PublicNewsletterController, AdminNewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
