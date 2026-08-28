import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FALLBACK_LOCALE, isTranslationKey } from '@trefaro/shared-models';
import type { TranslationCatalogue } from '@trefaro/shared-models';

/**
 * The shipped catalogues, held to E23.
 *
 * English is the key list. Everything else in this file follows from that: a
 * German key that English does not have is a typo nobody would ever see (the
 * resolution chain never asks for it), and a German key that is *missing* is a
 * hole in a language this image claims to ship. An organization's own language
 * may be 60 % translated and is measured for it (AP 7); a shipped one may not,
 * because there is nobody to measure it for.
 *
 * Read from disk rather than imported, for the same reason the server reads them
 * from disk: these files are data, and the test that guards them should fail on
 * the file that will be deployed rather than on a transpiled copy of it. From
 * the workspace root, not from `import.meta.url` — the test runner bundles this
 * file first, and the bundle's own URL is not a path on disk.
 */
const CATALOGUE_DIR = join(process.cwd(), 'libs', 'shared-i18n', 'catalogues');

function read(locale: string): TranslationCatalogue {
  const raw: unknown = JSON.parse(
    readFileSync(join(CATALOGUE_DIR, `${locale}.json`), 'utf8'),
  );
  return raw as TranslationCatalogue;
}

const shippedLocales = readdirSync(CATALOGUE_DIR)
  .filter((name: string) => name.endsWith('.json'))
  .map((name: string) => name.slice(0, -'.json'.length))
  .sort();

describe('the shipped catalogues', () => {
  const english = read(FALLBACK_LOCALE);
  const englishKeys = Object.keys(english);

  it('ship English and German', () => {
    // Not an inventory for its own sake: NFR 4 asks for English plus the
    // national language, and the setup wizard offers exactly the languages this
    // image can actually run in.
    expect(shippedLocales).toEqual(['de', 'en']);
  });

  it('has keys to translate at all', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });

  for (const locale of shippedLocales) {
    describe(locale, () => {
      const catalogue = read(locale);
      const entries = Object.entries(catalogue);

      it('is flat, with one string per key', () => {
        // A nested catalogue would make a key a path — and `translation_override`
        // stores a key, the completeness figure counts keys, and a template
        // writes a key.
        for (const [key, value] of entries) {
          expect(typeof value).toBe('string');
          expect(key).not.toContain('..');
        }
      });

      it('uses the key convention', () => {
        const offenders = Object.keys(catalogue).filter(
          (key) => !isTranslationKey(key),
        );
        expect(offenders).toEqual([]);
      });

      it('uses only keys English has', () => {
        const unknown = Object.keys(catalogue).filter(
          (key) => !(key in english),
        );
        expect(unknown).toEqual([]);
      });

      it('is complete', () => {
        const missing = englishKeys.filter((key) => !(key in catalogue));
        expect(missing).toEqual([]);
      });

      it('has no empty translation', () => {
        // An empty string resolves as present and renders as nothing, so it is
        // the one value that defeats the whole fallback chain.
        const empty = entries
          .filter(([, value]) => value.trim().length === 0)
          .map(([key]) => key);
        expect(empty).toEqual([]);
      });

      it('carries the same placeholders as the English text', () => {
        // `{{ count }}` in English and `{{ anzahl }}` in German is a string that
        // renders a literal `{{ anzahl }}` to a reader — and there is no compiler
        // between a catalogue and a template.
        for (const [key, value] of entries) {
          expect({ key, params: placeholders(value) }).toEqual({
            key,
            params: placeholders(english[key]),
          });
        }
      });
    });
  }
});

/** The interpolation names in a translated string, sorted and deduplicated. */
function placeholders(value: string): readonly string[] {
  return [
    ...new Set(
      [...value.matchAll(/{{\s*([^}\s]+)\s*}}/g)].map((match) => match[1]),
    ),
  ].sort();
}
