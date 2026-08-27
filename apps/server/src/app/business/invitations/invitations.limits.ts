/**
 * How many objections one client address may record per five minutes.
 *
 * Low, because there is nothing legitimate to repeat: a person clicks the link
 * in their mail once, and a second click on the same link answers
 * `already-opted-out` without changing anything. The number is here to bound
 * the HMAC work behind a public endpoint, exactly as the confirmation limit is
 * (E4) — it is not a limit on how often somebody may say no.
 *
 * In its own file so the controller can read it without importing the module.
 */
export const OPT_OUT_CALLS_PER_WINDOW = 30;
