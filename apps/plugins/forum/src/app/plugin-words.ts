import {
  FORUM_MODULE_KEY,
  pluginCataloguePrefix,
} from '@trefaro/shared-models';

/** This plug-in's catalogue namespace, for the fallback below. */
const PREFIX = pluginCataloguePrefix(FORUM_MODULE_KEY);

/**
 * One word out of what the host handed over (E48).
 *
 * The fallback is the **full key**, which is what a missing translation looks
 * like everywhere else in this application: a bundle mounted by a host that
 * predates plug-in API 1.2.0 says what it is missing instead of rendering empty
 * boxes. Derived from the plug-in key rather than written out, for the reason
 * `pluginCataloguePrefix` exists — two sides must spell one namespace the same
 * way.
 *
 * The same ten lines as in the proposals bundle, and knowingly so (F138): a
 * bundle imports models from `shared-models` and nothing else of the host, and
 * the third bundle that needs them is the one at which they move.
 */
export function word(
  strings: Readonly<Record<string, string>>,
  key: string,
): string {
  return strings[key] ?? `${PREFIX}${key}`;
}

/**
 * The status of a post, as a word.
 *
 * One place, because three screens show it: the chips in a thread, the
 * organizer's queue and the counts above it. The keys are `statusPending`,
 * `statusApproved`, `statusRejected` — one per state of E51, and there is no
 * fourth.
 */
export function statusWord(
  strings: Readonly<Record<string, string>>,
  status: string,
): string {
  return word(
    strings,
    `status${status.charAt(0).toUpperCase()}${status.slice(1)}`,
  );
}

/**
 * An instant in the reader's language and their own zone.
 *
 * Date **and** time, unlike the proposals' date alone: a forum is a
 * conversation, and "at nine" needs a clock. Not the exception to E8 it looks
 * like — E8 is about an *event's* times, which have a place; when somebody
 * wrote something has none. An unknown language tag must not empty the row.
 */
export function when(locale: string, iso: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}
