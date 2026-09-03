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

/**
 * The session token a request carries, or `null`.
 *
 * The reader for everything that speaks HTTP: `cookie-parser` has already run,
 * so the work is one lookup — but it is a lookup under a name, and the name is
 * the point (see above). Two callers had written it out by hand before AP 11
 * added a third, and the third is the one that made it worth a function: the
 * push endpoint takes a session when there is one and works without it (E43),
 * so "no cookie" is an answer there rather than a 401.
 *
 * Deliberately not typed against `express.Request`: what this needs is the
 * parsed cookies, and a structural type says so without dragging a framework
 * into a file that is otherwise about one string.
 */
export function participantSessionFromRequest(request: {
  readonly cookies?: Record<string, string | undefined>;
}): string | null {
  const token = request.cookies?.[USER_SESSION_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/**
 * The session token out of a raw `Cookie:` header, or `null`.
 *
 * Beside the cookie's name rather than in the gateway that needs it, for the
 * reason the name is a constant at all: there is one participant cookie, and
 * anything that reads it has to read the same one.
 *
 * Why a second reader exists is the WebSocket handshake (E41). Express hands
 * an HTTP route a parsed `request.cookies`, because `cookie-parser` ran; a
 * socket.io handshake carries the header unparsed, so the one thing this has
 * to do is find one name in it without pulling in a parser for a job of five
 * lines. `decodeURIComponent` because that is what Express does on the way
 * out; the token is base64url, so it changes nothing today and would matter
 * the day the token's alphabet does.
 */
export function participantSessionFromHeader(
  header: string | undefined,
): string | null {
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== USER_SESSION_COOKIE) continue;

    const value = part.slice(separator + 1).trim();
    if (value.length === 0) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      // A malformed escape is a malformed cookie, and a malformed cookie is
      // no session — not a reason to fail the request with a stack trace.
      return null;
    }
  }

  return null;
}
