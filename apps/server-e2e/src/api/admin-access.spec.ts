import { api, postJson } from '../support/api-client';

/**
 * Contract of the administrative API (FR 1.2, FR 1.3, E16 of the phase 1 plan).
 *
 * The point of these assertions is the boundary itself: everything under
 * `/api/admin` must demand a session — including controllers contributed by
 * plug-ins, which is why one test points at the room planning plug-in rather
 * than at a core endpoint. Phase 0 left that boundary open, and only an
 * HTTP-level check can show it is closed.
 *
 * The suite logs in exactly once, in `beforeAll`. That is not just tidiness:
 * the login is rate limited to five attempts per five minutes, so a spec that
 * logged in per test would lock itself out.
 *
 * The rate limit itself is deliberately not exercised here — it blocks the
 * route for fifteen minutes, which would make the suite unrepeatable.
 * `tools/spike-verification/verify-admin-access.mjs` checks it against a
 * running instance instead.
 */
const SESSION_COOKIE = 'trefaro_admin_session';

/** A room endpoint of the room planning plug-in — disabled by default. */
const PLUGIN_ROOMS =
  '/api/admin/plugins/room-planning/events/11111111-1111-4111-8111-111111111111/rooms';

const credentials = {
  email: process.env['ADMIN_BOOTSTRAP_EMAIL'] ?? '',
  password: process.env['ADMIN_BOOTSTRAP_PASSWORD'] ?? '',
};

/** Reads one cookie's value out of a response's `Set-Cookie` headers. */
function cookieFrom(headers: Headers, name: string): string | null {
  for (const header of headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [key, ...rest] = pair.split('=');
    if (key.trim() === name) return rest.join('=');
  }
  return null;
}

function attributesOf(headers: Headers, name: string): string {
  return (
    headers.getSetCookie().find((header) => header.startsWith(`${name}=`)) ?? ''
  ).toLowerCase();
}

interface LoginBody {
  admin: {
    id: string;
    email: string;
    name: string;
    lastLoginAt: string | null;
  };
  expiresAt: string;
}

describe('administrative API', () => {
  let login: Awaited<ReturnType<typeof postJson<LoginBody>>>;
  let cookie = '';

  beforeAll(async () => {
    if (!credentials.email || !credentials.password) {
      throw new Error(
        'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set for the ' +
          'API contract tests — the same values the server booted with, so the ' +
          'suite can log in. Add them to .env.',
      );
    }

    login = await postJson<LoginBody>('/api/admin/auth/login', credentials);
    const token = cookieFrom(login.headers, SESSION_COOKIE);
    cookie = `${SESSION_COOKIE}=${token ?? ''}`;
  });

  describe('without a session', () => {
    it('refuses the administrator list', async () => {
      expect((await api('/api/admin/admins')).status).toBe(401);
    });

    it('refuses to say who is logged in', async () => {
      expect((await api('/api/admin/auth/me')).status).toBe(401);
    });

    it("refuses a plug-in's administrative endpoint, without the plug-in doing anything", async () => {
      // The guard is keyed on the route path, not on a decorator the plug-in
      // author has to remember to write.
      expect((await api(PLUGIN_ROOMS)).status).toBe(401);
    });

    it('refuses to create an administrator', async () => {
      const response = await postJson('/api/admin/admins', {
        email: 'intruder@example.org',
        name: 'Intruder',
        password: 'a-long-enough-secret',
      });

      expect(response.status).toBe(401);
    });

    it('still answers the public configuration', async () => {
      expect((await api('/api/config')).status).toBe(200);
    });

    it('rejects a wrong password without handing out a cookie', async () => {
      const response = await postJson('/api/admin/auth/login', {
        email: credentials.email,
        password: 'definitely-not-the-password',
      });

      expect(response.status).toBe(401);
      expect(cookieFrom(response.headers, SESSION_COOKIE)).toBeNull();
    });

    it('rejects a login that is missing the password', async () => {
      const response = await postJson('/api/admin/auth/login', {
        email: credentials.email,
      });

      expect(response.status).toBe(400);
    });
  });

  describe('login', () => {
    it('answers with the account and the session deadline', () => {
      expect(login.status).toBe(200);
      expect(login.body.admin.email).toBe(credentials.email);
      expect(Date.parse(login.body.expiresAt)).toBeGreaterThan(Date.now());
    });

    it('sets a cookie no script can read and no cross-site request can carry', () => {
      const attributes = attributesOf(login.headers, SESSION_COOKIE);

      expect(attributes).toContain('httponly');
      expect(attributes).toContain('samesite=lax');
      // Path=/api keeps the cookie off requests for the client's own assets.
      expect(attributes).toContain('path=/api');
    });

    it('never puts the password hash in the payload', () => {
      expect(JSON.stringify(login.body)).not.toContain('argon2');
    });
  });

  describe('with a session', () => {
    it('says who is logged in', async () => {
      const response = await api<LoginBody>('/api/admin/auth/me', {
        headers: { cookie },
      });

      expect(response.status).toBe(200);
      expect(response.body.admin.email).toBe(credentials.email);
    });

    it('lists the administrators without their hashes', async () => {
      const response = await api<{ email: string }[]>('/api/admin/admins', {
        headers: { cookie },
      });

      expect(response.status).toBe(200);
      expect(response.body.map((admin) => admin.email)).toContain(
        credentials.email,
      );
      expect(JSON.stringify(response.body)).not.toContain('argon2');
    });

    it('shows a disabled plug-in as absent rather than forbidden', async () => {
      const response = await api(PLUGIN_ROOMS, { headers: { cookie } });

      // 404, not 403: a disabled plug-in should reveal nothing about itself,
      // and this matches what a client sees, since it is missing from
      // /api/config. Authentication is checked first, which is why this needs a
      // session at all.
      expect(response.status).toBe(404);
    });

    it('refuses to delete the account it is logged in as', async () => {
      const response = await api(`/api/admin/admins/${login.body.admin.id}`, {
        method: 'DELETE',
        headers: { cookie },
      });

      // Which is also what makes an instance without administrators
      // unreachable as a state.
      expect(response.status).toBe(409);
    });
  });

  describe('logout', () => {
    // Last, because it invalidates the shared session.
    it('ends the session on the server, not just in the browser', async () => {
      const logout = await api('/api/admin/auth/logout', {
        method: 'POST',
        headers: { cookie },
      });
      expect(logout.status).toBe(204);

      const afterwards = await api('/api/admin/auth/me', {
        headers: { cookie },
      });
      expect(afterwards.status).toBe(401);
    });

    it('succeeds even without a session, so a stale tab can still log out', async () => {
      expect(
        (await api('/api/admin/auth/logout', { method: 'POST' })).status,
      ).toBe(204);
    });
  });
});
