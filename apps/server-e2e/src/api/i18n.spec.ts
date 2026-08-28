import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of the translation catalogue (chapter 4, E22, E23) — AP 6.
 *
 * The interesting assertions here are the ones a unit test cannot make: that the
 * catalogue really is *shipped inside this deployment* and reachable without a
 * login, and that the ETag round trip works end to end. The first of those has
 * bitten this project before in a different shape — a value that existed in
 * `env.ts` and in `.env.example` but was never passed through to the container —
 * and a catalogue lives in three places for the same reason: the webpack asset
 * config, `I18N_CATALOGUE_DIR`, and the `COPY` in the Dockerfile.
 */
describe('GET /api/i18n/:locale', () => {
  it('answers without authentication, because the public pages need text', async () => {
    const response = await api('/api/i18n/en');

    expect(response.status).toBe(200);
  });

  it('serves the catalogue this image ships', async () => {
    const { body } = await api<Record<string, string>>('/api/i18n/en');

    // Not an empty object: an instance whose catalogues never made it into the
    // image would answer 200 with nothing, and both clients would render their
    // keys. No unit test in this repository can see that.
    expect(Object.keys(body).length).toBeGreaterThan(0);
    expect(body['modules.push.title']).toBe('Push notifications');
  });

  it('is flat, with one string per dotted key', async () => {
    const { body } = await api<Record<string, unknown>>('/api/i18n/en');

    for (const [key, value] of Object.entries(body)) {
      expect(typeof value).toBe('string');
      expect(key).toContain('.');
    }
  });

  it('translates German and keeps the English key list', async () => {
    const [english, german] = await Promise.all([
      api<Record<string, string>>('/api/i18n/en'),
      api<Record<string, string>>('/api/i18n/de'),
    ]);

    expect(german.body['modules.push.title']).toBe('Push-Benachrichtigungen');
    // E23: every key resolves in every language, so a client never has to
    // handle a gap.
    expect(Object.keys(german.body).sort()).toEqual(
      Object.keys(english.body).sort(),
    );
  });

  it('names every key the module administration hands out', async () => {
    // The one coupling that would otherwise only show up on screen: the module
    // list is assembled on the server from each descriptor's `titleKey`, and the
    // clients resolve those keys against this catalogue. A descriptor whose key
    // has no entry is a blank name in the administration — and `module-keys.spec`
    // can only check that the key is well formed, not that it exists here.
    const [{ body: catalogue }, modules, { body: config }] = await Promise.all([
      api<Record<string, string>>('/api/i18n/en'),
      api<{ titleKey: string }[]>('/api/admin/modules', {
        headers: { cookie: await adminCookie() },
      }),
      api<{ plugins: { labelKey: string }[] }>('/api/config'),
    ]);

    expect(modules.body.length).toBeGreaterThan(0);
    for (const module of modules.body) {
      expect({
        key: module.titleKey,
        text: catalogue[module.titleKey],
      }).toEqual({ key: module.titleKey, text: expect.any(String) });
    }
    for (const plugin of config.plugins) {
      expect({
        key: plugin.labelKey,
        text: catalogue[plugin.labelKey],
      }).toEqual({ key: plugin.labelKey, text: expect.any(String) });
    }
  });

  it('answers 304 for a client that already has this catalogue', async () => {
    const first = await api('/api/i18n/de');
    const etag = first.headers.get('etag');
    expect(etag).toMatch(/^"[\w-]+"$/);

    const second = await api('/api/i18n/de', {
      headers: { 'if-none-match': etag ?? '' },
    });

    // Revalidation rather than caching is the whole cache: a changed
    // translation has to be live after a reload (E22), and this is what keeps
    // that cheap on every start.
    expect(second.status).toBe(304);
  });

  it('accepts a weak validator and a list, as a browser may send them', async () => {
    const { headers } = await api('/api/i18n/en');
    const etag = headers.get('etag') ?? '';

    const response = await api('/api/i18n/en', {
      headers: { 'if-none-match': `W/"stale", ${etag}` },
    });

    expect(response.status).toBe(304);
  });

  it('tells the client to revalidate rather than to cache', async () => {
    const { headers } = await api('/api/i18n/en');

    expect(headers.get('cache-control')).toContain('no-cache');
  });

  it('gives two languages two different tags', async () => {
    const [english, german] = await Promise.all([
      api('/api/i18n/en'),
      api('/api/i18n/de'),
    ]);

    expect(english.headers.get('etag')).not.toBe(german.headers.get('etag'));
  });

  it('refuses a locale this instance does not serve', async () => {
    const response = await api('/api/i18n/pt');

    expect(response.status).toBe(404);
  });

  it('refuses anything that is not a language tag', async () => {
    for (const candidate of ['..%2Fen', 'e', 'much-too-long-a-language-tag']) {
      const response = await api(`/api/i18n/${candidate}`);

      // 400 rather than 404: "that is not a language" and "this instance does
      // not have that language" are different answers, and only the second one
      // says anything about this instance.
      expect(response.status).toBe(400);
    }
  });

  it('is not reachable under the administrative prefix', async () => {
    // The catalogue is public by design; what must not exist is a second,
    // guarded copy of the same route that could drift from it.
    const response = await api('/api/admin/i18n/en');

    expect([401, 404]).toContain(response.status);
  });
});
