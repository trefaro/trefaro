import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG_REPOSITORY } from '../business/config/ports/app-config.repository';
import { EVENT_SERIES_REPOSITORY } from '../business/event-series/ports/event-series.repository';
import { EVENT_REPOSITORY } from '../business/events/ports/event.repository';
import { ADMIN_SESSION_REPOSITORY } from '../business/login/ports/admin-session.repository';
import { ADMIN_USER_REPOSITORY } from '../business/login/ports/admin-user.repository';
import { MODULE_CONFIG_REPOSITORY } from '../business/config/ports/module-config.repository';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '../business/push/ports/push-subscription.repository';
import {
  PLUGIN_PERSISTENCE_REGISTRY,
  type PluginPersistenceContribution,
} from '../business/plugin-api';
import { ENV } from '../core/config/env.module';
import type { TrefaroEnv } from '../core/config/env';
import { buildDataSourceOptions } from './data-source';
import { CORE_ENTITIES } from './entities';
import { collectPluginPersistence } from './plugin-data-access/plugin-persistence.registry';
import { TypeormAdminSessionRepository } from './repositories/typeorm-admin-session.repository';
import { TypeormAdminUserRepository } from './repositories/typeorm-admin-user.repository';
import { TypeormAppConfigRepository } from './repositories/typeorm-app-config.repository';
import { TypeormEventSeriesRepository } from './repositories/typeorm-event-series.repository';
import { TypeormEventRepository } from './repositories/typeorm-event.repository';
import { TypeormModuleConfigRepository } from './repositories/typeorm-module-config.repository';
import { TypeormPushSubscriptionRepository } from './repositories/typeorm-push-subscription.repository';

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
        TypeormAdminSessionRepository,
        TypeormAppConfigRepository,
        TypeormEventSeriesRepository,
        TypeormEventRepository,
        TypeormModuleConfigRepository,
        TypeormPushSubscriptionRepository,
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
          provide: EVENT_SERIES_REPOSITORY,
          useExisting: TypeormEventSeriesRepository,
        },
        {
          provide: EVENT_REPOSITORY,
          useExisting: TypeormEventRepository,
        },
        {
          provide: MODULE_CONFIG_REPOSITORY,
          useExisting: TypeormModuleConfigRepository,
        },
        {
          provide: PUSH_SUBSCRIPTION_REPOSITORY,
          useExisting: TypeormPushSubscriptionRepository,
        },
      ],
      exports: [
        ADMIN_USER_REPOSITORY,
        ADMIN_SESSION_REPOSITORY,
        APP_CONFIG_REPOSITORY,
        EVENT_SERIES_REPOSITORY,
        EVENT_REPOSITORY,
        MODULE_CONFIG_REPOSITORY,
        PUSH_SUBSCRIPTION_REPOSITORY,
        TypeOrmModule,
      ],
    };
  }
}
