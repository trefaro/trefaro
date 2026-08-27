import { Module } from '@nestjs/common';
import { EventsModule } from '../events';
import { MailModule } from '../mail';
import { SecurityModule } from '../security';
import { AdminEventRegistrationFieldsController } from './admin-event-registration-fields.controller';
import { AdminEventRegistrationsController } from './admin-event-registrations.controller';
import { AdminRegistrationFieldsController } from './admin-registration-fields.controller';
import { AdminRegistrationsController } from './admin-registrations.controller';
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
 * Still to come: the file upload field type (AP 7) and the participant's own
 * view of their registration (AP 9, E11).
 */
@Module({
  imports: [EventsModule, MailModule, SecurityModule],
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
  ],
  exports: [
    RegistrationService,
    ParticipantsService,
    RegistrationFieldsService,
  ],
})
export class RegistrationModule {}
