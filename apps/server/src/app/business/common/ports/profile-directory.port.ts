/**
 * What the instance knows about an address without reading a profile (E31).
 *
 * Two questions, one table, two modules — which is exactly why this port lives
 * in `business/common/ports/` (F100). The participant overview asks whether an
 * address has an account (FR 3.3), and the mail composer asks which language
 * that account chose to be written to in (E24). Neither asker may see a
 * profile: the organizer's table shows a yes/no and never an id (F124), and a
 * mail is addressed through a foreign key rather than by looking somebody up
 * (F55).
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
}

export const PROFILE_DIRECTORY = Symbol('TREFARO_PROFILE_DIRECTORY');
