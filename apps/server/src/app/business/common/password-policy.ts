/**
 * What counts as a usable password — for an organizer and for a participant.
 *
 * One place, so every way an account can come into being is held to the same
 * rule: the bootstrap administrator from the environment, an account created
 * through the administration, and a participant registering themselves (FR 4.1).
 * Length only, no character classes: NFR 4 targets people with rudimentary IT
 * skills, and composition rules push them towards "Passwort1!" while a long
 * passphrase is both stronger and easier to remember.
 *
 * Here rather than in `business/login/` since phase 3 (F100): two modules decide
 * whether a password is acceptable, and a policy copied into the second one is a
 * policy that will be tightened in exactly one of them.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** Upper bound so a request cannot make the server hash megabytes. */
export const MAX_PASSWORD_LENGTH = 256;

export function describePasswordPolicy(): string {
  return `A password must be at least ${MIN_PASSWORD_LENGTH} and at most ${MAX_PASSWORD_LENGTH} characters long`;
}

export function isUsablePassword(password: string): boolean {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH
  );
}
