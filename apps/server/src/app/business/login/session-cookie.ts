import type { CookieOptions } from 'express';
import type { TrefaroEnv } from '../../core/config/env';

/** Name of the cookie carrying the administrative session token. */
export const ADMIN_SESSION_COOKIE = 'trefaro_admin_session';

/**
 * Cookie flags for the administrative session.
 *
 * `SameSite=Lax` is enough — and works identically in development and
 * production — because both clients reach the API same-origin: the Angular dev
 * server proxies `/api`, and NGINX does the same in front of the containers. No
 * `SameSite=None` means no cross-site request can carry the session, which is
 * what removes the need for a separate CSRF token. The price is a rule the rest
 * of the API has to keep: **nothing that changes state may be a GET.**
 *
 * `Path=/api` keeps the cookie off requests for static client assets.
 */
export function adminSessionCookieOptions(
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
