import type { BrowserContext } from '@playwright/test';

/**
 * The cookie name the server issues, spelled once (E34).
 *
 * Not imported from the server: this file talks to a **browser**, and the name
 * is part of the HTTP surface rather than of a module. It is asserted against
 * the real thing wherever a suite signs in through the form.
 */
const COOKIE = 'trefaro_user_session';

/**
 * Where the client remembers that this browser once had a session (F143).
 *
 * The participant client asks `GET /api/participant/me` only when this is set:
 * its normal state is anonymous, and probing on every public page load meant a
 * 401 in the console of every visit. A seeded cookie without the hint is
 * therefore a session the client never notices — which is exactly the bug this
 * function exists to avoid.
 */
const HINT = 'trefaro.participant-session';

/**
 * Signs a browser context in with a seeded session (F164).
 *
 * Two things, because the client needs both: the cookie the server would have
 * set, on the path it sets it for (`/api` — which is also why the chat socket
 * lives there, F160), and the local hint that makes the client ask who it is.
 *
 * `addInitScript` rather than a navigation plus `localStorage.setItem`: it
 * runs before the application's own scripts on **every** page of the context,
 * so a test may start on any address.
 */
export async function signInWithSeededSession(
  context: BrowserContext,
  clientUrl: string,
  token: string,
): Promise<void> {
  const { hostname } = new URL(clientUrl);

  await context.addCookies([
    {
      name: COOKIE,
      value: token,
      domain: hostname,
      path: '/api',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    },
  ]);

  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [HINT, 'yes'],
  );
}

/** The header a seeded session travels in when a test speaks HTTP itself. */
export function sessionHeader(token: string): Record<string, string> {
  return { cookie: `${COOKIE}=${token}` };
}
