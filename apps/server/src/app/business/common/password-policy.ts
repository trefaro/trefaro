import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@trefaro/shared-models';

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
 *
 * The two bounds themselves moved to `shared-models` in phase 3 AP 3, for the
 * same reason one step further out: four forms in two clients had each written
 * the number down beside a comment saying the server was the real rule. This
 * module stays the place that *applies* the policy — the server decides, and it
 * re-exports the numbers so its own callers need not know where they live.
 */
export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH };

export function describePasswordPolicy(): string {
  return `A password must be at least ${MIN_PASSWORD_LENGTH} and at most ${MAX_PASSWORD_LENGTH} characters long`;
}

export function isUsablePassword(password: string): boolean {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH
  );
}
