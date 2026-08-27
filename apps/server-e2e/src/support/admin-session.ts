import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { postJson } from './api-client';

/**
 * One administrative session for the whole API contract run.
 *
 * The login is rate limited on purpose — twenty attempts per five minutes, then
 * fifteen minutes of silence (`LOGIN_ATTEMPTS_PER_WINDOW`) — and the limit is
 * deliberately one the test suite has to live with rather than one that gets
 * relaxed for it. Every suite logging in for itself put the whole end-to-end job
 * within one login of that ceiling: the eighth contract suite tipped it over, and
 * the suite that happened to run next failed with 401 everywhere.
 *
 * So the session is established once, in the global setup, and handed to the
 * suites through a file. A file rather than an environment variable, because
 * whether Jest hands `process.env` from the global setup to a test file depends
 * on whether it decided to run in band.
 *
 * `admin-access.spec.ts` deliberately does *not* use this: it asserts the login
 * response itself, and it ends its own session by logging out — which would take
 * this one with it.
 */
export const SESSION_COOKIE = 'trefaro_admin_session';

/** Beside the build output, so a stale one cannot survive a clean checkout. */
const SESSION_FILE = resolve(
  __dirname,
  '../../../../dist/server-e2e/admin-session',
);

export function adminCredentials(): { email: string; password: string } {
  const email = process.env['ADMIN_BOOTSTRAP_EMAIL'] ?? '';
  const password = process.env['ADMIN_BOOTSTRAP_PASSWORD'] ?? '';
  if (!email || !password) {
    throw new Error(
      'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set for the ' +
        'API contract tests — the same values the server booted with, so the ' +
        'suite can log in. Add them to .env.',
    );
  }
  return { email, password };
}

/** Reads one cookie out of a `Set-Cookie` header list. */
export function cookieFrom(headers: Headers, name = SESSION_COOKIE): string {
  for (const header of headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [key, ...rest] = pair.split('=');
    if (key.trim() === name) return `${name}=${rest.join('=')}`;
  }
  return '';
}

/** Logs in once and leaves the cookie where {@link adminCookie} finds it. */
export async function establishAdminSession(): Promise<void> {
  const login = await postJson('/api/admin/auth/login', adminCredentials());
  const cookie = cookieFrom(login.headers);
  if (!cookie) {
    throw new Error(
      `Signing in for the API contract tests failed with status ${login.status}. ` +
        'A 429 here means the login rate limit is exhausted — wait fifteen ' +
        'minutes, or check how many suites log in for themselves.',
    );
  }

  mkdirSync(dirname(SESSION_FILE), { recursive: true });
  writeFileSync(SESSION_FILE, cookie, 'utf8');
}

/** The shared session, as a `Cookie` header value. */
export function adminCookie(): string {
  try {
    return readFileSync(SESSION_FILE, 'utf8').trim();
  } catch {
    throw new Error(
      'No administrative session for the API contract tests. The global setup ' +
        'establishes it; running a spec file without it cannot work.',
    );
  }
}
