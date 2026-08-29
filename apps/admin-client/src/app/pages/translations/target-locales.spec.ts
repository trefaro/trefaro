import type { AppConfig } from '@trefaro/shared-models';
import { targetLocales } from './target-locales';

const config = (
  defaultLocale: string,
  availableLocales: readonly string[],
): AppConfig => ({ defaultLocale, availableLocales }) as AppConfig;

describe('targetLocales', () => {
  it('offers the languages the instance offers', () => {
    expect(targetLocales(config('en', ['en', 'de', 'fr']), [])).toEqual([
      'de',
      'fr',
    ]);
  });

  it('never offers the default language', () => {
    // The main form *is* the default language. A tab for it would be a second
    // place to write the same sentence, and the two could disagree.
    expect(targetLocales(config('de', ['en', 'de']), [])).toEqual(['en']);
  });

  it('keeps a language that has been taken off the offer but is translated', () => {
    // Removing a language from `active_locales` keeps its translations (E30);
    // a tab that vanished with the offer would leave that work unreachable.
    expect(targetLocales(config('en', ['en', 'de']), ['fr'])).toEqual([
      'de',
      'fr',
    ]);
  });

  it('names each language once, whichever side it came from', () => {
    expect(targetLocales(config('en', ['en', 'de']), ['de'])).toEqual(['de']);
  });

  it('is empty for an instance that offers one language', () => {
    // Then the page says so instead of showing a form with no tab above it.
    expect(targetLocales(config('en', ['en']), [])).toEqual([]);
  });

  it('survives a configuration that has not arrived yet', () => {
    expect(targetLocales(null, [])).toEqual([]);
    expect(targetLocales(undefined, ['de'])).toEqual(['de']);
  });
});
