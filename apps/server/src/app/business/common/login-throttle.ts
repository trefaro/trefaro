/**
 * Login attempts allowed per address per five minutes, for every login there is.
 *
 * Twenty, then fifteen minutes of silence. The block is what makes guessing
 * pointless — roughly 1 900 attempts a day against an argon2id hash of a
 * passphrase of at least twelve characters is not an attack, it is a rounding
 * error. A tighter count was tried first and rejected for a practical reason
 * worth writing down: the whole test suite logs in from a single address, and a
 * limit it cannot survive gets relaxed for tests, which is how a limit stops
 * being tested at all.
 *
 * One number for the organizer login (UC 01) and the participant login (FR 4.2),
 * because the two are the same kind of door. Also read outside the server:
 * `tools/spike-verification/verify-admin-access.mjs` proves the block actually
 * happens, and the end-to-end suites have to stay below it.
 */
export const LOGIN_ATTEMPTS_PER_WINDOW = 20;
