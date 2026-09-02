import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ATTACHMENT_REPOSITORY } from '../business/attachments/ports/attachment.repository';
import { FILE_STORE } from '../business/attachments/ports/file-store';
import { CONVERSATION_REPOSITORY } from '../business/chat/ports/conversation.repository';
import { MESSAGE_REPOSITORY } from '../business/chat/ports/message.repository';
import { PROFILE_DIRECTORY } from '../business/common/ports/profile-directory.port';
import { APP_CONFIG_REPOSITORY } from '../business/config/ports/app-config.repository';
import { EVENT_SERIES_TRANSLATION_REPOSITORY } from '../business/event-series/ports/event-series-translation.repository';
import { EVENT_SERIES_REPOSITORY } from '../business/event-series/ports/event-series.repository';
import { EVENT_TRANSLATION_REPOSITORY } from '../business/events/ports/event-translation.repository';
import { EVENT_REPOSITORY } from '../business/events/ports/event.repository';
import { SHIPPED_CATALOGUE_READER } from '../business/i18n/ports/shipped-catalogue.reader';
import { TRANSLATION_OVERRIDE_REPOSITORY } from '../business/i18n/ports/translation-override.repository';
import { ADMIN_SESSION_REPOSITORY } from '../business/login/ports/admin-session.repository';
import { INVITATION_REPOSITORY } from '../business/invitations/ports/invitation.repository';
import { ADMIN_USER_REPOSITORY } from '../business/login/ports/admin-user.repository';
import { MEDIA_LINK_TALLY } from '../business/media-links/ports/media-link-tally';
import { MEDIA_LINK_REPOSITORY } from '../business/media-links/ports/media-link.repository';
import { MODULE_CONFIG_REPOSITORY } from '../business/config/ports/module-config.repository';
import { SEARCHABLE_PROFILE_REPOSITORY } from '../business/common/ports/searchable-profile.repository';
import { PROFILE_FIELD_REPOSITORY } from '../business/profiles/ports/profile-field.repository';
import { PROGRAM_ITEM_SIGNUP_REPOSITORY } from '../business/program/ports/program-item-signup.repository';
import { PROGRAM_ITEM_TRANSLATION_REPOSITORY } from '../business/program/ports/program-item-translation.repository';
import { PROGRAM_ITEM_REPOSITORY } from '../business/program/ports/program-item.repository';
import { PROGRAM_TALLY } from '../business/program/ports/program-tally';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '../business/push/ports/push-subscription.repository';
import { REGISTRATION_TALLY } from '../business/registration/ports/registration-tally';
import { REGISTRATION_FIELD_REPOSITORY } from '../business/registration/ports/registration-field.repository';
import { REGISTRATION_REPOSITORY } from '../business/registration/ports/registration.repository';
import { USER_PROFILE_REPOSITORY } from '../business/profiles/ports/user-profile.repository';
import { USER_SESSION_REPOSITORY } from '../business/profiles/ports/user-session.repository';
import {
  PLUGIN_PERSISTENCE_REGISTRY,
  type PluginPersistenceContribution,
} from '../business/plugin-api';
import { ENV } from '../core/config/env.module';
import type { TrefaroEnv } from '../core/config/env';
import { buildDataSourceOptions } from './data-source';
import { CORE_ENTITIES } from './entities';
import { collectPluginPersistence } from './plugin-data-access/plugin-persistence.registry';
import { BundledCatalogueReader } from './storage/bundled-catalogue.reader';
import { LocalDiskFileStore } from './storage/local-disk.file-store';
import { TypeormAdminSessionRepository } from './repositories/typeorm-admin-session.repository';
import { TypeormAdminUserRepository } from './repositories/typeorm-admin-user.repository';
import { TypeormAppConfigRepository } from './repositories/typeorm-app-config.repository';
import { TypeormAttachmentRepository } from './repositories/typeorm-attachment.repository';
import { TypeormConversationRepository } from './repositories/typeorm-conversation.repository';
import { TypeormMessageRepository } from './repositories/typeorm-message.repository';
import { TypeormEventSeriesTranslationRepository } from './repositories/typeorm-event-series-translation.repository';
import { TypeormEventSeriesRepository } from './repositories/typeorm-event-series.repository';
import { TypeormEventTranslationRepository } from './repositories/typeorm-event-translation.repository';
import { TypeormEventRepository } from './repositories/typeorm-event.repository';
import { TypeormInvitationRepository } from './repositories/typeorm-invitation.repository';
import { LOGO_PATHS_REPOSITORY } from '../business/logo-files/ports/logo-paths.repository';
import { TypeormLogoPathsRepository } from './repositories/typeorm-logo-paths.repository';
import { TypeormMediaLinkRepository } from './repositories/typeorm-media-link.repository';
import { TypeormModuleConfigRepository } from './repositories/typeorm-module-config.repository';
import { TypeormProfileDirectory } from './repositories/typeorm-profile-directory.repository';
import { TypeormSearchableProfileRepository } from './repositories/typeorm-searchable-profile.repository';
import { TypeormProfileFieldRepository } from './repositories/typeorm-profile-field.repository';
import { TypeormProgramItemSignupRepository } from './repositories/typeorm-program-item-signup.repository';
import { TypeormProgramItemTranslationRepository } from './repositories/typeorm-program-item-translation.repository';
import { TypeormProgramItemRepository } from './repositories/typeorm-program-item.repository';
import { TypeormPushSubscriptionRepository } from './repositories/typeorm-push-subscription.repository';
import { TypeormRegistrationFieldRepository } from './repositories/typeorm-registration-field.repository';
import { TypeormRegistrationRepository } from './repositories/typeorm-registration.repository';
import { TypeormTranslationOverrideRepository } from './repositories/typeorm-translation-override.repository';
import { TypeormUserProfileRepository } from './repositories/typeorm-user-profile.repository';
import { TypeormUserSessionRepository } from './repositories/typeorm-user-session.repository';

