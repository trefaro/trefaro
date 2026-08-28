import type {
  AppConfigChange,
  BrandingImageKind,
} from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import { loadEnv } from '../../core/config/env';
import type { PluginRegistryService } from '../plugin-manager';
import { ConfigurationService } from './configuration.service';
import type { CoreModuleRegistryService } from './core-module-registry.service';
import type {
  AppConfigRecord,
  AppConfigRepository,
} from './ports/app-config.repository';

/** The version in every branding URL below; `?v=` carries its epoch millis. */
const CHANGED_AT = new Date('2026-08-28T09:41:00.000Z');

const storedConfig: AppConfigRecord = {
  organizationName: 'Democracy International e.V.',
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
  logoPath: 'branding/8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
  appIconPath: null,
  fontFamily: 'inter',
  defaultLocale: 'de',
  availableLocales: ['en', 'de'],
  updatedAt: CHANGED_AT,
};

class FakeAppConfigRepository implements AppConfigRepository {
  private record: AppConfigRecord;
  /** What `save` was handed, so a test can assert what never reached the port. */
  written: AppConfigChange | null = null;

  constructor(record: AppConfigRecord = storedConfig) {
    this.record = record;
  }

  async load(): Promise<AppConfigRecord> {
    return this.record;
  }

  async save(change: AppConfigChange): Promise<AppConfigRecord> {
    this.written = change;
    this.record = { ...this.record, ...change };
    return this.record;
  }

