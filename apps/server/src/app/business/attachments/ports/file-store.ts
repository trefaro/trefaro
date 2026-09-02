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
 *
 * `logos` is the third, added for the per-series and per-event logos of FR 2.1
 * and FR 3.1. Its own subtree rather than a corner of `branding`, for the reason
 * that makes the distinction useful at all: `branding/` holds at most two files
 * and every one of them is referenced by `app_config`, so anything else in there
 * is a leak. Row logos are many and come and go with rows — mixing the two would
 * make both directories unreadable to an operator, and the check constraints
 * (`CHK_event_series_logo_path`, `CHK_event_logo_path`) would have to allow a
 * prefix that says nothing.
 *
 * `avatars` is the fourth, for the profile pictures of FR 4.3. Not a corner of
 * `logos` either, and here the distinction carries more than tidiness: a logo is
 * a brand and an avatar is a picture of a person. An operator has to be able to
 * see, and a `CHECK` has to be able to say, which of the two a stored path is —
 * `CHK_user_profile_avatar_path` allows nothing but this prefix.
 *
 * `messages` is the fifth, for the pictures sent in a chat (E40). Its row is an
 * `attachment` like a registration's file, which is exactly why it needs a
 * subtree of its own: `CHK_attachment_area` is what keeps the two kinds of
 * attachment apart, and the promise E9 makes about `attachments/` — never
 * served, only ever handed to an authenticated organizer — has to keep meaning
 * what it says. A picture in a conversation is served, to members of that
 * conversation, and so it lives somewhere else.
 */
export type FileArea =
  'attachments' | 'branding' | 'logos' | 'avatars' | 'messages';

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
