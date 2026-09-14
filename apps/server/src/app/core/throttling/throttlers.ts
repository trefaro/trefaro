import { Reflector } from '@nestjs/core';
import { minutes, type ThrottlerOptions } from '@nestjs/throttler';
import type { RateLimitEnv } from '../config/rate-limits';
import { RATE_LIMIT_KIND, type RateLimitKind } from './rate-limit.decorator';

/**
 * The instance's rate limiters, built from its configuration (E60).
 *
 * `@nestjs/throttler` evaluates every throttler in this list for every request,
 * which is why each named one carries a `skipIf`: it applies to the routes that
 * asked for it with {@link RateLimit} and to no others. That indirection is the
 * whole point — a decorator cannot be injected into, so a route that spelled
 * out its number would freeze it at build time, and phase 5 is where those
 * numbers become configuration.
 *
 * The generous global default is unchanged and deliberately has no `skipIf`: a
 * client fetches the configuration and a handful of endpoints on startup, and
 * an organizer clicking through the participant list must never be throttled.
 */

/**
 * How long a window is, for every named limit.
 *
 * One number rather than five, because the limits were all written as "per five
 * minutes" and a window that varied per route would make the counts
 * incomparable — and each of the five doc comments argues about the count, none
 * about the window.
 */
const WINDOW = minutes(5);

/**
 * The generous bound every request counts against, handshakes included.
 *
 * Lives here rather than inline because it is not only the router's any more:
 * `handshake-throttle.ts` counts socket.io's own handshake against the same
 * budget, and two copies of one number are two numbers waiting to disagree.
 */
export const GLOBAL_LIMIT = 300;
export const GLOBAL_WINDOW = minutes(1);

/**
 * How long a login stays shut after the last attempt in a full window.
 *
 * The block, not the count, is what makes guessing pointless. It is not
 * configurable, and that is the decision: an operator may want a more forgiving
 * *count* for an office behind one address, but there is no instance for which
 * "keep trying immediately" is the right answer.
 */
const LOGIN_BLOCK = minutes(15);

/**
 * `Reflector` reads metadata off a class or a method and holds no state of its
 * own, so one instance serves every `skipIf` — and a `skipIf` cannot be
 * injected into, because the throttler calls it as a plain function.
 */
const reflector = new Reflector();

/** True for every route that did not ask for this kind of limit. */
function everywhereBut(kind: RateLimitKind): ThrottlerOptions['skipIf'] {
  return (context) =>
    reflector.getAllAndOverride<RateLimitKind | undefined>(RATE_LIMIT_KIND, [
      context.getHandler(),
      context.getClass(),
    ]) !== kind;
}

export function buildThrottlers(limits: RateLimitEnv): ThrottlerOptions[] {
  return [
    { name: 'default', ttl: GLOBAL_WINDOW, limit: GLOBAL_LIMIT },
    {
      name: 'login',
      ttl: WINDOW,
      limit: limits.loginAttemptsPerWindow,
      blockDuration: LOGIN_BLOCK,
      skipIf: everywhereBut('login'),
    },
    {
      name: 'registration',
      ttl: WINDOW,
      limit: limits.registrationsPerWindow,
      skipIf: everywhereBut('registration'),
    },
    {
      name: 'newsletter-signup',
      ttl: WINDOW,
      limit: limits.newsletterSignupsPerWindow,
      skipIf: everywhereBut('newsletter-signup'),
    },
    {
      name: 'confirmation',
      ttl: WINDOW,
      limit: limits.confirmationsPerWindow,
      skipIf: everywhereBut('confirmation'),
    },
  ];
}
