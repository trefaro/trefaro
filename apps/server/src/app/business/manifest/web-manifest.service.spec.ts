import { SHIPPED_APP_ICONS, type AppConfig } from '@trefaro/shared-models';
import type { BrandingService, ConfigurationService } from '../config';
import type { CatalogueService } from '../i18n';
import { WebManifestService } from './web-manifest.service';

const APP_CONFIG: AppConfig = {
  organizationName: 'Democracy International e.V.',
  theme: {
    primaryColor: '#1f6f5c',
    accentColor: '#e8a33d',
    logoUrl: '/api/media/branding/logo?v=1756370460000',
    fontFamily: 'system-ui, sans-serif',
  },
  defaultLocale: 'de',
  availableLocales: ['en', 'de'],
  enabledModules: [],
  plugins: [],
  webPushPublicKey: null,
  publicUserClientUrl: 'https://events.example.org',
  appIconUrl: null,
};

interface Options {
  readonly config?: Partial<AppConfig>;
  readonly catalogue?: Record<string, string>;
  readonly dimensions?: { width: number; height: number } | null;
}

function build(options: Options = {}): {
  service: WebManifestService;
  describe: jest.Mock;
} {
  const describe = jest.fn(async () => ({
    mimeType: 'image/png',
    dimensions: options.dimensions ?? null,
  }));

  const service = new WebManifestService(
    {
      getAppConfig: async () => ({ ...APP_CONFIG, ...options.config }),
    } as unknown as ConfigurationService,
    {
      resolve: async (locale: string) => ({
        locale,
        catalogue: options.catalogue ?? {
          'pwa.description': 'Veranstaltungsreihen, Programm und Community.',
        },
        etag: '"catalogue"',
      }),
    } as unknown as CatalogueService,
    { describe } as unknown as BrandingService,
  );

  return { service, describe };
}

describe('WebManifestService', () => {
  it('builds the document from the configuration', async () => {
    const { manifest } = await build().service.resolve();

    expect(manifest.name).toBe('Democracy International e.V.');
    expect(manifest.theme_color).toBe('#1f6f5c');
    expect(manifest.icons).toEqual(SHIPPED_APP_ICONS);
  });

  it('writes the description in the language of the instance, not the reader', async () => {
    // Nobody chooses the language of a manifest: a browser fetches it out of a
    // `<link>` while installing. Same situation as a mail (E24), same answer.
    const { manifest } = await build().service.resolve();

    expect(manifest.lang).toBe('de');
    expect(manifest.description).toBe(
      'Veranstaltungsreihen, Programm und Community.',
    );
  });

  it('does not read the icon file while none is uploaded', async () => {
    const { service, describe } = build();
    await service.resolve();

    expect(describe).not.toHaveBeenCalled();
  });

  it('declares an uploaded icon at the size its header states', async () => {
    const { service, describe } = build({
      config: { appIconUrl: '/api/media/branding/app-icon?v=1756370460000' },
      dimensions: { width: 512, height: 512 },
    });

    const { manifest } = await service.resolve();

    expect(describe).toHaveBeenCalledWith('app-icon');
    expect(manifest.icons).toEqual([
      {
        src: '/api/media/branding/app-icon?v=1756370460000',
        sizes: '512x512',
        purpose: 'any',
      },
    ]);
  });

  it('keeps the shipped icons when the upload cannot be measured', async () => {
    const { service } = build({
      config: { appIconUrl: '/api/media/branding/app-icon?v=1756370460000' },
      dimensions: null,
    });

    const { manifest } = await service.resolve();

    expect(manifest.icons[0].sizes).toBe('any');
    expect(manifest.icons.slice(1)).toEqual(SHIPPED_APP_ICONS);
  });

  it('answers a tag that follows the configuration', async () => {
    const plain = await build().service.resolve();
    const renamed = await build({
      config: { organizationName: 'Another Organization' },
    }).service.resolve();

    expect(renamed.etag).not.toBe(plain.etag);
  });
});
