import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of the module administration (FR 1.5) — phase 2, AP 4.
 *
 * The acceptance criterion of the package is decided here, and it has a timing
 * clause: switching `media-links` off makes its public endpoint answer 404
 * **on the next request**, not up to fifteen seconds later. That is the whole
 * reason the endpoint re-reads the flags itself (F6) — a unit test can assert
 * that `refresh()` was called, but only a request can show that the guard in
 * front of another module's controller has already changed its mind.
 *
 * Three more things belong at this level:
 *
 * - **`/api/config` and the guard cannot disagree** (F53). The same flag decides
 *   what a client is told and what the API does, so both are asked after each
 *   write.
 * - **`push` gates something real** (E21). With the module off, `/api/config`
 *   carries no VAPID key and the subscription endpoint answers 404 — before AP 4
 *   the flag gated nothing at all.
 * - **A key this image does not ship is a 404, not a new row.** `module_config`
 *   would take it, and nothing would ever read it.
 *
 * Every test puts back what it found: `module_config` belongs to the instance,
 * and the suites that come after this one expect `media-links` to answer.
 */
interface ModuleSummary {
  key: string;
  family: 'core' | 'plugin';
  titleKey: string;
  enabled: boolean;
  enabledByDefault: boolean;
  version: string | null;
  bundleUrl: string | null;
  mountPoints: string[];
}

interface Series {
  id: string;
}

interface Event {
  id: string;
}

interface PublicConfig {
  enabledModules: string[];
  plugins: { key: string }[];
  webPushPublicKey: string | null;
}

const stamp = Date.now();

