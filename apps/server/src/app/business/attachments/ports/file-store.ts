/**
 * Port for the bytes of an uploaded file (E9).
 *
 * The business layer must not know where files live any more than it knows which
 * database holds the rows: the thesis' architecture asks for a data access layer
 * that can be replaced, and an instance that one day stores its files in object
 * storage should need a new implementation of this interface and nothing else.
 *
 * Whole buffers rather than streams, on purpose. Every file that reaches this
 * port has already been bounded — by `MAX_UPLOAD_BYTES` for an attachment, by
 * the much smaller `MAX_BRANDING_BYTES` for a logo — so the largest thing that
 * can be in flight is a few megabytes, and a stream would push the failure modes
 * of a half-written file into every caller.
 */

/**
 * Which subtree of the volume a file belongs to (E19).
 *
 * The one distinction the store has to know about, and it is not cosmetic: an
 * attachment can be a passport scan and is only ever handed to an authenticated
 * download, while a logo has to be visible to anonymous visitors. The two
 * therefore must not be able to be mistaken for one another anywhere — not in a
 * URL, not in a column (`CHK_app_config_branding_paths`), and not in a
 * directory listing. Separate subtrees are the version of that promise an
 * operator can verify with `ls`.
 */
export type FileArea = 'attachments' | 'branding';

export interface FileStore {
  /**
   * Writes bytes under a name this store generates, in the given area.
   *
   * @returns the path to keep, relative to the store's root. It begins with the
   * area, so a caller that stored a branding file can assert that it did.
   */
  save(area: FileArea, bytes: Buffer): Promise<string>;
  /** `null` when the path holds nothing — a file removed outside this store. */
  read(path: string): Promise<Buffer | null>;
  /**
   * Removes files, best effort.
   *
   * Best effort because the rows are already gone by the time this is called: a
   * file that cannot be unlinked is a leftover byte range to report, not a
   * reason to fail the request that deleted a registration.
   */
  remove(paths: readonly string[]): Promise<void>;
}

export const FILE_STORE = Symbol('TREFARO_FILE_STORE');
