import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments';
import { EventsModule } from '../events';
import { MailModule } from '../mail';
import { SecurityModule } from '../security';
import { AdminEventRegistrationFieldsController } from './admin-event-registration-fields.controller';
import { AdminEventRegistrationsController } from './admin-event-registrations.controller';
import { AdminRegistrationFieldsController } from './admin-registration-fields.controller';
import { AdminRegistrationsController } from './admin-registrations.controller';
import { ContactsService } from './contacts.service';
import { ParticipantsService } from './participants.service';
import { PublicRegistrationFieldsController } from './public-registration-fields.controller';
import { PublicRegistrationsController } from './public-registrations.controller';
import { RegistrationConfirmationController } from './registration-confirmation.controller';
import { RegistrationFieldsService } from './registration-fields.service';
import { RegistrationService } from './registration.service';

/**
 * Event registration with double opt-in (UC 07, FR 3.5).
 *
 * The second highest rated function of the survey (3,69). Imports the events
 * module because who may register follows from who may see the event, the mail
 * module for the two messages of the opt-in, and the security module for the
 * signature that makes the confirmation link self-contained (E5).
 *
 * Two services read the same table from opposite ends: `RegistrationService` is
 * the participant's own double opt-in flow, public and deliberately taciturn
 * (E10); `ParticipantsService` is the organizer's overview (FR 3.3), behind the
 * administrative guard and complete. A third, `RegistrationFieldsService`, owns
 * the configurable form (F12) — both the definitions an organizer manages and
 * the validation of the answers, because the definition *is* the rule.
 *
 * Imports `AttachmentsModule` for the file upload field type (E9): the bytes
 * live next to the registration rather than in it, and this module is what puts
 * them there and what takes them away again.
 *
 * The participant's own view of their registration lives in
 * `business/self-service` (E11) and reuses two of the services above: it is a
 * seam between a signed link and these rules, not a second set of them.
 *
 * `ContactsService` is the fourth, added in AP 12: the same table read across a
 * *series* and folded by address, plus the one place `contact_opt_out` is
 * written (E15). The invitations module asks it who may be written to; it never
 * composes or sends anything itself.
 */
@Module({
  imports: [EventsModule, MailModule, SecurityModule, AttachmentsModule],
  controllers: [
    PublicRegistrationsController,
    PublicRegistrationFieldsController,
    RegistrationConfirmationController,
    AdminRegistrationsController,
    AdminEventRegistrationsController,
    AdminRegistrationFieldsController,
    AdminEventRegistrationFieldsController,
  ],
  providers: [
    RegistrationService,
    ParticipantsService,
    RegistrationFieldsService,
    ContactsService,
  ],
  exports: [
    RegistrationService,
    ParticipantsService,
    RegistrationFieldsService,
    ContactsService,
  ],
})
export class RegistrationModule {}