  async setBrandingImage(
    kind: BrandingImageKind,
    storedPath: string | null,
  ): Promise<AppConfigRecord> {
    this.record =
      kind === 'logo'
        ? { ...this.record, logoPath: storedPath }
        : { ...this.record, appIconPath: storedPath };
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
    isEnabled: (key: string) => enabled.includes(key),
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
  it('publishes a logo URL that names the image, not its stored path', async () => {
    const config = await serviceWith({}).getAppConfig();

    // The generated file name is nowhere in it (E19): the route resolves the
    // logo through `app_config`, so no caller can name a neighbouring file —
    // and the neighbours in that volume are registration attachments (E9).
    expect(config.theme).toEqual({
      primaryColor: '#1f6f5c',
      accentColor: '#e8a33d',
      logoUrl: `/api/media/branding/logo?v=${CHANGED_AT.getTime()}`,
      fontFamily: "'Inter', system-ui, sans-serif",
    });
    expect(config.theme.logoUrl).not.toContain(storedConfig.logoPath);
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

  it('publishes the app icon beside the theme, and only once uploaded', async () => {
    expect((await serviceWith({}).getAppConfig()).appIconUrl).toBeNull();

    const withIcon = serviceWith({
      appConfig: new FakeAppConfigRepository({
        ...storedConfig,
        appIconPath: 'branding/1b2c3d4e-5f60-7182-93a4-b5c6d7e8f900',
      }),
    });

    // Same version as the logo: `?v=` is the row's `updated_at`, so both images
    // are re-fetched together and neither can be shown from a stale cache while
    // the other is current.
    expect((await withIcon.getAppConfig()).appIconUrl).toBe(
      `/api/media/branding/app-icon?v=${CHANGED_AT.getTime()}`,
    );
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
    const env = loadEnv({
      VAPID_PUBLIC_KEY: 'public-key',
      VAPID_PRIVATE_KEY: 'private-key',
    });

    // No key pair in the environment: nothing to publish, however the module is
    // configured.
    expect(
      (
        await serviceWith({
          coreModules: coreModulesWith(['push']),
        }).getAppConfig()
      ).webPushPublicKey,
    ).toBeNull();

    const config = await serviceWith({
      env,
      coreModules: coreModulesWith(['push']),
    }).getAppConfig();

    expect(config.webPushPublicKey).toBe('public-key');
    expect(JSON.stringify(config)).not.toContain('private-key');
  });

  it('withholds the VAPID key while the push module is switched off (E21)', async () => {
    // A key in the environment and the module off: the deployment provided the
    // pair, the organization did not ask for push. A client that got the key
    // would offer a subscription, and the endpoint that stores it answers 404 —
    // so the two have to be decided by the same flag.
    const config = await serviceWith({
      env: loadEnv({
        VAPID_PUBLIC_KEY: 'public-key',
        VAPID_PRIVATE_KEY: 'private-key',
      }),
    }).getAppConfig();

    expect(config.webPushPublicKey).toBeNull();
    expect(config.enabledModules).not.toContain('push');
  });

  it('expands the stored font key into the stack the clients publish', async () => {
    // The row says `inter`; `--trefaro-font-family` needs a CSS value, and it
    // must be the same one in both clients — so the server expands it (E18).
    const config = await serviceWith({}).getAppConfig();

    expect(config.theme.fontFamily).toBe("'Inter', system-ui, sans-serif");
  });

  it('falls back to the default stack for a font that is no longer shipped', async () => {
    const service = serviceWith({
      appConfig: new FakeAppConfigRepository({
        ...storedConfig,
        fontFamily: 'a-family-we-withdrew',
      }),
    });

    // Renders in the system font rather than not rendering. The design page
    // then shows the fallback, which is a correctable state.
    expect((await service.getAppConfig()).theme.fontFamily).toBe(
      'system-ui, sans-serif',
    );
  });

  it('names the organization, not this software', async () => {
    expect((await serviceWith({}).getAppConfig()).organizationName).toBe(
      'Democracy International e.V.',
    );
  });

  it('tells the organizer client where the participant client answers', async () => {
    const service = serviceWith({
      env: loadEnv({ PUBLIC_USER_CLIENT_URL: 'https://events.example.org' }),
    });

    // From the environment: the organizer client is a different origin and
    // cannot derive this, and only the deployment knows it.
    expect((await service.getAppConfig()).publicUserClientUrl).toBe(
      'https://events.example.org',
    );
  });
});

describe('ConfigurationService.updateSettings', () => {
  it('returns the stored values, with the font as its key', async () => {
    const settings = await serviceWith({}).getSettings();

    // Not the expanded stack: a `<select>` has to send back what it was given.
    expect(settings).toEqual({
      organizationName: 'Democracy International e.V.',
      primaryColor: '#1f6f5c',
      accentColor: '#e8a33d',
      fontFamily: 'inter',
    });
  });

  it('writes only what was sent', async () => {
    const appConfig = new FakeAppConfigRepository();
    const settings = await serviceWith({ appConfig }).updateSettings({
      primaryColor: '#123456',
    });

    expect(appConfig.written).toEqual({ primaryColor: '#123456' });
    expect(settings.accentColor).toBe('#e8a33d');
    expect(settings.organizationName).toBe('Democracy International e.V.');
  });

  it('refuses a colour it cannot weigh for contrast (E17)', async () => {
    for (const color of ['red', 'rgba(0, 0, 0, .5)', 'oklch(55% .1 160)']) {
      const appConfig = new FakeAppConfigRepository();
      const service = serviceWith({ appConfig });

      await expect(
        service.updateSettings({ primaryColor: color }),
      ).rejects.toMatchObject({ status: 400 });
      // The point of checking here and not only in the DTO: nothing reached the
      // port, so an import or a seed script cannot store it either.
      expect(appConfig.written).toBeNull();
    }
  });

  it('stores a colour in one spelling', async () => {
    const settings = await serviceWith({}).updateSettings({
      accentColor: '#ABCDEF',
    });

    expect(settings.accentColor).toBe('#abcdef');
  });

  it('refuses a font this instance does not ship (E18)', async () => {
    const appConfig = new FakeAppConfigRepository();
    const service = serviceWith({ appConfig });

    await expect(
      service.updateSettings({ fontFamily: 'Comic Sans MS' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(appConfig.written).toBeNull();
  });

  it('refuses a name that is empty once trimmed, and trims the rest', async () => {
    await expect(
      serviceWith({}).updateSettings({ organizationName: '   ' }),
    ).rejects.toMatchObject({ status: 400 });

    const settings = await serviceWith({}).updateSettings({
      organizationName: '  Democracy International e.V.  ',
    });
    expect(settings.organizationName).toBe('Democracy International e.V.');
  });

  it('accepts an empty change without touching anything', async () => {
    const appConfig = new FakeAppConfigRepository();
    const settings = await serviceWith({ appConfig }).updateSettings({});

    expect(appConfig.written).toEqual({});
    expect(settings.primaryColor).toBe('#1f6f5c');
  });
});
