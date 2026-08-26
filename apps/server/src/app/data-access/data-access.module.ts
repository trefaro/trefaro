import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG_REPOSITORY } from '../business/config/ports/app-config.repository';
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
import { TypeormAppConfigRepository } from './repositories/typeorm-app-config.repository';
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
        TypeormAppConfigRepository,
        TypeormModuleConfigRepository,
        TypeormPushSubscriptionRepository,
        {
          provide: APP_CONFIG_REPOSITORY,
          useExisting: TypeormAppConfigRepository,
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
        APP_CONFIG_REPOSITORY,
        MODULE_CONFIG_REPOSITORY,
        PUSH_SUBSCRIPTION_REPOSITORY,
        TypeOrmModule,
      ],
    };
  }
}
