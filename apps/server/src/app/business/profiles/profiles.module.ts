import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from '../common/common.module';
import { ConfigurationModule } from '../config';
import { MailModule } from '../mail';
import { SecurityModule } from '../security';
import { ParticipantAuthController } from './participant-auth.controller';
import { ParticipantMeController } from './participant-me.controller';
import { ParticipantGuard } from './participant.guard';
import { ProfilesService } from './profiles.service';
import { PublicProfilesController } from './public-profiles.controller';
import { UserSessionService } from './user-session.service';

/**
 * Participant accounts, login and profiles (UC 09, FR 4.1–4.3).
 *
 * Registers {@link ParticipantGuard} globally rather than per controller, for
 * the same reason `LoginModule` does it for the administrative one: everything
 * under `/api/participant` needs a session, plug-in controllers included, and a
 * forgotten decorator would be an open endpoint (E16, E33). Deny by default,
 * with `@AllowAnonymous()` as the visible exception.
 *
 * An optional core module (FR 1.5, F63): an organization that only runs events
 * switches `profiles` off, and then its endpoints answer 404 rather than merely
 * vanishing from `/api/config`. `ConfigurationModule` for that guard — and for
 * the instance's default language, which a registration form need not send.
 *
 * `CommonModule` for the password hasher, `SecurityModule` for the signed
 * confirmation token, `MailModule` for the two account mails. What is *not*
 * imported is `RegistrationModule`: an account and a registration are joined by
 * the address and nothing else (E31), and asking one module about the other
 * would be the first step towards a foreign key nobody wants.
 */
@Module({
  imports: [CommonModule, ConfigurationModule, MailModule, SecurityModule],
  controllers: [
    PublicProfilesController,
    ParticipantAuthController,
    ParticipantMeController,
  ],
  providers: [
    ProfilesService,
    UserSessionService,
    { provide: APP_GUARD, useClass: ParticipantGuard },
  ],
  exports: [ProfilesService, UserSessionService],
})
export class ProfilesModule {}
