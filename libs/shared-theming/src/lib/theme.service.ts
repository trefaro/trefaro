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
  }
}
