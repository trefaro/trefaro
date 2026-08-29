import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ATTACHMENT_REPOSITORY } from '../business/attachments/ports/attachment.repository';
import { FILE_STORE } from '../business/attachments/ports/file-store';
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
import { PROGRAM_ITEM_SIGNUP_REPOSITORY } from '../business/program/ports/program-item-signup.repository';
import { PROGRAM_ITEM_TRANSLATION_REPOSITORY } from '../business/program/ports/program-item-translation.repository';
import { PROGRAM_ITEM_REPOSITORY } from '../business/program/ports/program-item.repository';
import { PROGRAM_TALLY } from '../business/program/ports/program-tally';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '../business/push/ports/push-subscription.repository';
import { REGISTRATION_TALLY } from '../business/registration/ports/registration-tally';
import { REGISTRATION_FIELD_REPOSITORY } from '../business/registration/ports/registration-field.repository';
import { REGISTRATION_REPOSITORY } from '../business/registration/ports/registration.repository';
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
import { TypeormEventSeriesTranslationRepository } from './repositories/typeorm-event-series-translation.repository';
import { TypeormEventSeriesRepository } from './repositories/typeorm-event-series.repository';
import { TypeormEventTranslationRepository } from './repositories/typeorm-event-translation.repository';
import { TypeormEventRepository } from './repositories/typeorm-event.repository';
import { TypeormInvitationRepository } from './repositories/typeorm-invitation.repository';
import { TypeormMediaLinkRepository } from './repositories/typeorm-media-link.repository';
import { TypeormModuleConfigRepository } from './repositories/typeorm-module-config.repository';
import { TypeormProgramItemSignupRepository } from './repositories/typeorm-program-item-signup.repository';
import { TypeormProgramItemTranslationRepository } from './repositories/typeorm-program-item-translation.repository';
import { TypeormProgramItemRepository } from './repositories/typeorm-program-item.repository';
import { TypeormPushSubscriptionRepository } from './repositories/typeorm-push-subscription.repository';
import { TypeormRegistrationFieldRepository } from './repositories/typeorm-registration-field.repository';
import { TypeormRegistrationRepository } from './repositories/typeorm-registration.repository';
import { TypeormTranslationOverrideRepository } from './repositories/typeorm-translation-override.repository';

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
        LocalDiskFileStore,
        TypeormAdminSessionRepository,
        TypeormAppConfigRepository,
        TypeormEventSeriesRepository,
        TypeormEventSeriesTranslationRepository,
        TypeormEventRepository,
        TypeormEventTranslationRepository,
        TypeormInvitationRepository,
        TypeormMediaLinkRepository,
        TypeormModuleConfigRepository,
        TypeormProgramItemRepository,
        TypeormProgramItemTranslationRepository,
        TypeormProgramItemSignupRepository,
        TypeormPushSubscriptionRepository,
        TypeormRegistrationRepository,
        TypeormRegistrationFieldRepository,
        TypeormTranslationOverrideRepository,
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
        FILE_STORE,
        EVENT_SERIES_REPOSITORY,
        EVENT_SERIES_TRANSLATION_REPOSITORY,
        EVENT_REPOSITORY,
        EVENT_TRANSLATION_REPOSITORY,
        INVITATION_REPOSITORY,
        MEDIA_LINK_REPOSITORY,
        MEDIA_LINK_TALLY,
        MODULE_CONFIG_REPOSITORY,
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
        TypeOrmModule,
      ],
    };
  }
}
