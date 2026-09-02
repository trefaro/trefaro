import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { EventsModule } from '../events';
import { ProgramModule } from '../program';
import { RegistrationModule } from '../registration';
import { SecurityModule } from '../security';
import { MyRegistrationController } from './my-registration.controller';
import { ParticipantRegistrationsController } from './participant-registrations.controller';
import { ProgramSignupController } from './program-signup.controller';
import { SelfServiceService } from './self-service.service';

/**
 * Participant self-service, with a link or with an account (E11, FR 4.7).
 *
 * Composed of other modules' rules rather than holding its own: the programme
 * decides what a seat costs, the events module decides what may be shown, and
 * the signer decides whether a link speaks for a registration at all. What this
 * module contributes is the seam — the one place that turns a token into a
 * registration.
 *
 * Since AP 4 of phase 3 it carries both ways in: the token controllers under
 * `user/` that phase 1 shipped, and the session controller under
 * `participant/`. They share the service, the rules and the answers; what
 * differs is who may claim a registration. The links already in people's
 * inboxes keep working, which is what E11 promised.
 */
@Module({
  imports: [
    RegistrationModule,
    ProgramModule,
    EventsModule,
    SecurityModule,
    // For the module switch the participant routes hang on (F53): an instance
    // without accounts answers 404 there rather than 401.
    ConfigurationModule,
  ],
  controllers: [
    MyRegistrationController,
    ProgramSignupController,
    ParticipantRegistrationsController,
  ],
  providers: [SelfServiceService],
})
export class SelfServiceModule {}
