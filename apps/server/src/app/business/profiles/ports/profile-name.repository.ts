/**
 * Port for what an account is **called** (E33, F55).
 *
 * A third read port over `user_profile`, and the difference from the two that
 * exist is the access rule, which is what makes it a port rather than a
 * duplicate (server-layers: two ports over one table are no duplicate when the
 * difference is the access rule):
 *
 * - `UserProfileRepository` can read a whole account, including the password
 *   hash, and write to it. That is right for the module the accounts belong to
 *   and far too much for anyone else.
 * - `SearchableProfileRepository` cannot return a profile that did not opt into
 *   the directory (E37, F13) — deliberately, because being **found** and being
 *   **written to** are what that switch means.
 *
 * Neither fits the question a plug-in asks. Somebody who submits a programme
 * proposal or writes a forum post has put their name on something inside the
 * logged-in area on purpose, and a list of "anonymous" rows is not what FR 3.13
 * and FR 4.6 describe — so this port answers for any **confirmed** account,
 * opted into the directory or not. Confirmed, because an unconfirmed address has
 * not answered and the name on it is not yet known to belong to anybody (E32);
 * that condition is in the statement rather than in a caller (F152).
 *
 * What it cannot answer is everything else. There is no address here — an
 * address is the identity (E31) and mail is addressed through a foreign key
 * (F55) — no search, and no way to ask who exists. A caller resolves ids it
 * already stored.
 */

/** As much of an account as its name and picture need. */
export interface ProfileNameRecord {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  /**
   * The stored path of the picture, or `null` (F124).
   *
   * Never handed out: what a reader gets is the media route built from the id
   * and `updatedAt`, which is why that timestamp travels with the row.
   */
  readonly avatarPath: string | null;
  readonly updatedAt: Date;
}

export interface ProfileNameRepository {
  /**
   * The accounts behind a set of ids, keyed by id.
   *
   * One statement for the whole list (F49) — every caller is rendering one.
   * An id with no confirmed account is simply absent from the map, which is the
   * honest answer for "gone" and for "never answered" alike.
   */
  findNames(
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, ProfileNameRecord>>;
}

export const PROFILE_NAME_REPOSITORY = Symbol(
  'TREFARO_PROFILE_NAME_REPOSITORY',
);
