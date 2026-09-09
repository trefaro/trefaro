/**
 * How many ticket lookups one caller may make per five minutes.
 *
 * The rule of `/api/user/**` (E4): a token is guessable in principle, if not in
 * practice, and every call costs an HMAC — so the anonymous ticket route
 * carries a budget of its own, the same order of magnitude as the self-service
 * page it is mounted on. Behind a session the global limit applies, which is
 * why the participant's route declares nothing.
 *
 * In its own file rather than in the controller so the value has one home; the
 * host's own constant is out of reach for a plug-in, and copying a number is
 * how two budgets drift apart.
 */
export const TICKET_CALLS_PER_WINDOW = 60;
