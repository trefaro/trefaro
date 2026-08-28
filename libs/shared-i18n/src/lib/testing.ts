import {
  EnvironmentProviders,
  importProvidersFrom,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import type { Translation } from '@jsverse/transloco';
import { FALLBACK_LOCALE } from '@trefaro/shared-models';

/**
 * Transloco for a unit test, without a server (chapter 4, E22).
 *
 * Every component whose template resolves a key needs the translation providers
 * in its `TestBed`, and from AP 8 onward that is nearly every component in both
 * clients. One function here rather than the same six lines in a hundred specs —
 * and one place to change when the configuration does.
 *
 * Called with nothing, it provides an **empty** catalogue: a missing key renders
 * as the key, which is what a spec asserting a button's behaviour wants to see
 * rather than a translation it would then have to maintain. A spec that is about
 * a label passes the strings it is about:
 *
 * ```ts
 * providers: [provideTranslationsForTest({ 'modules.push.title': 'Push' })]
 * ```
 *
 * The shipped catalogues are deliberately *not* the default. They are not
 * imported anywhere — not by the server, not by a client, and not here: a spec
 * that asserted against the real English text would fail on a wording change
 * that broke nothing, and a spec that needs a specific word should say which.
 *
 * Exported from the library's main entry point rather than from a `testing`
 * secondary one, for one function; it is a provider factory, so nothing pulls it
 * into a production bundle that does not call it.
 */
export function provideTranslationsForTest(
  catalogue: Readonly<Record<string, string>> = {},
): EnvironmentProviders {
  const langs: Record<string, Translation> = { [FALLBACK_LOCALE]: catalogue };

  return makeEnvironmentProviders([
    importProvidersFrom(
      TranslocoTestingModule.forRoot({
        langs,
        translocoConfig: {
          availableLangs: [FALLBACK_LOCALE],
          defaultLang: FALLBACK_LOCALE,
          fallbackLang: FALLBACK_LOCALE,
          reRenderOnLangChange: true,
          missingHandler: { allowEmpty: false, useFallbackTranslation: false },
        },
        preloadLangs: true,
      }),
    ),
  ]);
}
