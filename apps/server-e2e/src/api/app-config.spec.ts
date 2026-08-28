import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of the whitelabel settings (FR 1.4) — phase 2, AP 1.
 *
 * The acceptance criterion of the package is decided here: `#123456` goes
 * through, `red` and `rgba(0, 0, 0, .5)` do not (E17), and a font outside the
 * bundled catalogue does not either (E18). All three are enforced twice — in the
 * DTO and in the service — and this suite asks the way a caller does, which is
 * the only place both walls are actually standing.
 *
 * Two things are worth an HTTP-level test rather than a unit test:
 *
 * - **The public payload and the stored row differ on purpose.**
 *   `/api/admin/config` answers with the font's catalogue key, because that is
 *   what the design page sends back; `/api/config` answers with the expanded CSS
 *   stack, because that is what a browser needs. A unit test can assert each
 *   half; only a request shows that one write changes both answers.
 * - **`app_config` is a singleton.** Every test here writes the one row the whole
 *   instance reads, so the suite puts back what it found.
 */
interface Settings {
  organizationName: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
}

interface PublicConfig {
  organizationName: string;
  theme: { primaryColor: string; accentColor: string; fontFamily: string };
  publicUserClientUrl: string;
}

describe('the whitelabel settings', () => {
  let cookie: string;
  let original: Settings;

  const read = () =>
    api<Settings>('/api/admin/config', { headers: { cookie } });

  const patch = (payload: Record<string, unknown>) =>
    api<Settings>('/api/admin/config', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(payload),
    });

  beforeAll(async () => {
    cookie = adminCookie();
    original = (await read()).body;
  });

  afterAll(async () => {
    // The row belongs to the instance, not to this suite.
    await patch({ ...original });
  });

  it('needs an administrative session, like everything under /api/admin', async () => {
    expect((await api('/api/admin/config')).status).toBe(401);
    expect((await api('/api/admin/config', { method: 'PATCH' })).status).toBe(
      401,
    );
  });

  it('answers with the four values the design page edits', async () => {
    const { status, body } = await read();

    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual([
      'accentColor',
      'fontFamily',
      'organizationName',
      'primaryColor',
    ]);
  });

  it('accepts a hexadecimal colour and shows it to every visitor', async () => {
    expect((await patch({ primaryColor: '#123456' })).status).toBe(200);

    const { body } = await api<PublicConfig>('/api/config');
    expect(body.theme.primaryColor).toBe('#123456');
  });

  it('refuses a colour whose contrast cannot be weighed (E17)', async () => {
    for (const primaryColor of [
      'red',
      'rgba(0, 0, 0, .5)',
      'rgb(31, 111, 92)',
      'oklch(55% 0.1 160)',
      '#1f6f5c80',
      '1f6f5c',
    ]) {
      expect((await patch({ primaryColor })).status).toBe(400);
    }

    // And nothing was written along the way.
    expect((await read()).body.primaryColor).toBe('#123456');
  });

  it('stores only fonts this instance actually serves (E18)', async () => {
    expect((await patch({ fontFamily: 'Comic Sans MS' })).status).toBe(400);
    expect((await patch({ fontFamily: "'Lora', serif" })).status).toBe(400);

    expect((await patch({ fontFamily: 'lora' })).status).toBe(200);
    // The key is stored; the stack is what the clients get.
    expect((await read()).body.fontFamily).toBe('lora');
    expect((await api<PublicConfig>('/api/config')).body.theme.fontFamily).toBe(
      "'Lora', Georgia, serif",
    );
  });

  it('writes only what was sent', async () => {
    const before = (await read()).body;
    const updated = await patch({ organizationName: 'Beispiel e.V.' });

    expect(updated.body).toEqual({
      ...before,
      organizationName: 'Beispiel e.V.',
    });
  });

  it('refuses a name that is empty once trimmed', async () => {
    for (const organizationName of ['', '   ']) {
      expect((await patch({ organizationName })).status).toBe(400);
    }
    expect((await read()).body.organizationName).toBe('Beispiel e.V.');
  });

  it('names the organization and the participant client in the public payload', async () => {
    const { body } = await api<PublicConfig>('/api/config');

    expect(body.organizationName).toBe('Beispiel e.V.');
    // From the environment, so the organizer client can link to a public event
    // page across origins.
    expect(body.publicUserClientUrl).toMatch(/^https?:\/\//);
  });
});
