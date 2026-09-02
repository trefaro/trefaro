import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from '../common/common.module';
import { ConfigurationModule } from '../config';
import { MailModule } from '../mail';
import { SecurityModule } from '../security';
import { AdminProfileFieldsController } from './admin-profile-fields.controller';
import { ParticipantAuthController } from './participant-auth.controller';
import { ParticipantMeController } from './participant-me.controller';
import { ParticipantProfileFieldsController } from './participant-profile-fields.controller';
import { ParticipantGuard } from './participant.guard';
import { ProfileAvatarMediaController } from './profile-avatar-media.controller';
import { ProfileFieldsService } from './profile-fields.service';
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
 * `CommonModule` for the password hasher and the stored-image service,
 * `SecurityModule` for the signed confirmation token, `MailModule` for the two
 * account mails. What is *not* imported is `RegistrationModule`: an account and
 * a registration are joined by the address and nothing else (E31), and asking
 * one module about the other would be the first step towards a foreign key
 * nobody wants. Not `LogoFilesModule` either — what the avatar shares with a
 * row logo is `ImageFileService`, and that is in `business/common/`.
 */
@Module({
  imports: [CommonModule, ConfigurationModule, MailModule, SecurityModule],
  controllers: [
    PublicProfilesController,
    ParticipantAuthController,
    ParticipantMeController,
    ParticipantProfileFieldsController,
    AdminProfileFieldsController,
    ProfileAvatarMediaController,
  ],
  providers: [
    ProfilesService,
    ProfileFieldsService,
    UserSessionService,
    { provide: APP_GUARD, useClass: ParticipantGuard },
  ],
  exports: [ProfilesService, ProfileFieldsService, UserSessionService],
})
export class ProfilesModule {}
