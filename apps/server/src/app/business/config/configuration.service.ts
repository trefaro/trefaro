import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import type { AppConfig } from '@trefaro/shared-models';
import { ENV } from '../../core/config/env.module';
import type { TrefaroEnv } from '../../core/config/env';
import { PluginRegistryService } from '../plugin-manager';
import { CORE_MODULES } from './core-modules';
import {
  APP_CONFIG_REPOSITORY,
  type AppConfigRepository,
} from './ports/app-config.repository';
import {
  MODULE_CONFIG_REPOSITORY,
  type ModuleConfigRepository,
} from './ports/module-config.repository';

/** Public URL prefix under which stored files are served. */
const MEDIA_URL_PREFIX = '/api/media';

/**
 * Assembles the configuration both clients fetch before rendering anything.
 *
 * This is the first request either client makes (client start sequence): theme
 * first, then the plug-in web components. It answers without a login, because
 * the participant start page and the event landing page are public — so nothing
 * privacy-sensitive may enter this payload.
 */
@Injectable()
export class ConfigurationService implements OnApplicationBootstrap {
  constructor(
    @Inject(APP_CONFIG_REPOSITORY)
    private readonly appConfig: AppConfigRepository,
    @Inject(MODULE_CONFIG_REPOSITORY)
    private readonly moduleConfig: ModuleConfigRepository,
    @Inject(ENV) private readonly env: TrefaroEnv,
    private readonly plugins: PluginRegistryService,
  ) {}

  /** Runs after TypeORM has connected, so writing defaults is safe here. */
  async onApplicationBootstrap(): Promise<void> {
    // A module shipped by a newer version appears in the administration without
    // a manual database step.
    await this.moduleConfig.ensureDefaults(
      CORE_MODULES.map((module) => ({
        moduleKey: module.key,
        enabled: module.enabledByDefault,
      })),
    );
  }

  async getAppConfig(): Promise<AppConfig> {
    const [config, modules] = await Promise.all([
      this.appConfig.load(),
      this.moduleConfig.findAll(),
    ]);

    const coreModuleKeys = new Set(CORE_MODULES.map((module) => module.key));
    const enabledModules = modules
      .filter(
        (module) => module.enabled && coreModuleKeys.has(module.moduleKey),
      )
      .map((module) => module.moduleKey)
      .sort();

    return {
      theme: {
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
        logoUrl: config.logoPath
          ? `${MEDIA_URL_PREFIX}/${config.logoPath}`
          : null,
        fontFamily: config.fontFamily,
      },
      defaultLocale: config.defaultLocale,
      availableLocales: config.availableLocales,
      enabledModules,
      plugins: this.plugins.enabledClientDescriptors(),
      // Handing the public key to the client saves it a second round trip before
      // it can subscribe to push; the private key never leaves the server.
      webPushPublicKey: this.env.webPush?.publicKey ?? null,
    };
  }
}
