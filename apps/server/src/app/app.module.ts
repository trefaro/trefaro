import { Module } from '@nestjs/common';
import { CURATED_PLUGINS } from '../plugins';
import { AttachmentsModule } from './business/attachments';
import { ChatModule } from './business/chat';
import { ConfigurationModule } from './business/config';
import { DashboardModule } from './business/dashboard';
import { EventSeriesModule } from './business/event-series';
import { EventsModule } from './business/events';
import { InvitationsModule } from './business/invitations';
import { LoginModule } from './business/login';
import { MailModule } from './business/mail';
import { MediaLinksModule } from './business/media-links';
import { ParticipantsModule } from './business/participants/participants.module';
import {
  PluginHostModule,
  PluginManagerModule,
} from './business/plugin-manager';
import { ProfileSearchModule } from './business/profile-search/profile-search.module';
import { ProfilesModule } from './business/profiles/profiles.module';
import { ProgramModule } from './business/program';
import { PushModule } from './business/push';
import { RegistrationModule } from './business/registration';
import { SelfServiceModule } from './business/self-service';
import { CoreModule } from './core/core.module';
import { HealthController } from './core/health/health.controller';
import { DataAccessModule } from './data-access/data-access.module';

/**
 * Composition root.
 *
 * The only place where the three layers meet: it mounts the plug-ins, binds the
 * business layer's repository ports to the data access layer's implementations,
 * and assembles the core modules. Every module below compiles without knowing
 * which database is in use — that knowledge lives in `DataAccessModule` alone.
 *
 * `PluginManagerModule` is listed before `DataAccessModule` because the data
 * source needs the mounted plug-ins' entities and migrations, and
 * `PluginHostModule` before both because it publishes what the mounted plug-ins
 * are allowed to read (E12).
 */
@Module({
  imports: [
    CoreModule,
    // What plug-ins may read from the core (E12), before the plug-ins that read
    // it are mounted. Global, so a plug-in injects a token from `plugin-api`
    // and imports no core module.
    PluginHostModule,
    PluginManagerModule.forPlugins(CURATED_PLUGINS),
    DataAccessModule.forRoot(),

    // Configuration first: it is what both clients fetch before rendering.
    ConfigurationModule,

    // Event management — the survey put it ahead of community features.
    LoginModule,
    EventSeriesModule,
    EventsModule,
    ProgramModule,
    RegistrationModule,
    // Files uploaded with a registration (E9). Listed although three modules
    // already import it, so the composition root stays the place where the
    // module map can be read.
    AttachmentsModule,
    // What a participant may do with their own registration before there is a
    // participant login (E11): sign up for sessions, look at their answers,
    // cancel. Authorized by the signed link, not by a session.
    SelfServiceModule,
    ParticipantsModule,
    // Above the modules it composes: the dashboard asks the registration,
    // programme and series modules for their numbers and owns none of them.
    DashboardModule,
    // Optional (FR 1.5) and the first module that is: switched off, its
    // endpoints answer 404 rather than only vanishing from /api/config (F53).
    MediaLinksModule,
    // Writing to former participants of a series (FR 2.4). Above the modules it
    // composes, like the dashboard: it asks the registration module who may be
    // written to and owns nothing about registrations itself.
    InvitationsModule,
    MailModule,

    // Community features.
    ProfilesModule,
    ProfileSearchModule,
    ChatModule,
    PushModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
