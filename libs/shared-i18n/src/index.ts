/**
 * The language of both clients (chapter 4, E22-E24).
 *
 * Transloco with a loader that reads `GET /api/i18n/:locale` instead of a file
 * from this client's own image: "new languages must be maintainable by the
 * organization" rules out compile-time i18n and a bundled JSON file alike, since
 * both are changed only by rebuilding.
 *
 * The catalogues this image ships live beside this code in `catalogues/` and are
 * imported by nothing — the server reads them from disk and merges the
 * instance's own translations into them before answering.
 */
export { TrefaroCatalogueLoader } from './lib/catalogue-loader';
export { LanguageSwitcher } from './lib/language-switcher';
export { provideTrefaroTitles } from './lib/provide-trefaro-titles';
export { provideTrefaroTranslations } from './lib/provide-trefaro-translations';
export { provideTranslationsForTest } from './lib/testing';
export { TranslationService } from './lib/translation.service';
export { TrefaroTitleStrategy } from './lib/title.strategy';
