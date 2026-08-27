import { Module } from '@nestjs/common';
import { EventsModule } from '../events';
import { ProgramModule } from '../program';
import { RegistrationModule } from '../registration';
import { SecurityModule } from '../security';
import { MyRegistrationController } from './my-registration.controller';
import { ProgramSignupController } from './program-signup.controller';
import { SelfServiceService } from './self-service.service';

/**
 * Participant self-service without an account (E11).
 *
 * Composed of other modules' rules rather than holding its own: the programme
 * decides what a seat costs, the events module decides what may be shown, and
 * the signer decides whether a link speaks for a registration at all. What this
 * module contributes is the seam — the one place that turns a token into a
 * registration.
 *
 * It sits between phase 1 and phase 3 by design. When the participant login
 * arrives (FR 4.1, P2), it resolves the registration instead of the token and
 * everything below stays where it is; the links already in people's inboxes keep
 * working, which is what E11 promised.
 */
@Module({
  imports: [RegistrationModule, ProgramModule, EventsModule, SecurityModule],
  controllers: [MyRegistrationController, ProgramSignupController],
  providers: [SelfServiceService],
})
export class SelfServiceModule {}
