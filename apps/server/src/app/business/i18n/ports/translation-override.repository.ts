/**
 * Port for the instance's own changes to the shipped catalogue (E22).
 *
 * Split in two halves that share one token: {@link TranslationOverrideReader} is
 * what serving a catalogue needs, {@link TranslationOverrideRepository} adds the
 * write the language administration does. The same reasoning as `AppConfigReader`
 * — a dependency says what it needs rather than what exists, so the service that
 * answers `GET /api/i18n/:locale` cannot write a translation.
 */
export interface TranslationOverrideRecord {
  readonly locale: string;
  readonly key: string;
  readonly value: string;
  readonly updatedAt: Date;
}

export interface TranslationOverrideReader {
  /**
   * Every change stored for one language.
   *
   * The whole language rather than a page of it: a catalogue is served as a
   * whole, and the largest one imaginable is the shipped key list — a few
   * hundred short strings. This is the one list in the application that is
   * deliberately unpaginated, and it is bounded by the image rather than by the
   * organization's data.
   */
  findByLocale(locale: string): Promise<readonly TranslationOverrideRecord[]>;

  /** Which languages have at least one stored change (AP 7's locale list). */
  localesWithOverrides(): Promise<readonly string[]>;
}

/** One key and the text the organization wants under it. */
export interface TranslationOverrideValue {
  readonly key: string;
  readonly value: string;
}

/** What a single write to one language does — see {@link apply}. */
export interface TranslationOverrideChange {
  readonly locale: string;
  readonly write: readonly TranslationOverrideValue[];
  readonly remove: readonly string[];
}

export interface TranslationOverrideRepository extends TranslationOverrideReader {
  /**
   * Writes and removes rows of one language, all of it or none of it.
   *
   * One method rather than an `upsert` and a `remove`, because both an edit of a
   * single key and an import of a whole file are the same operation with
   * different sizes — and an import that failed half way through would leave a
   * language nobody can reason about. The same shape as the programme's
   * re-ordering: the change is described in full and applied in a transaction,
   * rather than assembled from a sequence of small writes.
   *
   * A key appearing in both lists is a caller's mistake; the layer above builds
   * the two lists from one map, so it cannot happen.
   */
  apply(change: TranslationOverrideChange): Promise<void>;
}

export const TRANSLATION_OVERRIDE_REPOSITORY = Symbol(
  'TREFARO_TRANSLATION_OVERRIDE_REPOSITORY',
);
