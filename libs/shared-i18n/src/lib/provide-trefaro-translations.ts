import {
  EnvironmentProviders,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { FALLBACK_LOCALE } from '@trefaro/shared-models';
import { TrefaroCatalogueLoader } from './catalogue-loader';
import { TranslationService } from './translation.service';

/**
 * Startup step one and a half: fetch the interface's text (chapter 4, E22).
 *
 * The client start sequence is configuration, theme, plug-in web components.
 * This slots in behind the configuration, because it needs two values from it —
 * which languages this instance offers and which one it defaults to — and ahead
 * of the first render, because a screen that paints its keys and then its words
 * is worse than a screen that waits.
 *
 * Ordering is by dependency rather than by registration order:
 * `AppConfigService.ensureLoaded()` caches its promise, so this initializer and
 * the theme's await the same single request whichever runs first.
 *
 * A failed fetch does not block startup, exactly as with the configuration
 * (NFR 10). What a visitor then sees is the keys rather than the words — honest,
 * and only reachable when the server that would serve the content is down
 * anyway. `availableLangs` is announced at runtime and cannot be listed here: it
 * is a column from AP 7 onward.
 */
export function provideTrefaroTranslations(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        // Deliberately empty: the real list arrives with the configuration, and
        // a hard-coded one here would be a second, disagreeing answer.
        availableLangs: [],
        defaultLang: FALLBACK_LOCALE,
        fallbackLang: FALLBACK_LOCALE,
        // Verified before any text was moved: a language change repaints in a
        // zoneless client, pipe, structural directive and signal alike
        // (`zoneless-language-change.spec.ts`).
        reRenderOnLangChange: true,
        missingHandler: {
          // The server resolves every key down to English (E23), so a gap here
          // means the catalogue never arrived. Showing the key is then the
          // useful outcome; an empty string would look like a blank button.
          allowEmpty: false,
          // Fetching English as well would be a second request for a catalogue
          // the server has already merged into this one.
          useFallbackTranslation: false,
          logMissingKey: isDevMode(),
        },
        prodMode: !isDevMode(),
      },
      loader: TrefaroCatalogueLoader,
    }),
    provideAppInitializer(async () => {
      const config = inject(AppConfigService);
      const translations = inject(TranslationService);

      try {
        await config.ensureLoaded();
        await translations.start();
      } catch {
        // Reported by the API client's error mapping; startup continues.
      }
    }),
  ]);
}
