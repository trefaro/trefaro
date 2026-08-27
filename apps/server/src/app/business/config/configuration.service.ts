import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '@trefaro/shared-models';
import { ENV } from '../../core/config/env.module';
import type { TrefaroEnv } from '../../core/config/env';
import { PluginRegistryService } from '../plugin-manager';
import { CoreModuleRegistryService } from './core-module-registry.service';
import {
  APP_CONFIG_REPOSITORY,
  type AppConfigRepository,
} from './ports/app-config.repository';

/** Public URL prefix under which stored files are served. */
const MEDIA_URL_PREFIX = '/api/media';

/**
 * Assembles the configuration both clients fetch before rendering anything.
 *
 * This is the first request either client makes (client start sequence): theme
 * first, then the plug-in web components. It answers without a login, because
 * the participant start page and the event landing page are public — so nothing
 * privacy-sensitive may enter this payload.
 *
 * Which modules are enabled comes from {@link CoreModuleRegistryService} rather
 * than from the table directly, so this payload and the guard in front of an
 * optional module's endpoints answer from the same state (F53). Two readers of
 * the same flag, one cached and one not, would disagree for as long as the
 * refresh interval — and a client would then be told about a module whose API
 * answers 404.
 */
@Injectable()
export class ConfigurationService {
  constructor(
    @Inject(APP_CONFIG_REPOSITORY)
    private readonly appConfig: AppConfigRepository,
    @Inject(ENV) private readonly env: TrefaroEnv,
    private readonly plugins: PluginRegistryService,
    private readonly coreModules: CoreModuleRegistryService,
  ) {}

  async getAppConfig(): Promise<AppConfig> {
    const config = await this.appConfig.load();
    const enabledModules = this.coreModules.enabledKeys();

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
