/**
 * Port for reading and writing the instance's whitelabel configuration.
 *
 * The business layer knows this interface; the data access layer implements it.
 * That inversion is what keeps a database change confined to one layer.
 */

/** The `app_config` row, in business-layer terms — no ORM types. */
export interface AppConfigRecord {
  readonly primaryColor: string;
  readonly accentColor: string;
  /** Storage-relative path of the logo, or `null` while none is uploaded. */
  readonly logoPath: string | null;
  readonly fontFamily: string;
  readonly defaultLocale: string;
  /** Locales the organization maintains; English is always among them. */
  readonly availableLocales: readonly string[];
}

export interface AppConfigRepository {
  /** Returns the single configuration row, seeding defaults if absent. */
  load(): Promise<AppConfigRecord>;
}

export const APP_CONFIG_REPOSITORY = Symbol('TREFARO_APP_CONFIG_REPOSITORY');
