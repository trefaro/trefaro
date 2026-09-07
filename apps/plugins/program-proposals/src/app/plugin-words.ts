import {
  PROGRAM_PROPOSALS_MODULE_KEY,
  pluginCataloguePrefix,
} from '@trefaro/shared-models';

/** This plug-in's catalogue namespace, for the fallback below. */
const PREFIX = pluginCataloguePrefix(PROGRAM_PROPOSALS_MODULE_KEY);

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
 * A function rather than a template pipe: this bundle carries no translation
 * library, and it does not need one — the host resolves the words and reassigns
 * them on a language switch.
 */
export function word(
  strings: Readonly<Record<string, string>>,
  key: string,
): string {
  return strings[key] ?? `${PREFIX}${key}`;
}

/**
 * The status of a proposal, as a word.
 *
 * One place, because three screens show it: the participant's list, the
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
