import { SetMetadata } from '@nestjs/common';

/**
 * The kinds of route that count against a limit of their own (E60).
 *
 * A kind, not a number: the numbers are configuration and live in the
 * environment, so a route that named one would pin it back down. What a route
 * knows is which door it is, and the doors are the ones the instance can be
 * attacked through without a session — four in AP 2, five since AP 4 added the
 * one that mails a way into an account.
 */
export type RateLimitKind =
  | 'login'
  | 'registration'
  | 'newsletter-signup'
  | 'confirmation'
  | 'password-reset';

/** Metadata key carrying a route's {@link RateLimitKind}. */
export const RATE_LIMIT_KIND = 'trefaro:rate-limit-kind';

/**
 * Declares which configured limit a route counts against.
 *
 * Replaces the `@Throttle({ default: { limit: SOME_CONSTANT } })` these routes
 * carried until phase 5. The difference is where the number comes from: the
 * decorator names a kind, `buildThrottlers` reads the number for that kind out
 * of the validated environment, and an operator can move it without a rebuild.
 *
 * The global default still applies on top — a named limit tightens, it never
 * loosens.
 */
export const RateLimit = (
  kind: RateLimitKind,
): MethodDecorator & ClassDecorator => SetMetadata(RATE_LIMIT_KIND, kind);
