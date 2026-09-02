/**
 * What counts as a usable password — for an organizer and for a participant.
 *
 * Length only, no character classes: NFR 4 targets people with rudimentary IT
 * skills, and composition rules push them towards "Passwort1!" while a long
 * passphrase is both stronger and easier to remember.
 *
 * Shared rather than mirrored. The server is still the authority and checks
 * every password against these bounds itself (`business/common/password-policy`
 * imports them) — what moved here is the *number*, because by the time the
 * participant client got a registration form and a password change there were
 * four forms in two clients each carrying its own copy with a comment saying
 * the server was the real rule. A policy copied five times is a policy that
 * will be tightened in one place (F138).
 */
export const MIN_PASSWORD_LENGTH = 12;

/** Upper bound, so a request cannot make the server hash megabytes. */
export const MAX_PASSWORD_LENGTH = 256;
