import { Module } from '@nestjs/common';
import { EventSeriesModule } from '../event-series';
import { EventsModule } from '../events';
import { MailModule } from '../mail';
import { RegistrationModule } from '../registration';
import { SecurityModule } from '../security';
import { AdminInvitationsController } from './admin-invitations.controller';
import { AdminSeriesInvitationsController } from './admin-series-invitations.controller';
import { InvitationSenderService } from './invitation-sender.service';
import { InvitationsService } from './invitations.service';
import { PublicInvitationOptOutController } from './public-invitation-opt-out.controller';

/**
 * Inviting former participants to the next event (UC 03, FR 2.4) — AP 12.
 *
 * The last of the P1 features, and the only one that writes to people who did
 * not just ask for something. Everything about it follows from that: the
 * audience is drawn from confirmed registrations of the same series (E15), a
 * selection names registrations rather than addresses (F55), every mail carries
 * an objection link the organizer cannot leave out (F58), and an objection
 * silences this instance for that address everywhere (F57).
 *
 * Deliberately *not* an optional core module. FR 1.5 lets an organization switch
 * off what it does not need; this is not a feature beside event management but
 * part of running a series — and a switch would be a switch somebody flips to
 * make the objection endpoint answer 404, which is the one endpoint that must
 * always work. It is also not the newsletter module v1 does not have (F8): there
 * is no list to subscribe to and no address that can be added by hand.
 *
 * Four imports, one rule each: `EventSeriesModule` because an invitation belongs
 * to a series, `EventsModule` because it may invite to one of its events,
 * `RegistrationModule` for {@link ContactsService} — who may be written to, and
 * the only writer of `contact_opt_out` — and `MailModule` for the message and
 * the absolute links in it. `SecurityModule` signs the objection link.
 */
@Module({
  imports: [
    EventSeriesModule,
    EventsModule,
    RegistrationModule,
    MailModule,
    SecurityModule,
  ],
  controllers: [
    AdminSeriesInvitationsController,
    AdminInvitationsController,
    PublicInvitationOptOutController,
  ],
  providers: [InvitationsService, InvitationSenderService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
