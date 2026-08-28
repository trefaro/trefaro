import { adminCookie } from '../support/admin-session';
import { api, postJson } from '../support/api-client';

/**
 * Contract of the endpoints that answer without authentication.
 *
 * These are HTTP-level assertions on a running server, which is the only place
 * request validation actually exists: phase 0 shipped two validation defects
 * that unit tests on the service could not see — `@IsUrl` accepting a bare word,
 * and a missing nested object turning into a 500.
 */
describe('public API', () => {
  describe('GET /api/health', () => {
    it('reports the server and its database separately', async () => {
      const response = await api<{ status: string; database: string }>(
        '/api/health',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', database: 'up' });
    });
  });

  describe('GET /api/config', () => {
    it('answers without authentication, because the public pages need it', async () => {
      const response = await api('/api/config');

      expect(response.status).toBe(200);
    });

    it('carries everything a client needs before its first render', async () => {
      const { body } = await api<Record<string, unknown>>('/api/config');

      expect(body).toEqual(
        expect.objectContaining({
          theme: expect.objectContaining({
            primaryColor: expect.any(String),
            accentColor: expect.any(String),
            fontFamily: expect.any(String),
          }),
          defaultLocale: expect.any(String),
          availableLocales: expect.any(Array),
          enabledModules: expect.any(Array),
          plugins: expect.any(Array),
        }),
      );
    });

    it('never exposes the VAPID private key', async () => {
      const { body } = await api('/api/config');

      const serialised = JSON.stringify(body);
      expect(serialised).not.toMatch(/private/i);
    });

    it('reports only enabled core modules', async () => {
      const { body } = await api<{ enabledModules: string[] }>('/api/config');

      // A plug-in key must never appear here; plug-ins are reported separately.
      expect(body.enabledModules).not.toContain('room-planning');
    });
  });

  describe('GET /api/docs-json', () => {
    it('serves an OpenAPI description of the API', async () => {
      const { status, body } = await api<{
        openapi: string;
        paths: Record<string, unknown>;
      }>('/api/docs-json');

      expect(status).toBe(200);
      expect(body.openapi).toMatch(/^3\./);
      expect(body.paths['/api/config']).toBeDefined();
      expect(body.paths['/api/health']).toBeDefined();
    });
  });

  describe('plug-in bundles', () => {
    it('serves the curated plug-in web component bundle', async () => {
      const { status, body } = await api<string>(
        '/api/plugins/room-planning/main.js',
      );

      expect(status).toBe(200);
      // The element name the server-side descriptor promises the clients.
      expect(body).toContain('trefaro-plugin-room-planning');
    });

    it('does not cache bundles indefinitely, so an update is picked up', async () => {
      const { headers } = await api('/api/plugins/room-planning/main.js');

      expect(headers.get('cache-control')).toContain('no-cache');
    });
  });
});

/**
 * The global validation pipe, asserted on the push subscription endpoint.
 *
 * That endpoint because it is the one with a nested object and a URL in it —
 * both of the phase 0 defects above were in exactly this shape. Since AP 4 of
 * phase 2 `push` is a core module a fresh instance has switched **off** (E21),
 * and a switched-off module answers 404 before any DTO is looked at (F53), so
 * this block switches it on for its own duration and puts the flag back.
 *
 * Through the administration endpoint rather than the table, because that one
 * takes effect immediately (F6) — writing the flag directly would cost this
 * suite fifteen seconds twice.
 */
describe('request validation', () => {
  const endpoint = 'https://push.example.org/contract-test';
  const keys = { p256dh: 'client-public-key', auth: 'client-auth-secret' };

  const setPush = (enabled: boolean) =>
    api('/api/admin/modules/push', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: adminCookie(),
      },
      body: JSON.stringify({ enabled }),
    });

  let wasEnabled = false;

  beforeAll(async () => {
    const modules = await api<{ key: string; enabled: boolean }[]>(
      '/api/admin/modules',
      { headers: { cookie: adminCookie() } },
    );
    wasEnabled =
      modules.body.find((module) => module.key === 'push')?.enabled ?? false;
    if (!wasEnabled) expect((await setPush(true)).status).toBe(200);
  });

  afterAll(async () => {
    // The flag belongs to the instance, not to this suite.
    if (!wasEnabled) await setPush(false);
  });

  it('rejects an unknown field rather than silently dropping it', async () => {
    // `PushSubscription.toJSON()` includes expirationTime; the client has to
    // strip it, and the server has to say so rather than ignore it.
    const { status } = await postJson('/api/user/push/subscriptions', {
      endpoint,
      keys,
      expirationTime: null,
    });

    expect(status).toBe(400);
  });

  it('rejects an endpoint that is not an absolute URL', async () => {
    const { status } = await postJson('/api/user/push/subscriptions', {
      endpoint: 'not-a-url',
      keys,
    });

    expect(status).toBe(400);
  });

  it('rejects a subscription with no keys object', async () => {
    const { status } = await postJson('/api/user/push/subscriptions', {
      endpoint,
    });

    expect(status).toBe(400);
  });

  it('rejects a keys object missing a key', async () => {
    const { status } = await postJson('/api/user/push/subscriptions', {
      endpoint,
      keys: { p256dh: 'client-public-key' },
    });

    expect(status).toBe(400);
  });
});

describe('a disabled plug-in', () => {
  const rooms =
    '/api/admin/plugins/room-planning/events/11111111-1111-4111-8111-111111111111/rooms';

  it('demands a session before it says anything at all', async () => {
    const { status } = await api(rooms);

    // Since phase 1 the administrative guard runs before the plug-in's own
    // guard, so an anonymous caller learns nothing about which plug-ins this
    // instance has switched on. That a *disabled* plug-in then answers 404
    // rather than 403 is asserted with a session in `admin-access.spec.ts`.
    expect(status).toBe(401);
  });

  it('is absent from the configuration too', async () => {
    const { body } = await api<{ plugins: { key: string }[] }>('/api/config');

    expect(body.plugins.map((plugin) => plugin.key)).not.toContain(
      'room-planning',
    );
  });
});

describe('error handling', () => {
  it('answers a JSON error for an unknown route instead of HTML', async () => {
    const { status, body } = await api<Record<string, unknown>>(
      '/api/no-such-endpoint',
    );

    expect(status).toBe(404);
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        path: '/api/no-such-endpoint',
        timestamp: expect.any(String),
      }),
    );
  });
});
