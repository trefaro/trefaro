/**
 * Port for reading and writing the instance's whitelabel configuration.
 *
 * The business layer knows this interface; the data access layer implements it.
 * That inversion is what keeps a database change confined to one layer.
 */
import type {
  AppConfigChange,
  BrandingImageKind,
} from '@trefaro/shared-models';

/** The `app_config` row, in business-layer terms — no ORM types. */
export interface AppConfigRecord {
  readonly organizationName: string;
  readonly primaryColor: string;
  readonly accentColor: string;
  /**
   * Storage-relative path of the logo, or `null` while none is uploaded.
   *
   * Always inside the `branding/` subtree — the database refuses anything else
   * (`CHK_app_config_branding_paths`), because the public route serves whatever
   * this points at and must never be able to serve an attachment (E19).
   */
  readonly logoPath: string | null;
  /** The same for the square PWA icon (E26). */
  readonly appIconPath: string | null;
  /** A key of `FONT_FAMILIES`, not a CSS stack (E18). */
  readonly fontFamily: string;
  readonly defaultLocale: string;
  /** Locales the organization maintains; English is always among them. */
  readonly availableLocales: readonly string[];
  /**
   * When the row last changed — the version in the branding image URLs (E19).
   *
   * A new image is a new URL, which is what lets the bytes be served
   * `immutable`: the clients read `/api/config` on every start, so they learn
   * the new URL before they could show a stale image. It bumps on any change to
   * the row, so changing a colour also re-fetches the logo once. That is the
   * cheaper mistake — the alternative, a version per image, is a second column
   * that has to be kept in step with the first.
   */
  readonly updatedAt: Date;
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

  /**
   * Points a branding image at stored bytes, or clears it.
   *
   * Separate from {@link save} because it is not a setting an administrator
   * types: the value is a path this application generated when it wrote the
   * file, and `AppConfigChange` — the body of the design page's `PATCH` — must
   * not be able to carry one.
   *
   * Takes the kind rather than a column name, so which column belongs to which
   * image is decided once, in the layer that knows the columns.
   */
  setBrandingImage(
    kind: BrandingImageKind,
    storedPath: string | null,
  ): Promise<AppConfigRecord>;
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
