/**
 * What the instance knows about an account without reading a profile (E31).
 *
 * Three questions, one table, three modules — which is exactly why this port
 * lives in `business/common/ports/` (F100). The participant overview asks
 * whether an address has an account (FR 3.3), the mail composer asks which
 * language that account chose to be written to in (E24), and since AP 7 of
 * phase 4 the plug-in host asks which address one account is (E31). None of the
 * three askers may see a profile: the organizer's table shows a yes/no and
 * never an id (F124), a mail is addressed through a foreign key rather than by
 * looking somebody up (F55), and a plug-in never receives the address at all —
 * the host uses it to resolve registrations and hands over names.
 *
 * Deliberately not `UserProfileRepository` handed to two more modules. That
 * port can read and write a person's whole account, and the module that owns
 * accounts is the one that may (E33). What the two askers need is narrower than
 * a row, so they get a port that cannot answer anything else — the same
 * reasoning as `RegistrationTally` and `ProgramTally`.
 *
 * Addresses are compared case-insensitively throughout: an address is the
 * identity, and identities are not case-sensitive (E31, `unique (lower(email))`).
 */
export interface ProfileDirectory {
  /**
   * Which of these addresses have a **confirmed** account.
   *
   * The answer holds the addresses as they were asked for, so a caller can look
   * up its own rows without normalizing twice. Addresses that have no account —
   * or one whose double opt-in is still outstanding — are simply absent: an
   * account nobody has confirmed cannot be logged into (E32), so calling it a
   * profile would tell the organizer something they cannot rely on.
   *
   * Many addresses in one call rather than one call per row: the participant
   * overview is the highest-rated screen of the product (3,86/4) and it renders
   * one page of registrations at a time, which must not become one query per
   * line.
   */
  withAccount(emails: readonly string[]): Promise<ReadonlySet<string>>;

  /**
   * The language the person behind this address chose, or `null`.
   *
   * Unconfirmed accounts count here, and that is the difference from
   * {@link withAccount}. The one mail an unconfirmed account ever receives is
   * its own confirmation request, and the language it should be written in is
   * the one that was picked on the form a moment earlier — refusing to read it
   * until the link in that very mail has been clicked would be a circle.
   */
  localeFor(email: string): Promise<string | null>;

  /**
   * The address of one **confirmed** account, or `null` (E31, F148).
   *
   * The inverse of {@link withAccount}, and the one question that makes the
   * self-service claim of a session resolvable from outside the profiles
   * module: the registrations of a person are the ones carrying their address,
   * because there is no `user_id` to join on. Introduced for the plug-in
   * registration port of AP 7 — a plug-in holds a participant id and must
   * never hold an address, so the host resolves one from the other.
   *
   * Confirmed only, in the statement rather than in a caller (F152): an
   * account whose double opt-in is outstanding cannot be logged into (E32), so
   * an answer for one would be an address nobody has proven they hold.
   */
  addressOf(participantId: string): Promise<string | null>;
}

export const PROFILE_DIRECTORY = Symbol('TREFARO_PROFILE_DIRECTORY');
