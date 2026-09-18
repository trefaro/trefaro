import type { TranslationCatalogue } from '@trefaro/shared-models';
import { interpolate } from '../common/interpolate';

/**
 * The sentences the archive's `README.txt` is made of, in the order they appear.
 *
 * Six keys rather than one, because a paragraph is a unit somebody translates
 * (F80): an organization that wants to say something different about how long
 * an export is kept changes one line, not the whole letter. They live in the
 * catalogue like every other sentence, so a new language needs no rebuild
 * (E22) — and so this file holds the order and not the words.
 */
export const README_KEYS = [
  'privacy.export.readme.heading',
  'privacy.export.readme.exportedAt',
  'privacy.export.readme.data',
  'privacy.export.readme.files',
  'privacy.export.readme.notIncluded',
  'privacy.export.readme.deletion',
] as const;

/**
 * Renders the readme in one language.
 *
 * No whole-letter fallback the way a mail has one (E24): a mail cannot be
 * reloaded and an archive can be asked for again, and an archive that refused
 * to be German because one paragraph is untranslated would withhold a person's
 * data over a wording. The catalogue this is handed has already filled its gaps
 * with English (`CatalogueService.resolve`), so the worst case is one English
 * paragraph in a German file — visible, harmless, and fixable on the language
 * page.
 */
export function participantReadme(
  catalogue: TranslationCatalogue,
  params: Readonly<Record<string, string | number>>,
): string {
  return `${README_KEYS.map((key) =>
    interpolate(catalogue[key] ?? key, params),
  ).join('\n\n')}\n`;
}
