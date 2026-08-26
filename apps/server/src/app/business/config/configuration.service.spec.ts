import type { TrefaroEnv } from '../../core/config/env';
import { loadEnv } from '../../core/config/env';
import type { PluginRegistryService } from '../plugin-manager';
import { ConfigurationService } from './configuration.service';
import type {
  AppConfigRecord,
  AppConfigRepository,
} from './ports/app-config.repository';
import type {
  ModuleConfigRecord,
  ModuleConfigRepository,
  ModuleDefault,
} from './ports/module-config.repository';

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

class FakeModuleConfigRepository implements ModuleConfigRepository {
  readonly rows = new Map<string, ModuleConfigRecord>();

  constructor(enabled: readonly string[] = []) {
    for (const key of enabled) {
      this.rows.set(key, { moduleKey: key, enabled: true, settings: {} });
    }
  }

  async findAll(): Promise<readonly ModuleConfigRecord[]> {
    return [...this.rows.values()];
  }

  async ensureDefaults(defaults: readonly ModuleDefault[]): Promise<void> {
    for (const entry of defaults) {
      if (!this.rows.has(entry.moduleKey)) {
        this.rows.set(entry.moduleKey, { ...entry, settings: {} });
      }
    }
  }

  async setEnabled(
    moduleKey: string,
    enabled: boolean,
  ): Promise<ModuleConfigRecord> {
    const next = { moduleKey, enabled, settings: {} };
    this.rows.set(moduleKey, next);
    return next;
  }
}

const noPlugins = {
  enabledClientDescriptors: () => [],
} as unknown as PluginRegistryService;

function serviceWith(options: {
  appConfig?: AppConfigRepository;
  moduleConfig?: ModuleConfigRepository;
  env?: TrefaroEnv;
  plugins?: PluginRegistryService;
}): ConfigurationService {
  return new ConfigurationService(
    options.appConfig ?? new FakeAppConfigRepository(),
    options.moduleConfig ?? new FakeModuleConfigRepository(),
    options.env ?? loadEnv({}),
    options.plugins ?? noPlugins,
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

  it('lists enabled core modules and ignores everything else', async () => {
    const service = serviceWith({
      moduleConfig: new FakeModuleConfigRepository([
        'chat',
        'media-links',
        // A plug-in key: reported through `plugins`, not through `enabledModules`.
        'room-planning',
      ]),
    });

    expect((await service.getAppConfig()).enabledModules).toEqual([
      'chat',
      'media-links',
    ]);
  });

  it('seeds the default state of every core module on first boot', async () => {
    const repository = new FakeModuleConfigRepository();
    const service = serviceWith({ moduleConfig: repository });

    await service.onApplicationBootstrap();

    // media-links is the only core module that ships switched on.
    expect(repository.rows.get('media-links')?.enabled).toBe(true);
    expect(repository.rows.get('chat')?.enabled).toBe(false);
  });

  it('does not overwrite a module the organization already configured', async () => {
    const repository = new FakeModuleConfigRepository(['chat']);
    const service = serviceWith({ moduleConfig: repository });

    await service.onApplicationBootstrap();

    expect(repository.rows.get('chat')?.enabled).toBe(true);
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
