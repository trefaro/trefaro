import { DOCUMENT, Injectable, effect, inject } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';

/**
 * Points iOS at the organization's app icon (FR 1.4, E26).
 *
 * The manifest covers Android and every desktop browser, and it is built from
 * the configuration by the server. Safari on iOS is the exception that still
 * reads `<link rel="apple-touch-icon">` out of the live document when somebody
 * chooses "Add to Home Screen" — so the whitelabel reaches an iPhone only if
 * this link follows the configuration too.
 *
 * The literal in `index.html` stays and is the fallback: an instance that has
 * uploaded no icon keeps the shipped one, which is exactly what the manifest
 * does with the same case.
 */
@Injectable({ providedIn: 'root' })
export class AppIconService {
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(AppConfigService);

  constructor() {
    effect(() => {
      const url = this.config.config()?.appIconUrl;
      if (url) this.pointAt(url);
    });
  }

  private pointAt(url: string): void {
    const link = this.document.head?.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]',
    );
    if (link) link.href = url;
  }
}
