/**
 * Port for the participant search (FR 4.4).
 *
 * A read-only window on `user_profile`, and deliberately **not**
 * `UserProfileRepository`: that one can read a whole account, including the
 * password hash, and write to it — which is right for the module the accounts
 * belong to (E33) and far too much for a directory. The rule from
 * `ProfileDirectory` applies again: a question about somebody else gets its own
 * narrow port.
 *
 * The one property worth stating: **no method here can return a hidden
 * profile.** Both statements carry `searchable = true` and a confirmed address,
 * so the opt-in of E37 is a condition of the query rather than a filter a
 * caller has to remember — including the caller that fetches one profile by id,
 * which is the one that would forget.
 */

import type { CustomFieldValues } from '@trefaro/shared-models';

/** A findable profile in business-layer terms — no ORM types. */
export interface SearchableProfileRecord {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  /**
   * The stored path of the picture, or `null` (F124).
   *
   * Never handed out: what a client gets is the media route built from the id
   * and `updatedAt`, which is why that timestamp travels with the row.
   */
  readonly avatarPath: string | null;
  readonly activityAreas: string | null;
  readonly customFields: CustomFieldValues;
  readonly updatedAt: Date;
}

/**
 * One page of the search.
 *
 * Two word lists rather than one string, because the two boxes on the screen
 * ask different questions: {@link terms} has to appear in the name **or** the
 * field of activity, {@link activityTerms} in the field of activity alone. Both
 * are `AND`-joined per word (F32, F126) — "amina okonkwo" finds the person
 * whichever order the names are typed in.
 */
export interface SearchableProfileSearch {
  readonly terms: readonly string[];
  readonly activityTerms: readonly string[];
  /**
   * The reader's own profile, which never appears in their own search.
   *
   * Passed in rather than filtered afterwards, because a row dropped after the
   * window would make a page of twenty nineteen — and the count wrong.
   */
  readonly excludeId: string;
  readonly offset: number;
  readonly limit: number;
}

export interface SearchableProfileSlice {
  readonly rows: readonly SearchableProfileRecord[];
  /** What the pages divide, counted in the same statement as the window. */
  readonly total: number;
}

export interface SearchableProfileRepository {
  search(query: SearchableProfileSearch): Promise<SearchableProfileSlice>;
  /**
   * One profile, if it shows itself at all.
   *
   * `null` covers three cases on purpose — no such id, an unconfirmed account,
   * a profile that did not opt in — because the answer above it is the same
   * 404 for all three. A repository that distinguished them would invite a
   * caller to distinguish them too, and that caller would be telling a reader
   * which ids exist.
   */
  findVisible(id: string): Promise<SearchableProfileRecord | null>;
}

export const SEARCHABLE_PROFILE_REPOSITORY = Symbol(
  'TREFARO_SEARCHABLE_PROFILE_REPOSITORY',
);
