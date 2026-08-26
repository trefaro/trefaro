/**
 * What counts as a usable administrator password.
 *
 * One place, so the bootstrap administrator from the environment and an account
 * created through the API are held to the same rule. Length only, no character
 * classes: NFR 4 targets people with rudimentary IT skills, and composition
 * rules push them towards "Passwort1!" while a long passphrase is both stronger
 * and easier to remember.
 */
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

/** Upper bound so a request cannot make the server hash megabytes. */
export const MAX_ADMIN_PASSWORD_LENGTH = 256;

export function describePasswordPolicy(): string {
  return `A password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} and at most ${MAX_ADMIN_PASSWORD_LENGTH} characters long`;
}

export function isUsablePassword(password: string): boolean {
  return (
    password.length >= MIN_ADMIN_PASSWORD_LENGTH &&
    password.length <= MAX_ADMIN_PASSWORD_LENGTH
  );
}
