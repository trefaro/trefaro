/**
 * Port for the instance's own changes to the shipped catalogue (E22).
 *
 * Read-only for now: AP 6 serves the catalogue, AP 7 gives an organization the
 * screen that writes it. The write methods arrive with the screen — a port
 * method nothing calls is the same kind of prop as a switch nothing reads (E21).
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

export const TRANSLATION_OVERRIDE_REPOSITORY = Symbol(
  'TREFARO_TRANSLATION_OVERRIDE_REPOSITORY',
);
