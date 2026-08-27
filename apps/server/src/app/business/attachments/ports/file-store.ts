/**
 * Port for the bytes of an uploaded file (E9).
 *
 * The business layer must not know where files live any more than it knows which
 * database holds the rows: the thesis' architecture asks for a data access layer
 * that can be replaced, and an instance that one day stores its files in object
 * storage should need a new implementation of this interface and nothing else.
 *
 * Whole buffers rather than streams, on purpose. Every file that reaches this
 * port has already been bounded by `MAX_UPLOAD_BYTES`, so the largest thing that
 * can be in flight is a few megabytes — and a stream would push the failure
 * modes of a half-written file into every caller.
 */
export interface FileStore {
  /**
   * Writes bytes under a name this store generates.
   *
   * @returns the path to keep, relative to the store's root.
   */
  save(bytes: Buffer): Promise<string>;
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
