/**
 * How many self-service calls one address may make per five minutes.
 *
 * The same order of magnitude as confirming (E4): the token is guessable in
 * principle, if not in practice, and every call costs an HMAC. Generous enough
 * for a page that reloads its whole view after every sign-up, which it does on
 * purpose — a seat can go while the page is open.
 *
 * In its own file so both controllers can read it without one importing the
 * other.
 */
export const SELF_SERVICE_CALLS_PER_WINDOW = 60;
