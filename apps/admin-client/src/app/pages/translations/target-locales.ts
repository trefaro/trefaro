import type { AppConfig } from '@trefaro/shared-models';
import { FALLBACK_LOCALE } from '@trefaro/shared-models';

/**
 * Which languages a translation screen offers tabs for (FR 3.12, E25).
 *
 * In one function because both screens ask it and the answer is three decisions
 * rather than a list:
 *
 * 1. **What the instance offers.** E25 makes the target languages the
 *    `active_locales` — the languages an organization has decided to show
 *    visitors, not some separate list to maintain.
 * 2. **Minus the default one.** The main form *is* the default language. A tab
 *    for it would be a second place to write the same sentence, and the two
 *    could then disagree about what the event is called.
 * 3. **Plus whatever is already translated.** Taking a language off the offer
 *    keeps its translations (E30); a tab that vanished with the offer would
 *    leave that work unreachable and invisible.
 */
export function targetLocales(
  config: AppConfig | null | undefined,
  translated: readonly string[],
): readonly string[] {
  const fallback = config?.defaultLocale ?? FALLBACK_LOCALE;
  const offered = config?.availableLocales ?? [];
  return [...new Set([...offered, ...translated])]
    .filter((locale) => locale !== fallback)
    .sort();
}
