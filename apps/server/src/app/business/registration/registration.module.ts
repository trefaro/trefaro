import { Module } from '@nestjs/common';
import { EventsModule } from '../events';
import { MailModule } from '../mail';
import { SecurityModule } from '../security';
import { AdminRegistrationsController } from './admin-registrations.controller';
import { PublicRegistrationsController } from './public-registrations.controller';
import { RegistrationConfirmationController } from './registration-confirmation.controller';
import { RegistrationService } from './registration.service';

/**
 * Event registration with double opt-in (UC 07, FR 3.5).
 *
 * The second highest rated function of the survey (3,69). Imports the events
 * module because who may register follows from who may see the event, the mail
 * module for the two messages of the opt-in, and the security module for the
 * signature that makes the confirmation link self-contained (E5).
 *
 * Still to come: the configurable field kit (AP 6, AP 7), the participant
 * overview built on these rows (AP 5) and the participant's own view of their
 * registration (AP 9, E11).
 */
@Module({
  imports: [EventsModule, MailModule, SecurityModule],
  controllers: [
    PublicRegistrationsController,
    RegistrationConfirmationController,
    AdminRegistrationsController,
  ],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
