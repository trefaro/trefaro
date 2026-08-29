/**
 * What the language administration reads and writes (chapter 4, AP 7 of phase 2).
 *
 * The screen behind these types is the one that makes E22 more than a promise:
 * an organization adds a language, translates it key by key, sees how far it has
 * got, and offers it to visitors — without anybody rebuilding an image.
 */

/** How one key stands in one language. */
export type TranslationState =
  /** The organization wrote its own text for this key. */
  | 'overridden'
  /** The image ships this language's text and it stands unchanged. */
  | 'shipped'
  /** Nothing in this language; a client receives the English text (E23). */
  | 'missing';

/**
 * One key, in one language, with everything the editor needs beside it.
 *
 * All four texts rather than just the effective one, because the questions the
 * screen has to answer are "what does this mean" (the English), "what did the
 * image ship" (so a reset has something to fall back to), "what did we write"
 * and "what will a visitor see". They differ often enough that deriving one from
 * the others would be guesswork.
 */
export interface TranslationEntry {
  readonly key: string;
  /**
   * The shipped English text — the key list and the last link of the chain.
   *
   * Always present: a key that English does not have is not a key (E23).
   */
  readonly english: string;
  /** This language's shipped text, or `null` when the image ships none. */
  readonly shipped: string | null;
  /** The organization's own text, or `null`. */
  readonly override: string | null;
  /** What `GET /api/i18n/:locale` actually answers for this key. */
  readonly value: string;
  readonly state: TranslationState;
}

/**
 * One language, as the list of languages shows it.
 *
 * `shipped` and `active` are independent on purpose: a language exists because
 * somebody translated it, and offering it in the two clients is a separate
 * decision (E30). So a language can be shipped and not offered, offered and
 * barely translated, or translated and not yet offered.
 */
export interface LocaleSummary {
  readonly locale: string;
  /** This image ships a catalogue for it. */
  readonly shipped: boolean;
  /** It is offered in both clients (`app_config.active_locales`). */
  readonly active: boolean;
  /** It is the language of outgoing mail and of a first-time visitor. */
  readonly isDefault: boolean;
  /** Keys in the shipped English catalogue — the denominator of the figure. */
  readonly total: number;
  /** Keys this language has a text of its own for; the numerator. */
  readonly translated: number;
  /** Rows the organization wrote — never more than {@link translated}. */
  readonly overrides: number;
}

/** The list of languages plus the one value that is not per language. */
export interface LocaleOverview {
  readonly defaultLocale: string;
  readonly locales: readonly LocaleSummary[];
}

/** One language with every key of the catalogue — the editor's payload. */
export interface LocaleCatalogueDetail extends LocaleSummary {
  readonly entries: readonly TranslationEntry[];
}

/**
 * What a write to one language changed.
 *
 * Counted rather than echoed back key by key: the caller is either the editor,
 * which sent one key and re-reads the language anyway, or an import of a few
 * hundred, where the useful answer is a tally and the list of keys that were
 * *not* understood.
 */
export interface TranslationWriteResult {
  readonly locale: string;
  /** Keys whose stored text now differs from before. */
  readonly written: number;
  /** Keys whose stored row was removed — an empty value resets a key (F74). */
  readonly reset: number;
  /** Keys that were sent and already stood exactly so. */
  readonly unchanged: number;
  /**
   * Keys this image does not have, named rather than silently dropped (F75).
   *
   * A translation file from an older or newer image is the normal case, not a
   * mistake — so it is imported, and the difference is reported.
   */
  readonly ignored: readonly string[];
  /** The language as it stands after the write. */
  readonly summary: LocaleSummary;
}

/** The body of a write: keys to values, an empty value meaning "reset" (F74). */
export interface TranslationWrite {
  readonly entries: Readonly<Record<string, string>>;
}

/**
 * How many keys one write may carry.
 *
 * The whole catalogue plus room to grow: an import is the whole file, and
 * refusing it because the image grew would be a limit that only ever fires on
 * the legitimate case.
 */
export const MAX_TRANSLATION_WRITE_ENTRIES = 5000;

/**
 * How many unknown keys a write result names before it stops listing them.
 *
 * The count is in the tally regardless; this bounds the response body when
 * somebody imports a file from an entirely different application.
 */
export const MAX_REPORTED_IGNORED_KEYS = 25;

/**
 * How far a language has got, as a whole percent.
 *
 * Here rather than in the page, because three readers have to agree: the list of
 * languages, the editor's header and the test that proves the figure rises. Zero
 * keys reads as complete — an image with no catalogue has no gaps, and the
 * alternative (0 %) would say the opposite of what is true.
 */
export function translationCompleteness(summary: {
  readonly translated: number;
  readonly total: number;
}): number {
  if (summary.total <= 0) return 100;
  return Math.round((summary.translated / summary.total) * 100);
}
