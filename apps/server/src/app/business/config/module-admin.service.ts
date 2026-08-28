import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ModuleSummary } from '@trefaro/shared-models';
import type { ServerPlugin } from '../plugin-api';
import { PluginRegistryService } from '../plugin-manager';
import type { CoreModuleDescriptor } from './core-modules';
import { CoreModuleRegistryService } from './core-module-registry.service';
import {
  MODULE_CONFIG_REPOSITORY,
  type ModuleConfigRepository,
} from './ports/module-config.repository';

/**
 * Switching optional core modules and curated plug-ins on and off (FR 1.5).
 *
 * The one place both families are read as one list. They are switched the same
 * way — a flag per key in `module_config` — and an organizer thinks of them as
 * one question ("what does this instance offer?"), so a page that showed them in
 * two unrelated tables would be describing the implementation.
 *
 * Three decisions worth naming:
 *
 * 1. **The state comes from the registries, not from the table.** The two
 *    registries are what the guards and `/api/config` answer from (F53), so
 *    reading the table here would be a third reader that can disagree with both:
 *    a list saying `media-links` is on while its endpoints answer 404 is worse
 *    than no list.
 * 2. **A write refreshes both caches at once.** Not only the family the key
 *    belongs to: the two read the same table, and the fifteen seconds a
 *    scheduled read costs would be an organizer waiting for their own click
 *    (F6). Refreshing the other family as well is one query and removes the
 *    question of whether the right cache was picked.
 * 3. **An unknown key is a 404, not a new row.** `module_config` would happily
 *    take one — and nothing would ever read it. The keys that exist are the
 *    descriptors this instance ships.
 */
@Injectable()
export class ModuleAdminService {
  constructor(
    @Inject(MODULE_CONFIG_REPOSITORY)
    private readonly moduleConfig: ModuleConfigRepository,
    private readonly coreModules: CoreModuleRegistryService,
    private readonly plugins: PluginRegistryService,
  ) {}

  /**
   * Every switchable module of this instance, core modules first.
   *
   * Core modules before plug-ins, each family in the order it is declared: the
   * order is the same on every visit, which a list of switches needs more than
   * it needs alphabetical order.
   */
  list(): readonly ModuleSummary[] {
    return [
      ...this.coreModules.all().map((module) => this.coreSummary(module)),
      ...this.plugins.all().map((plugin) => this.pluginSummary(plugin)),
    ];
  }

  /**
   * Switches one module on or off and reports it back as it now is.
   *
   * Writes first, then re-reads: the answer describes what the guards will do
   * from now on rather than what was asked for.
   */
  async setEnabled(
    moduleKey: string,
    enabled: boolean,
  ): Promise<ModuleSummary> {
    // Before the write, so an unknown key never creates a row.
    this.require(moduleKey);

    await this.moduleConfig.setEnabled(moduleKey, enabled);
    await Promise.all([this.coreModules.refresh(), this.plugins.refresh()]);

    return this.require(moduleKey);
  }

  private require(moduleKey: string): ModuleSummary {
    const core = this.coreModules
      .all()
      .find((module) => module.key === moduleKey);
    if (core) return this.coreSummary(core);

    const plugin = this.plugins.all().find((item) => item.key === moduleKey);
    if (plugin) return this.pluginSummary(plugin);

    throw new NotFoundException(`No module "${moduleKey}" in this instance`);
  }

  private coreSummary(module: CoreModuleDescriptor): ModuleSummary {
    return {
      key: module.key,
      family: 'core',
      titleKey: module.titleKey,
      enabled: this.coreModules.isEnabled(module.key),
      enabledByDefault: module.enabledByDefault,
      // A core module ships inside the application: there is no version of its
      // own to report and no bundle to load.
      version: null,
      bundleUrl: null,
      mountPoints: [],
    };
  }

  private pluginSummary(plugin: ServerPlugin): ModuleSummary {
    return {
      key: plugin.key,
      family: 'plugin',
      titleKey: plugin.titleKey,
      enabled: this.plugins.isEnabled(plugin.key),
      enabledByDefault: plugin.enabledByDefault ?? false,
      version: plugin.version,
      bundleUrl: plugin.client?.bundleUrl ?? null,
      mountPoints: plugin.client?.mountPoints ?? [],
    };
  }
}
