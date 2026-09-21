/**
 * Whether this instance serves the browsable API console beside its
 * description (AP 9 of phase 5).
 *
 * The question the security review had to answer was "should the OpenAPI
 * description keep being served publicly", and the answer is two answers,
 * because the address serves two different things.
 *
 * **The description stays public, everywhere.** The argument that was already
 * written beside it holds: this application is AGPL, its source is public, and
 * every path, parameter and response shape in the description is derivable
 * from that source in an afternoon. Hiding it would cost NFR 8 a documented
 * API and buy an attacker nothing they could not read in the repository. An
 * integrator — the pilot partner's website, a plug-in author — points a viewer
 * at `/api/docs-json` and is done.
 *
 * **The console does not run in production.** That is the half that is not the
 * same question: Swagger UI is a third-party bundle of a few hundred kilobytes
 * of JavaScript, served on the **same origin** as the organizer client behind
 * the reverse proxy. A flaw in it is a flaw with the organizer's origin, and
 * the session cookie being `HttpOnly` does not help — script on that origin can
 * simply make the request. On top of that its "Try it out" button is an
 * authenticated request console pointed at the instance, reachable by anybody
 * who can send an organizer a link. None of that is a risk a self-hosted
 * non-profit instance is taking in exchange for something; the description is
 * still there, and a development instance still renders it.
 *
 * A function rather than an inline comparison in `main.ts` because the decision
 * deserves a test of its own — and because the bootstrap is the one file in
 * this application that no unit test reaches.
 */
export function servesApiConsole(nodeEnv: string): boolean {
  return nodeEnv !== 'production';
}