describe('the module administration', () => {
  let cookie: string;
  /** An event with a media links list, so "switched off" is distinguishable. */
  let series: Series;
  let event: Event;

  const list = () =>
    api<ModuleSummary[]>('/api/admin/modules', { headers: { cookie } });

  const toggle = (key: string, enabled: boolean) =>
    api<ModuleSummary>(`/api/admin/modules/${key}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ enabled }),
    });

  const publicConfig = () => api<PublicConfig>('/api/config');

  const find = async (key: string): Promise<ModuleSummary> => {
    const found = (await list()).body.find((module) => module.key === key);
    if (!found) throw new Error(`No module "${key}" in the list`);
    return found;
  };

  /**
   * The media links of one event.
   *
   * The endpoint this suite watches, because it answers **200** while the module
   * is on: a request against a made-up event would answer 404 either way and
   * prove nothing about the flag.
   */
  const mediaLinksOf = (eventId: string) =>
    api(`/api/admin/events/${eventId}/media-links`, { headers: { cookie } });

  beforeAll(async () => {
    cookie = adminCookie();

    const asAdminJson = (payload: unknown): RequestInit => ({
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(payload),
    });

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson({
          name: `Modules Contract Series ${stamp}`,
          description: 'Holds the event this suite watches a module through.',
          status: 'published',
        }),
      )
    ).body;

    const created = await api<Event>(
      `/api/admin/series/${series.id}/events`,
      asAdminJson({
        name: `Modules Contract Event ${stamp}`,
        description: 'Its media links list is either 200 or 404.',
        eventType: 'onsite',
        startsAt: '2099-06-14T06:00:00.000Z',
        endsAt: '2099-06-14T16:00:00.000Z',
        timezone: 'Europe/Berlin',
        // A published on-site event needs somewhere to be.
        venueName: 'Bürgerhaus Kalk',
        languages: ['de'],
        status: 'published',
      }),
    );
    expect(`${created.status} ${JSON.stringify(created.body)}`).toMatch(/^201/);
    event = created.body;
  });

  afterAll(async () => {
    // No registration was confirmed here, so the series goes outright (E14).
    await api(`/api/admin/series/${series.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
  });

  it('needs an administrative session, like everything under /api/admin', async () => {
    const anonymous = await api('/api/admin/modules');

    expect(anonymous.status).toBe(401);
  });

  it('lists both families, with the disabled ones', async () => {
    const { status, body } = await list();

    expect(status).toBe(200);
    // A list of the enabled ones is what `/api/config` carries; this page needs
    // the others, or there is nothing to switch on.
    expect(body.map((module) => module.key)).toEqual(
      expect.arrayContaining(['media-links', 'push', 'room-planning']),
    );
    expect(body.map((module) => module.family)).toEqual(
      expect.arrayContaining(['core', 'plugin']),
    );
  });

  it('lists only modules that exist (E21)', async () => {
    const keys = (await list()).body.map((module) => module.key);

    // Four keys named core modules until AP 4 and one of them read its flag.
    // `chat`, `profiles` and `profile-search` come back in phase 3 with their
    // modules; there will be no newsletter module at all (F8).
    expect(keys).not.toContain('newsletter');
    expect(keys).not.toContain('chat');
    expect(keys).not.toContain('profiles');
    expect(keys).not.toContain('profile-search');
  });

  it('carries version and bundle for a plug-in and neither for a core module', async () => {
    expect(await find('room-planning')).toMatchObject({
      family: 'plugin',
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      bundleUrl: '/api/plugins/room-planning/main.js',
      mountPoints: ['event-detail'],
    });
    expect(await find('media-links')).toMatchObject({
      family: 'core',
      version: null,
      bundleUrl: null,
      mountPoints: [],
    });
  });

  it('refuses a key this image does not ship', async () => {
    const { status } = await toggle('a-module-we-never-shipped', true);

    expect(status).toBe(404);
  });

  it('refuses a body without a boolean', async () => {
    const { status } = await api('/api/admin/modules/media-links', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ enabled: 'yes' }),
    });

    expect(status).toBe(400);
  });

  it('switches a core module off, and its endpoints stop answering at once', async () => {
    const before = await find('media-links');
    expect((await mediaLinksOf(event.id)).status).toBe(200);

    try {
      const written = await toggle('media-links', false);

      expect(written.status).toBe(200);
      expect(written.body.enabled).toBe(false);

      // The very next request, with no wait in between: the endpoint re-read
      // the flags as part of the write (F6). Through the table alone — the only
      // switch before AP 4 — this assertion needed a fifteen-second sleep, which
      // is what `media-links.spec.ts` still does deliberately for the operator's
      // path.
      expect((await mediaLinksOf(event.id)).status).toBe(404);

      // And what a client is told matches what the API does (F53).
      expect((await publicConfig()).body.enabledModules).not.toContain(
        'media-links',
      );

      // Including the organizer's dashboard: the tile is omitted rather than
      // shown with a zero, and it is gone on the next request rather than on the
      // next scheduled read (F47, F53).
      const off = await api<{ mediaLinks: unknown }>(
        `/api/admin/events/${event.id}/dashboard`,
        { headers: { cookie } },
      );
      expect(off.body.mediaLinks).toBeNull();
    } finally {
      await toggle('media-links', before.enabled);
    }

    expect((await mediaLinksOf(event.id)).status).toBe(200);
    expect((await publicConfig()).body.enabledModules).toContain('media-links');
    const on = await api<{ mediaLinks: unknown }>(
      `/api/admin/events/${event.id}/dashboard`,
      { headers: { cookie } },
    );
    expect(on.body.mediaLinks).not.toBeNull();
  });

  it('switches a plug-in on without a redeploy, and the clients are told', async () => {
    const before = await find('room-planning');

    try {
      await toggle('room-planning', true);

      // The plug-in was mounted at boot; the flag decides whether the clients
      // learn about its bundle (F6).
      const enabled = await publicConfig();
      expect(enabled.body.plugins.map((plugin) => plugin.key)).toContain(
        'room-planning',
      );

      await toggle('room-planning', false);

      const disabled = await publicConfig();
      expect(disabled.body.plugins.map((plugin) => plugin.key)).not.toContain(
        'room-planning',
      );
    } finally {
      await toggle('room-planning', before.enabled);
    }
  });

  it('gates push on the flag: no VAPID key and no subscriptions while it is off', async () => {
    const before = await find('push');
    const endpoint = `https://push.example.org/modules-contract-${stamp}`;
    const push = (method: string) =>
      api('/api/user/push/subscriptions', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) },
        }),
      });

    try {
      await toggle('push', false);

      expect((await publicConfig()).body.webPushPublicKey).toBeNull();
      // 404, not 403: a module that is off looks absent (F53).
      expect((await push('POST')).status).toBe(404);

      await toggle('push', true);

      // On, and the endpoint answers — with what it thinks of the payload rather
      // than with "this module does not exist". Whether a subscription is stored
      // depends on the VAPID pair the deployment provided, so this asserts
      // "not 404" rather than a status.
      expect((await push('POST')).status).not.toBe(404);
      // Removed while the module still answers: a suite leaves no rows behind,
      // and after the flag goes back this endpoint may be gone.
      await push('DELETE');
    } finally {
      await toggle('push', before.enabled);
    }
  });
});
