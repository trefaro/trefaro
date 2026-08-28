/**
 * Port for reading and writing the instance's whitelabel configuration.
 *
 * The business layer knows this interface; the data access layer implements it.
 * That inversion is what keeps a database change confined to one layer.
 */
import type { AppConfigChange } from '@trefaro/shared-models';

/** The `app_config` row, in business-layer terms — no ORM types. */
export interface AppConfigRecord {
  readonly organizationName: string;
  readonly primaryColor: string;
  readonly accentColor: string;
  /** Storage-relative path of the logo, or `null` while none is uploaded. */
  readonly logoPath: string | null;
  /** A key of `FONT_FAMILIES`, not a CSS stack (E18). */
  readonly fontFamily: string;
  readonly defaultLocale: string;
  /** Locales the organization maintains; English is always among them. */
  readonly availableLocales: readonly string[];
}

export interface AppConfigRepository {
  /** Returns the single configuration row, seeding defaults if absent. */
  load(): Promise<AppConfigRecord>;

  /**
   * Writes the settings that were sent and returns the row as it now stands.
   *
   * A `PATCH`, not a replace: the design page edits four values, and the row
   * holds more than four. Returning the whole record saves the caller a second
   * read and means the answer cannot disagree with what was stored.
   *
   * Validation happens above this port — a repository that decided what a
   * legal colour is would put a product rule in the data access layer.
   */
  save(change: AppConfigChange): Promise<AppConfigRecord>;
}

/**
 * The reading half, for callers that have no business writing the theme.
 *
 * The mail module needs the default locale and (soon) the organization's name;
 * it must not be able to change the brand colours. Same token, narrower type —
 * the same reasoning as the counting ports (`RegistrationTally`): a dependency
 * says what it needs, not what exists.
 */
export type AppConfigReader = Pick<AppConfigRepository, 'load'>;

export const APP_CONFIG_REPOSITORY = Symbol('TREFARO_APP_CONFIG_REPOSITORY');
