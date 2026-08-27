import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { CORE_MODULES, type CoreModuleDescriptor } from './core-modules';
import { ModuleFlagCache } from './module-flags';
import {
  MODULE_CONFIG_REPOSITORY,
  type ModuleConfigRepository,
} from './ports/module-config.repository';

/**
 * Which optional core modules this instance runs (FR 1.5).
 *
 * The counterpart of `PluginRegistryService` for the modules that ship inside the
 * application rather than as plug-ins, and the single place that answers "is
 * `media-links` on?". Both the configuration both clients fetch and the guard in
 * front of an optional module's endpoints ask this service, so what a client is
 * told and what the API does cannot disagree (F53) — before AP 11 the payload
 * was read fresh from the table while a guard would have been reading a cache,
 * and the two would have drifted apart for as long as the refresh interval.
 *
 * Every core module is mounted at boot, whether it is enabled or not, exactly as
 * every curated plug-in is: the flag decides whether the API answers, never
 * whether the code exists. Switching a module off deletes nothing.
 */
@Injectable()
export class CoreModuleRegistryService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly flags: ModuleFlagCache;

  constructor(
    @Inject(MODULE_CONFIG_REPOSITORY) moduleConfig: ModuleConfigRepository,
  ) {
    this.flags = new ModuleFlagCache(
      moduleConfig,
      'Core modules',
      new Logger(CoreModuleRegistryService.name),
    );
  }

  /** Runs after TypeORM has connected, so writing defaults is safe here. */
  async onApplicationBootstrap(): Promise<void> {
    await this.flags.start(
      CORE_MODULES.map((module) => ({
        moduleKey: module.key,
        enabled: module.enabledByDefault,
      })),
    );
  }

  onApplicationShutdown(): void {
    this.flags.stop();
  }

  /**
   * Re-reads the flags now.
   *
   * For phase 2's module administration, so its own change is visible before the
   * next scheduled read.
   */
  refresh(): Promise<void> {
    return this.flags.refresh();
  }

  isEnabled(moduleKey: string): boolean {
    return this.flags.isEnabled(moduleKey);
  }

  /** The enabled keys, sorted — what `/api/config` reports. */
  enabledKeys(): readonly string[] {
    return this.flags.keys();
  }

  /** Every optional core module, enabled or not — the administration lists these. */
  all(): readonly CoreModuleDescriptor[] {
    return CORE_MODULES;
  }
}
