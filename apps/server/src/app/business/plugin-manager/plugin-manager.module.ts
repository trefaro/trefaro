import { DynamicModule, Logger, Module } from '@nestjs/common';
import {
  PLUGIN_PERSISTENCE_REGISTRY,
  SERVER_PLUGINS,
  type PluginPersistenceContribution,
  type ServerPlugin,
} from '../plugin-api';
import { PluginEnabledGuard } from './plugin-enabled.guard';
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
        PluginEnabledGuard,
      ],
      exports: [
        SERVER_PLUGINS,
        PLUGIN_PERSISTENCE_REGISTRY,
        PluginRegistryService,
        PluginEnabledGuard,
      ],
    };
  }
}
