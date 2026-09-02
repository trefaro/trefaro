import type { CookieOptions } from 'express';
import type { TrefaroEnv } from '../../core/config/env';

/** Name of the cookie carrying the participant session token. */
export const USER_SESSION_COOKIE = 'trefaro_user_session';

/**
 * Cookie flags for a participant session — the administrative ones, exactly.
 *
 * Its own name and its own function rather than a shared helper with a cookie
 * name passed in: the two cookies exist side by side on purpose (E34), and an
 * organizer who is also a participant has both open at once. What they must
 * never share is the possibility of one being set with the other's name.
 *
 * `SameSite=Lax` for the reason spelled out beside the administrative cookie:
 * both clients reach the API same-origin, so no cross-site request can carry
 * the session, which is what removes the need for a separate CSRF token. The
 * price is a rule the rest of the API has to keep: **nothing that changes state
 * may be a GET.**
 *
 * `Path=/api` keeps the cookie off requests for static client assets.
 */
export function userSessionCookieOptions(
  env: TrefaroEnv,
  expiresAt?: Date,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/api',
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
