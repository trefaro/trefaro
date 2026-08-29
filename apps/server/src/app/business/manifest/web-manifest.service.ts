import { Injectable } from '@nestjs/common';
import type { WebManifest } from '@trefaro/shared-models';
import { BrandingService, ConfigurationService } from '../config';
import { CatalogueService } from '../i18n';
import { buildWebManifest, webManifestEtag } from './web-manifest';

/** One built manifest and the tag a browser can revalidate it with. */
export interface ResolvedWebManifest {
  readonly manifest: WebManifest;
  readonly etag: string;
}

/**
 * The catalogue key that describes the application on an install screen.
 *
 * The one sentence of this document that is words rather than data, so it comes
 * from the catalogue like every other sentence (E22) — a server that owns
 * surface text owns it in one language.
 */
const DESCRIPTION_KEY = 'pwa.description';

/**
 * Assembles the manifest of this instance (F20, E26).
 *
 * A composition above three modules, and it lives in its own module for the
 * reason `business/dashboard` and `business/content-translations` do (F49): the
 * catalogue already reads the configuration, so asking it back from
 * `ConfigurationModule` would close a circle and need a `forwardRef`. The
 * dependency runs one way, and this module sits on top.
 *
 * **The manifest speaks the instance's default language**, not the reader's.
 * Nobody chooses the language of this document: a browser fetches it out of a
 * `<link>` while installing, with no say from the page and no second chance —
 * the same situation a mail is in (E24), and the same answer.
 */
@Injectable()
export class WebManifestService {
  constructor(
    private readonly configuration: ConfigurationService,
    private readonly catalogues: CatalogueService,
    private readonly branding: BrandingService,
  ) {}

  async resolve(): Promise<ResolvedWebManifest> {
    const config = await this.configuration.getAppConfig();
    // Both after the configuration, because both need what it says: which
    // language this instance writes in, and whether there is an icon at all.
    const [{ catalogue }, icon] = await Promise.all([
      this.catalogues.resolve(config.defaultLocale),
      config.appIconUrl ? this.branding.describe('app-icon') : null,
    ]);

    const manifest = buildWebManifest({
      organizationName: config.organizationName,
      // `resolve` fills every gap with English (E23), so this cannot be
      // undefined for a key the image ships.
      description: catalogue[DESCRIPTION_KEY] ?? '',
      locale: config.defaultLocale,
      themeColor: config.theme.primaryColor,
      appIcon: config.appIconUrl
        ? {
            url: config.appIconUrl,
            width: icon?.dimensions?.width ?? null,
            height: icon?.dimensions?.height ?? null,
          }
        : null,
    });

    return { manifest, etag: webManifestEtag(manifest) };
  }
}