/**
 * The data access layer — the only layer that talks to PostgreSQL.
 *
 * It binds each business-layer repository port to a TypeORM implementation.
 * Global, so the business layer can inject a port without importing this module,
 * which is also what avoids a cycle with the plug-in manager: the manager needs
 * the module configuration, and this module needs the manager's list of plug-in
 * entities and migrations.
 */
@Global()
@Module({})
export class DataAccessModule {
  static forRoot(): DynamicModule {
    return {
      module: DataAccessModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ENV, PLUGIN_PERSISTENCE_REGISTRY],
          useFactory: (
            env: TrefaroEnv,
            contributions: readonly PluginPersistenceContribution[],
          ) =>
            buildDataSourceOptions(
              env,
              collectPluginPersistence(contributions),
            ),
        }),
        TypeOrmModule.forFeature(CORE_ENTITIES),
      ],
      providers: [
        TypeormAdminUserRepository,
        TypeormAttachmentRepository,
        TypeormConversationRepository,
        TypeormMessageRepository,
        LocalDiskFileStore,
        TypeormAdminSessionRepository,
        TypeormAppConfigRepository,
        TypeormEventSeriesRepository,
        TypeormEventSeriesTranslationRepository,
        TypeormEventRepository,
        TypeormEventTranslationRepository,
        TypeormInvitationRepository,
        TypeormLogoPathsRepository,
        TypeormMediaLinkRepository,
        TypeormModuleConfigRepository,
        TypeormProfileDirectory,
        TypeormProfileFieldRepository,
        TypeormSearchableProfileRepository,
        TypeormProgramItemRepository,
        TypeormProgramItemTranslationRepository,
        TypeormProgramItemSignupRepository,
        TypeormPushSubscriptionRepository,
        TypeormRegistrationRepository,
        TypeormRegistrationFieldRepository,
        TypeormTranslationOverrideRepository,
        TypeormUserProfileRepository,
        TypeormUserSessionRepository,
        BundledCatalogueReader,
        {
          provide: ADMIN_USER_REPOSITORY,
          useExisting: TypeormAdminUserRepository,
        },
        {
          provide: ADMIN_SESSION_REPOSITORY,
          useExisting: TypeormAdminSessionRepository,
        },
        {
          provide: APP_CONFIG_REPOSITORY,
          useExisting: TypeormAppConfigRepository,
        },
        {
          provide: ATTACHMENT_REPOSITORY,
          useExisting: TypeormAttachmentRepository,
        },
        // The upload volume behind a port, for the same reason the tables are:
        // the business layer knows that a file is kept, not where (E9).
        {
          provide: FILE_STORE,
          useExisting: LocalDiskFileStore,
        },
        // Conversations and their lines (FR 4.5). Two ports rather than one:
        // the overview reads conversations without touching a message, and the
        // history reads messages without needing to know who is in one — and
        // both are scoped to the asking member in SQL (E38, F152).
        {
          provide: CONVERSATION_REPOSITORY,
          useExisting: TypeormConversationRepository,
        },
        {
          provide: MESSAGE_REPOSITORY,
          useExisting: TypeormMessageRepository,
        },
        {
          provide: EVENT_SERIES_REPOSITORY,
          useExisting: TypeormEventSeriesRepository,
        },
        // Content translations sit with the thing they translate (FR 3.12): the
        // service that renders a series reads its own translation port, and the
        // module that writes translations sits above all three parents.
        {
          provide: EVENT_SERIES_TRANSLATION_REPOSITORY,
          useExisting: TypeormEventSeriesTranslationRepository,
        },
        {
          provide: EVENT_REPOSITORY,
          useExisting: TypeormEventRepository,
        },
        {
          provide: EVENT_TRANSLATION_REPOSITORY,
          useExisting: TypeormEventTranslationRepository,
        },
        {
          provide: INVITATION_REPOSITORY,
          useExisting: TypeormInvitationRepository,
        },
        // Two columns of two tables behind one narrow port (FR 2.1, FR 3.1): its
        // only caller is the delete that has to unlink logo files before the
        // cascade takes the rows that name them (E9).
        {
          provide: LOGO_PATHS_REPOSITORY,
          useExisting: TypeormLogoPathsRepository,
        },
        {
          provide: MEDIA_LINK_REPOSITORY,
          useExisting: TypeormMediaLinkRepository,
        },
        // Same class, second port: how many links an event has, without the
        // addresses they point at (FR 3.8).
        {
          provide: MEDIA_LINK_TALLY,
          useExisting: TypeormMediaLinkRepository,
        },
        {
          provide: MODULE_CONFIG_REPOSITORY,
          useExisting: TypeormModuleConfigRepository,
        },
        // The profile field kit (FR 4.3, E35): instance-wide, so this port has
        // nothing to filter by — the reason it is not the registration kit's.
        {
          provide: PROFILE_FIELD_REPOSITORY,
          useExisting: TypeormProfileFieldRepository,
        },
        {
          provide: PROGRAM_ITEM_REPOSITORY,
          useExisting: TypeormProgramItemRepository,
        },
        {
          provide: PROGRAM_ITEM_TRANSLATION_REPOSITORY,
          useExisting: TypeormProgramItemTranslationRepository,
        },
        {
          provide: PROGRAM_ITEM_SIGNUP_REPOSITORY,
          useExisting: TypeormProgramItemSignupRepository,
        },
        // Same class as the programme port, second port: the dashboard's three
        // numbers, without the ability to read a session (FR 3.8).
        {
          provide: PROGRAM_TALLY,
          useExisting: TypeormProgramItemRepository,
        },
        {
          provide: PUSH_SUBSCRIPTION_REPOSITORY,
          useExisting: TypeormPushSubscriptionRepository,
        },
        {
          provide: REGISTRATION_REPOSITORY,
          useExisting: TypeormRegistrationRepository,
        },
        // Participant accounts and their sessions (E31, E34). Two ports beside
        // the administrative pair rather than one shared pair: the two kinds of
        // identity share a shape and nothing else.
        {
          provide: USER_PROFILE_REPOSITORY,
          useExisting: TypeormUserProfileRepository,
        },
        {
          provide: USER_SESSION_REPOSITORY,
          useExisting: TypeormUserSessionRepository,
        },
        // The same table read from outside the accounts module, and only ever
        // two questions about an address (F100): has it got an account, and in
        // which language is it written to.
        {
          provide: PROFILE_DIRECTORY,
          useExisting: TypeormProfileDirectory,
        },
        // A third reader of the same table, and the narrowest: a read-only
        // window on the rows that opted in, so the search cannot reach an
        // account it may not show (E37).
        {
          provide: SEARCHABLE_PROFILE_REPOSITORY,
          useExisting: TypeormSearchableProfileRepository,
        },
        {
          provide: REGISTRATION_FIELD_REPOSITORY,
          useExisting: TypeormRegistrationFieldRepository,
        },
        // Same class, second port: the counts the events and series modules are
        // allowed to see, without the rows they are not (E14).
        {
          provide: REGISTRATION_TALLY,
          useExisting: TypeormRegistrationRepository,
        },
        {
          provide: TRANSLATION_OVERRIDE_REPOSITORY,
          useExisting: TypeormTranslationOverrideRepository,
        },
        // The shipped catalogues behind a port, for the same reason the upload
        // volume is: reading a file is data access, and the business layer knows
        // that the shipped text exists, not that a disk is involved (E22).
        {
          provide: SHIPPED_CATALOGUE_READER,
          useExisting: BundledCatalogueReader,
        },
      ],
      exports: [
        ADMIN_USER_REPOSITORY,
        ADMIN_SESSION_REPOSITORY,
        APP_CONFIG_REPOSITORY,
        ATTACHMENT_REPOSITORY,
        CONVERSATION_REPOSITORY,
        MESSAGE_REPOSITORY,
        FILE_STORE,
        EVENT_SERIES_REPOSITORY,
        EVENT_SERIES_TRANSLATION_REPOSITORY,
        EVENT_REPOSITORY,
        EVENT_TRANSLATION_REPOSITORY,
        INVITATION_REPOSITORY,
        LOGO_PATHS_REPOSITORY,
        MEDIA_LINK_REPOSITORY,
        MEDIA_LINK_TALLY,
        MODULE_CONFIG_REPOSITORY,
        PROFILE_DIRECTORY,
        PROFILE_FIELD_REPOSITORY,
        SEARCHABLE_PROFILE_REPOSITORY,
        PROGRAM_ITEM_REPOSITORY,
        PROGRAM_ITEM_SIGNUP_REPOSITORY,
        PROGRAM_ITEM_TRANSLATION_REPOSITORY,
        PROGRAM_TALLY,
        PUSH_SUBSCRIPTION_REPOSITORY,
        REGISTRATION_REPOSITORY,
        REGISTRATION_FIELD_REPOSITORY,
        REGISTRATION_TALLY,
        SHIPPED_CATALOGUE_READER,
        TRANSLATION_OVERRIDE_REPOSITORY,
        USER_PROFILE_REPOSITORY,
        USER_SESSION_REPOSITORY,
        TypeOrmModule,
      ],
    };
  }
}
