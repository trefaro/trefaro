import {
  SHIPPED_APP_ICONS,
  WEB_MANIFEST_MIME_TYPE,
  type WebManifest,
} from '@trefaro/shared-models';
import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of the PWA manifest (F20, E26) — phase 2, AP 12.
 *
 * What only a request can decide, and what the unit tests around
 * `buildWebManifest` cannot:
 *
 * 1. The document is **public**. A browser fetches `<link rel="manifest">`
 *    without credentials, so an instance whose manifest needed a session would
 *    be installable by nobody.
 * 2. It is served as `application/manifest+json`, which is what tells a proxy
 *    and an operator what it is.
 * 3. It **follows the configuration**: renaming the organization changes the
 *    name on the next install, and uploading an app icon replaces the icon list.
 * 4. It **revalidates**: an `ETag` and a 304, so a browser that installs, checks
 *    for updates and re-reads it pays for the round trip and not for the body.
 *
 * `app_config` is a singleton, so this suite restores the name and the app icon
 * it found — the same rule the branding suite follows, for the same reason.
 */

/** Real headers, so the server's signature check decides as in production. */
const png = (padding = 64): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding, 0x2a),
  ]);

/** A PNG whose IHDR chunk states a size the manifest can declare. */
const measurablePng = (width: number, height: number): Buffer => {
  const bytes = Buffer.alloc(24);
  png(16).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
};

interface PublicConfig {
  organizationName: string;
  theme: { primaryColor: string };
  defaultLocale: string;
  appIconUrl: string | null;
}

interface BrandingImages {
  appIconUrl: string | null;
}

describe('the PWA manifest', () => {
  let cookie: string;
  let restoreName: string;
  let hadIcon: boolean;

  const manifest = (headers: Record<string, string> = {}) =>
    api<WebManifest>('/api/config/manifest.webmanifest', { headers });

  const config = () => api<PublicConfig>('/api/config');

  const uploadIcon = (bytes: Buffer) => {
    const body = new FormData();
    body.set('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    return api<BrandingImages>('/api/admin/config/app-icon', {
      method: 'PUT',
      headers: { cookie },
      body,
    });
  };

  const dropIcon = () =>
    api<BrandingImages>('/api/admin/config/app-icon', {
      method: 'DELETE',
      headers: { cookie },
    });

  beforeAll(async () => {
    cookie = adminCookie();
    const current = (await config()).body;
    restoreName = current.organizationName;
    hadIcon = current.appIconUrl !== null;
  });

  afterAll(async () => {
    await api('/api/admin/config', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ organizationName: restoreName }),
    });
    // The suite found no icon or it uploaded one; either way the instance is
    // left as it was. An icon it did *not* upload is never touched, because
    // this branch only runs when there was none.
    if (!hadIcon) await dropIcon();
  });

  it('is public — a browser fetches it without credentials', async () => {
    const response = await manifest();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      WEB_MANIFEST_MIME_TYPE,
    );
  });

  it('names the organization and takes its colour', async () => {
    const instance = (await config()).body;
    const { body } = await manifest();

    expect(body.name).toBe(instance.organizationName);
    expect(body.short_name).toBe(instance.organizationName);
    expect(body.theme_color).toBe(instance.theme.primaryColor);
    expect(body.lang).toBe(instance.defaultLocale);
  });

  it('starts and scopes at the root, as a standalone application', async () => {
    const { body } = await manifest();

    expect(body.start_url).toBe('/');
    expect(body.scope).toBe('/');
    expect(body.id).toBe('/');
    expect(body.display).toBe('standalone');
  });

  it('follows a renamed organization', async () => {
    await api('/api/admin/config', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ organizationName: 'Manifest Test Organization' }),
    });

    expect((await manifest()).body.name).toBe('Manifest Test Organization');

    await api('/api/admin/config', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ organizationName: restoreName }),
    });
  });

  it('answers an ETag and then a 304 for the same document', async () => {
    const first = await manifest();
    const etag = first.headers.get('etag') ?? '';
    expect(etag).toMatch(/^".+"$/);

    const second = await manifest({ 'if-none-match': etag });
    expect(second.status).toBe(304);
  });

  it('offers the shipped icons while none is uploaded', async () => {
    if ((await config()).body.appIconUrl !== null) await dropIcon();

    expect((await manifest()).body.icons).toEqual(SHIPPED_APP_ICONS);
  });

  it('replaces them with a square upload big enough to install from', async () => {
    const uploaded = await uploadIcon(measurablePng(512, 512));
    expect(uploaded.status).toBe(200);

    const { icons } = (await manifest()).body;

    expect(icons).toHaveLength(1);
    expect(icons[0].src).toBe(uploaded.body.appIconUrl);
    expect(icons[0].sizes).toBe('512x512');
    // Never maskable for an image nobody has seen (E26).
    expect(icons[0].purpose).toBe('any');
  });

  it('keeps the shipped icons beside an upload it cannot measure', async () => {
    // A PNG signature without a readable IHDR: the header says nothing about
    // the size, so the instance must not become uninstallable because of it.
    await uploadIcon(png());

    const { icons } = (await manifest()).body;

    expect(icons[0].sizes).toBe('any');
    expect(icons.slice(1)).toEqual(SHIPPED_APP_ICONS);
  });
});
