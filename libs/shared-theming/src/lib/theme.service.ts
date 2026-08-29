import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import type { Theme } from '@trefaro/shared-models';
import { deriveThemeVariables } from './theme-variables';

/** Theme used until the configuration has been fetched, and if it cannot be. */
export const FALLBACK_THEME: Theme = {
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
  logoUrl: null,
  fontFamily: 'system-ui, sans-serif',
};

/**
 * Applies the whitelabel theme to the document (FR 1.4).
 *
 * Writes the derived custom properties onto the root element, so a change takes
 * effect immediately across the whole application *and* inside every plug-in
 * web component — custom properties inherit through shadow DOM, which is what
 * lets plug-ins ship without any CSS of their own.
 *
 * Since AP 12 it also writes `<meta name="theme-color">`, which is the one part
 * of the brand that is painted *outside* the document: the browser's own chrome
 * on Android, and the title bar of an installed client. It was a literal in both
 * `index.html` files until then, so a branded instance had the organization's
 * colour on the page and Trefaro's around it.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<Theme>(FALLBACK_THEME);

  /** The active theme, for components that need a value rather than a variable. */
  readonly theme = this.current.asReadonly();

  /** Whether the organization has uploaded a logo. */
  readonly hasLogo = computed(() => this.current().logoUrl !== null);

  apply(theme: Theme): void {
    this.current.set(theme);

    const root = this.document.documentElement;
    for (const [property, value] of Object.entries(
      deriveThemeVariables(theme),
    )) {
      root.style.setProperty(property, value);
    }

    this.applyThemeColor(theme.primaryColor);
  }

  /**
   * The colour the browser paints around the page.
   *
   * The tag is created when it is missing rather than required in the document:
   * this service applies a theme to whatever document it is given, and a test
   * fixture or a future third surface should not have to remember a `<meta>`.
   * An installed client keeps the colour it was installed with — that one comes
   * from the manifest (E26), and this is the running page.
   */
  private applyThemeColor(color: string): void {
    const head = this.document.head;
    if (!head) return;

    const existing = head.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const meta = existing ?? this.document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    if (!existing) head.appendChild(meta);
  }
}
