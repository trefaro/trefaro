import { DynamicModule, Logger, Module } from '@nestjs/common';
import {
  PLUGIN_ENABLED,
  PLUGIN_PERSISTENCE_REGISTRY,
  PluginEnabledGuard,
  SERVER_PLUGINS,
  type PluginPersistenceContribution,
  type ServerPlugin,
} from '../plugin-api';
import {
  PluginRegistryService,
  selectCompatiblePlugins,
} from './plugin-registry.service';

/**
 * Mounts the curated server plug-ins.
 *
 * Each plug-in contributes one NestJS module holding its API controllers and
 * its business providers; its persistence contribution is forwarded, untouched,
 * to the data access layer under {@link PLUGIN_PERSISTENCE_REGISTRY}. The
 * business layer never looks inside it.
 *
 * It also binds the one thing the contract's {@link PluginEnabledGuard} cannot
 * answer for itself: {@link PLUGIN_ENABLED}, the current flag of a plug-in.
 * The guard lives in `plugin-api` because every plug-in controller carries it
 * and a plug-in imports nothing else — so the dependency runs this way round,
 * from the manager to the contract, and never back.
 */
@Module({})
export class PluginManagerModule {
  static forPlugins(candidates: readonly ServerPlugin[]): DynamicModule {
    const plugins = selectCompatiblePlugins(
      candidates,
      new Logger(PluginManagerModule.name),
    );

    const persistence: readonly PluginPersistenceContribution[] = plugins.map(
      (plugin) => plugin.persistence,
    );

    return {
      module: PluginManagerModule,
      global: true,
      imports: plugins.map((plugin) => plugin.module),
      providers: [
        { provide: SERVER_PLUGINS, useValue: plugins },
        { provide: PLUGIN_PERSISTENCE_REGISTRY, useValue: persistence },
        PluginRegistryService,
        { provide: PLUGIN_ENABLED, useExisting: PluginRegistryService },
        PluginEnabledGuard,
      ],
      exports: [
        SERVER_PLUGINS,
        PLUGIN_PERSISTENCE_REGISTRY,
        PluginRegistryService,
        PLUGIN_ENABLED,
        PluginEnabledGuard,
      ],
    };
  }
}
