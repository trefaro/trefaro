/**
 * Port for per-item sign-up (FR 3.10).
 *
 * Three of its methods deserve their shape explained, because each one is a
 * layering decision rather than a convenience:
 *
 * - **{@link ProgramItemSignupRepository.countByItems}** — the counts of a whole
 *   programme in one query. Every list of programme items carries them, so the
 *   alternative is one query per session on the public landing page.
 * - **{@link ProgramItemSignupRepository.signUp}** takes the capacity and
 *   answers with an outcome instead of letting the caller count first and insert
 *   afterwards. The *rule* stays in the business layer, which is what decides
 *   which capacity applies; the *atomicity* is a data access concern, and only
 *   there can it be honoured — two people claiming the last seat in the same
 *   millisecond is exactly what a check-then-insert cannot survive.
 * - **{@link ProgramItemSignupRepository.findParticipants}** returns names and
 *   addresses, joined in the data access layer. One query for the organizer's
 *   load view rather than a list of ids the business layer resolves row by row.
 */

/** One person's seat, as the self-service page needs it. */
export interface ProgramItemSignupRecord {
  readonly programItemId: string;
  readonly registrationId: string;
  readonly createdAt: Date;
}

/**
 * Who signed up for one session, for the organizer's load view.
 *
 * The address is part of it deliberately: showing it in the table rather than
 * one click away is the single correction the usability test of the thesis
 * produced, and it applies wherever an organizer looks at participants.
 */
export interface ProgramItemParticipant {
  readonly registrationId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly signedUpAt: Date;
}

export interface SignUpRequest {
  readonly programItemId: string;
  readonly registrationId: string;
  /** The limit the business layer decided applies; `null` for "no limit". */
  readonly capacity: number | null;
}

/**
 * What happened, in the words the caller has to distinguish.
 *
 * `already-signed-up` is not an error: somebody clicked twice, or two tabs were
 * open. It is reported rather than swallowed so the caller can tell "you have a
 * seat" from "you just took the last one".
 */
export type SignUpOutcome = 'created' | 'already-signed-up' | 'full';

export interface ProgramItemSignupRepository {
  /** Everything this registration has claimed a seat in. */
  findByRegistration(
    registrationId: string,
  ): Promise<readonly ProgramItemSignupRecord[]>;
  /**
   * Sign-ups per session id, in one query.
   *
   * Sessions with none are absent from the map rather than present with a zero —
   * the caller reads it with a default, and an absent key is the honest answer.
   */
  countByItems(
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>>;
  /** Atomic against the capacity; see the note on this port. */
  signUp(request: SignUpRequest): Promise<SignUpOutcome>;
  /** False when there was no seat to give up. */
  signOff(programItemId: string, registrationId: string): Promise<boolean>;
  /** Who is coming, oldest sign-up first — the order seats were claimed in. */
  findParticipants(
    programItemId: string,
  ): Promise<readonly ProgramItemParticipant[]>;
}

export const PROGRAM_ITEM_SIGNUP_REPOSITORY = Symbol(
  'TREFARO_PROGRAM_ITEM_SIGNUP_REPOSITORY',
);
