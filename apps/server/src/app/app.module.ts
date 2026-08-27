import { Module } from '@nestjs/common';
import { CURATED_PLUGINS } from '../plugins';
import { AttachmentsModule } from './business/attachments';
import { ChatModule } from './business/chat';
import { ConfigurationModule } from './business/config';
import { EventSeriesModule } from './business/event-series';
import { EventsModule } from './business/events';
import { LoginModule } from './business/login';
import { MailModule } from './business/mail';
import { MediaLinksModule } from './business/media-links/media-links.module';
import { ParticipantsModule } from './business/participants/participants.module';
import { PluginManagerModule } from './business/plugin-manager';
import { ProfileSearchModule } from './business/profile-search/profile-search.module';
import { ProfilesModule } from './business/profiles/profiles.module';
import { ProgramModule } from './business/program/program.module';
import { PushModule } from './business/push';
import { RegistrationModule } from './business/registration';
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
 * source needs the mounted plug-ins' entities and migrations.
 */
@Module({
  imports: [
    CoreModule,
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
    ParticipantsModule,
    MediaLinksModule,
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
