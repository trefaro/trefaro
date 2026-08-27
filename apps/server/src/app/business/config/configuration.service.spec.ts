import type { TrefaroEnv } from '../../core/config/env';
import { loadEnv } from '../../core/config/env';
import type { PluginRegistryService } from '../plugin-manager';
import { ConfigurationService } from './configuration.service';
import type { CoreModuleRegistryService } from './core-module-registry.service';
import type {
  AppConfigRecord,
  AppConfigRepository,
} from './ports/app-config.repository';

const storedConfig: AppConfigRecord = {
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
  logoPath: 'branding/logo.svg',
  fontFamily: "'Inter', system-ui, sans-serif",
  defaultLocale: 'de',
  availableLocales: ['en', 'de'],
};

class FakeAppConfigRepository implements AppConfigRepository {
  constructor(private readonly record: AppConfigRecord = storedConfig) {}
  async load(): Promise<AppConfigRecord> {
    return this.record;
  }
}

/**
 * Stands in for the registry that owns the flags.
 *
 * A stub rather than a fake repository: since AP 11 this service does not read
 * `module_config` at all. Which modules are on is the registry's answer, and
 * that is the whole point — the guard in front of an optional module's endpoints
 * reads the same one, so the payload and the API cannot disagree (F53).
 */
const coreModulesWith = (enabled: readonly string[]) =>
  ({
    enabledKeys: () => enabled,
  }) as unknown as CoreModuleRegistryService;

const noPlugins = {
  enabledClientDescriptors: () => [],
} as unknown as PluginRegistryService;

function serviceWith(options: {
  appConfig?: AppConfigRepository;
  coreModules?: CoreModuleRegistryService;
  env?: TrefaroEnv;
  plugins?: PluginRegistryService;
}): ConfigurationService {
  return new ConfigurationService(
    options.appConfig ?? new FakeAppConfigRepository(),
    options.env ?? loadEnv({}),
    options.plugins ?? noPlugins,
    options.coreModules ?? coreModulesWith([]),
  );
}

describe('ConfigurationService', () => {
  it('turns the stored logo path into a public media URL', async () => {
    const config = await serviceWith({}).getAppConfig();

    expect(config.theme).toEqual({
      primaryColor: '#1f6f5c',
      accentColor: '#e8a33d',
      logoUrl: '/api/media/branding/logo.svg',
      fontFamily: "'Inter', system-ui, sans-serif",
    });
  });

  it('reports no logo URL while none is uploaded', async () => {
    const service = serviceWith({
      appConfig: new FakeAppConfigRepository({
        ...storedConfig,
        logoPath: null,
      }),
    });

    expect((await service.getAppConfig()).theme.logoUrl).toBeNull();
  });

  it('reports the enabled core modules the registry names', async () => {
    const service = serviceWith({
      coreModules: coreModulesWith(['chat', 'media-links']),
    });

    // Straight through, in the registry's order: seeding the defaults and
    // filtering out keys that are not core modules happen there, and are tested
    // in `core-module-registry.service.spec.ts`.
    expect((await service.getAppConfig()).enabledModules).toEqual([
      'chat',
      'media-links',
    ]);
  });

  it('passes the enabled plug-ins through to the clients', async () => {
    const descriptor = {
      key: 'forum',
      version: '1.0.0',
      labelKey: 'plugins.forum',
      elementName: 'trefaro-plugin-forum',
      bundleUrl: '/plugins/forum.js',
      mountPoints: ['event-detail'] as const,
      icon: null,
    };
    const service = serviceWith({
      plugins: {
        enabledClientDescriptors: () => [descriptor],
      } as unknown as PluginRegistryService,
    });

    expect((await service.getAppConfig()).plugins).toEqual([descriptor]);
  });

  it('publishes the VAPID public key only, and only when push is configured', async () => {
    expect((await serviceWith({}).getAppConfig()).webPushPublicKey).toBeNull();

    const withPush = serviceWith({
      env: loadEnv({
        VAPID_PUBLIC_KEY: 'public-key',
        VAPID_PRIVATE_KEY: 'private-key',
      }),
    });
    const config = await withPush.getAppConfig();

    expect(config.webPushPublicKey).toBe('public-key');
    expect(JSON.stringify(config)).not.toContain('private-key');
  });
});
