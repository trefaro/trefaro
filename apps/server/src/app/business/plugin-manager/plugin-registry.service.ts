import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { PluginDescriptor } from '@trefaro/shared-models';
import {
  isCompatiblePluginApiVersion,
  PLUGIN_API_VERSION,
  SERVER_PLUGINS,
  type ServerPlugin,
} from '../plugin-api';
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
 * Enabled state is cached in memory and refreshed on demand, so the guard on
 * every plug-in request does not turn into a database round trip.
 */
@Injectable()
export class PluginRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginRegistryService.name);
  private enabledKeys = new Set<string>();

  constructor(
    @Inject(SERVER_PLUGINS) private readonly plugins: readonly ServerPlugin[],
    @Inject(MODULE_CONFIG_REPOSITORY)
    private readonly moduleConfig: ModuleConfigRepository,
  ) {}

  /** Runs after TypeORM has connected, so reading configuration is safe here. */
  async onApplicationBootstrap(): Promise<void> {
    await this.moduleConfig.ensureDefaults(
      this.plugins.map((plugin) => ({
        moduleKey: plugin.key,
        enabled: plugin.enabledByDefault ?? false,
      })),
    );
    await this.refresh();
  }

  /** Re-reads the enabled flags from configuration. */
  async refresh(): Promise<void> {
    const records = await this.moduleConfig.findAll();
    const known = new Set(this.plugins.map((plugin) => plugin.key));
    this.enabledKeys = new Set(
      records
        .filter((record) => record.enabled && known.has(record.moduleKey))
        .map((record) => record.moduleKey),
    );
    this.logger.log(
      `Plug-ins enabled: ${
        this.enabledKeys.size === 0
          ? '(none)'
          : [...this.enabledKeys].sort().join(', ')
      }`,
    );
  }

  /** Every plug-in in the image, enabled or not — the administration lists these. */
  all(): readonly ServerPlugin[] {
    return this.plugins;
  }

  isEnabled(pluginKey: string): boolean {
    return this.enabledKeys.has(pluginKey);
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
