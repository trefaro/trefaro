import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { PluginDescriptor } from '@trefaro/shared-models';
import {
  isCompatiblePluginApiVersion,
  PLUGIN_API_VERSION,
  SERVER_PLUGINS,
  type ServerPlugin,
} from '../plugin-api';
import { ModuleFlagCache } from '../config/module-flags';
import {
  MODULE_CONFIG_REPOSITORY,
  type ModuleConfigRepository,
} from '../config/ports/module-config.repository';

/**
 * Aggregates the curated plug-ins and decides which of them are live.
 *
 * Every plug-in in the image is mounted at boot; the enabled flag from
 * `module_config` decides whether its API answers requests and whether the
 * clients are told about its web component. That is what makes activation a
 * runtime configuration change (F6) rather than a redeploy.
 *
 * Enabled state is cached in memory, so the guard on every plug-in request does
 * not turn into a database round trip. The cache is re-read periodically, which
 * is what makes a change to `module_config` take effect without a restart —
 * including one made directly in the database, before the module administration
 * UI exists. Phase 2's admin endpoint additionally calls {@link refresh} so its
 * own change is visible immediately.
 *
 * That caching is {@link ModuleFlagCache}, shared with the core modules since
 * AP 11: both families read the same table, and one of them having a different
 * refresh interval would be two answers to "how long until my change takes
 * effect". What stays here is everything specific to plug-ins — the descriptors,
 * and that a plug-in is off by default.
 */
@Injectable()
export class PluginRegistryService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly flags: ModuleFlagCache;

  constructor(
    @Inject(SERVER_PLUGINS) private readonly plugins: readonly ServerPlugin[],
    @Inject(MODULE_CONFIG_REPOSITORY) moduleConfig: ModuleConfigRepository,
  ) {
    this.flags = new ModuleFlagCache(
      moduleConfig,
      'Plug-ins',
      new Logger(PluginRegistryService.name),
    );
  }

  /** Runs after TypeORM has connected, so reading configuration is safe here. */
  async onApplicationBootstrap(): Promise<void> {
    await this.flags.start(
      this.plugins.map((plugin) => ({
        moduleKey: plugin.key,
        enabled: plugin.enabledByDefault ?? false,
      })),
    );
  }

  onApplicationShutdown(): void {
    this.flags.stop();
  }

  /** Re-reads the enabled flags from configuration. */
  refresh(): Promise<void> {
    return this.flags.refresh();
  }

  /** Every plug-in in the image, enabled or not — the administration lists these. */
  all(): readonly ServerPlugin[] {
    return this.plugins;
  }

  isEnabled(pluginKey: string): boolean {
    return this.flags.isEnabled(pluginKey);
  }

  /**
   * Descriptors of the enabled plug-ins that contribute a web component, in the
   * shape the clients consume. A disabled plug-in is simply absent, so a client
   * never learns a bundle URL it is not allowed to load.
   */
  enabledClientDescriptors(): readonly PluginDescriptor[] {
    return this.plugins
      .filter((plugin) => plugin.client && this.isEnabled(plugin.key))
      .map((plugin) => {
        // Narrowed by the filter above; kept local so the mapping stays readable.
        const client = plugin.client as NonNullable<ServerPlugin['client']>;
        return {
          key: plugin.key,
          version: plugin.version,
          labelKey: client.labelKey,
          elementName: client.elementName,
          bundleUrl: client.bundleUrl,
          mountPoints: client.mountPoints,
          icon: client.icon ?? null,
        };
      });
  }
}

/**
 * Rejects plug-ins built against an incompatible contract version and reports
 * duplicate keys.
 *
 * Called by the composition root before anything is mounted: a plug-in that
 * cannot be trusted to match the contract must not reach the DI container at
 * all (NFR 10 — one faulty plug-in may not destabilise the instance).
 */
export function selectCompatiblePlugins(
  candidates: readonly ServerPlugin[],
  logger: Pick<Logger, 'error' | 'warn'> = new Logger('PluginManager'),
): readonly ServerPlugin[] {
  const accepted: ServerPlugin[] = [];
  const seen = new Set<string>();

  for (const plugin of candidates) {
    if (!isCompatiblePluginApiVersion(plugin.apiVersion)) {
      logger.error(
        `Plug-in "${plugin.key}" targets plug-in API ${plugin.apiVersion}, ` +
          `which is incompatible with ${PLUGIN_API_VERSION}. Not mounted.`,
      );
      continue;
    }
    if (seen.has(plugin.key)) {
      logger.error(
        `Plug-in key "${plugin.key}" is registered more than once. Only the first is mounted.`,
      );
      continue;
    }
    seen.add(plugin.key);
    accepted.push(plugin);
  }

  return accepted;
}
