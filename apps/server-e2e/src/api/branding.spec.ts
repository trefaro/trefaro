import { MAX_BRANDING_BYTES } from '@trefaro/shared-models';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';
import { brandingPaths } from '../support/database';

/**
 * Contract of the logo and the app icon (FR 1.4, E19, E26) — phase 2, AP 2.
 *
 * The acceptance criterion of the package is decided here, and it is one that
 * only a request can decide: an uploaded logo is reachable **without a login**,
 * while the volume it lives in also holds registration attachments that must
 * never be (E9). Both halves of that are properties of the routing table and of
 * what a stored path can be, not of any one function.
 *
 * So this suite asks the four questions the package promised:
 *
 * 1. Does an anonymous request get the logo, under a URL that contains no
 *    stored path?
 * 2. Is the stored path itself — and anything else under `/api/media` —
 *    unreachable?
 * 3. Does a zip archive announced as a PNG get refused (F38)?
 * 4. Does a second upload show the new image at once, under a new `?v=`?
 *
 * `app_config` is a singleton, so this suite owns the two images for its
 * duration: it captures whatever was there, and puts the bytes back at the end.
 */

/** The same directory the server writes to; see `UPLOAD_DIR` in `.env`. */
const UPLOAD_DIR = resolve(
  __dirname,
  '../../../..',
  process.env['UPLOAD_DIR'] ?? './tmp/uploads',
);

/** Real headers, so the server's signature check decides as it does in production. */
const png = (padding = 64): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding, 0x2a),
  ]);

const jpeg = (padding = 64): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(padding, 0x7b)]);

/** A zip archive's local file header — a `.zip` and a `.docx` start with it. */
const zip = (): Buffer =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);

interface BrandingImages {
  logoUrl: string | null;
  appIconUrl: string | null;
}

interface PublicConfig {
  theme: { logoUrl: string | null };
  appIconUrl: string | null;
}

/** An image that was already configured, so it can be put back. */
interface Saved {
  bytes: Buffer;
  mimeType: string;
}

type Kind = 'logo' | 'app-icon';

/** Every file in the branding subtree — an empty list if it does not exist. */
async function brandingFiles(): Promise<string[]> {
  try {
    return await readdir(resolve(UPLOAD_DIR, 'branding'));
  } catch {
    return [];
  }
}

/** The `v` of a branding URL, as a number. */
function version(url: string | null): number {
  return Number(new URL(url ?? '', 'http://localhost').searchParams.get('v'));
}

describe('the branding images', () => {
  let cookie: string;
  const saved = new Map<Kind, Saved>();

  const upload = (kind: Kind, bytes: Buffer, mimeType: string) => {
    const body = new FormData();
    body.set('file', new Blob([new Uint8Array(bytes)], { type: mimeType }));
    return api<BrandingImages>(`/api/admin/config/${kind}`, {
      method: 'PUT',
      headers: { cookie },
      body,
    });
  };

  const drop = (kind: Kind) =>
    api<BrandingImages>(`/api/admin/config/${kind}`, {
      method: 'DELETE',
      headers: { cookie },
    });

  /** The public route, deliberately without a session. */
  const fetchImage = async (url: string) => {
    const response = await fetch(
      `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}${url}`,
    );
    return {
      status: response.status,
      headers: response.headers,
      bytes: Buffer.from(await response.arrayBuffer()),
    };
  };

  const publicConfig = () => api<PublicConfig>('/api/config');

  /**
   * The invariant no constraint can state: the volume holds exactly the branding
   * files the configuration names.
   *
   * Absolute rather than a delta, because there are at most two of these files —
   * an orphan among them would never be referenced again and never be noticed,
   * unlike an attachment, whose row still names it.
   */
  const expectNoOrphans = async (): Promise<void> => {
    const config = (await publicConfig()).body;
    const referenced = [config.theme.logoUrl, config.appIconUrl].filter(
      (url) => url !== null,
    ).length;

    expect(await brandingFiles()).toHaveLength(referenced);
  };

  beforeAll(async () => {
    cookie = adminCookie();

    // Whatever this instance is branded with is captured now and restored at the
    // end — there is one configuration row, and it is not this suite's.
    const config = (await publicConfig()).body;
    for (const [kind, url] of [
      ['logo', config.theme.logoUrl],
      ['app-icon', config.appIconUrl],
    ] as const) {
      if (!url) continue;
      const image = await fetchImage(url);
      if (image.status === 200) {
        saved.set(kind, {
          bytes: image.bytes,
          mimeType: image.headers.get('content-type') ?? 'image/png',
        });
      }
    }
  });

  afterAll(async () => {
    for (const kind of ['logo', 'app-icon'] as const) {
      const previous = saved.get(kind);
      if (previous) await upload(kind, previous.bytes, previous.mimeType);
      else await drop(kind);
    }
  });

  it('needs an administrative session to change, like everything under /api/admin', async () => {
    for (const kind of ['logo', 'app-icon'] as const) {
      expect(
        (await api(`/api/admin/config/${kind}`, { method: 'PUT' })).status,
      ).toBe(401);
      expect(
        (await api(`/api/admin/config/${kind}`, { method: 'DELETE' })).status,
      ).toBe(401);
    }
  });

  it('serves an uploaded logo to anyone, under a URL that holds no stored path', async () => {
    const bytes = png();
    const { status, body } = await upload('logo', bytes, 'image/png');

    expect(status).toBe(200);
    expect(body.logoUrl).toMatch(/^\/api\/media\/branding\/logo\?v=\d+$/);

    // The clients learn about it from the configuration they read on startup,
    // which is what makes the year-long cache below safe (E19, E20).
    expect((await publicConfig()).body.theme.logoUrl).toBe(body.logoUrl);

    // No session: the participant start page and every event landing page are
    // public, and both show this image.
    const image = await fetchImage(body.logoUrl ?? '');
    expect(image.status).toBe(200);
    expect(image.bytes.equals(bytes)).toBe(true);
    // The type is the one the file's own first bytes say — nothing stores it.
    expect(image.headers.get('content-type')).toContain('image/png');
    expect(image.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');

    // The generated file name is in the volume and in the row, and in neither
    // URL: that is the whole of E19.
    const { logoPath } = await brandingPaths();
    expect(logoPath).toMatch(/^branding\//);
    expect(body.logoUrl).not.toContain(logoPath ?? 'never');
  });

  it('has no route that turns a stored path into bytes', async () => {
    const { logoPath } = await brandingPaths();

    // The path of the image that is being served right now, and the shape of an
    // attachment's path. Neither is addressable — `/api/media` has exactly two
    // routes, and a registration attachment (which can be a passport scan) is
    // only ever reachable through `/api/admin/attachments/:id` (E9).
    for (const path of [
      logoPath ?? 'branding/whatever',
      'attachments/ab/8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
      'branding/../attachments/ab/8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
    ]) {
      expect((await fetchImage(`/api/media/${path}`)).status).toBe(404);
    }
  });

  it('refuses a zip archive that says it is a PNG, and keeps the image it has', async () => {
    const before = (await publicConfig()).body.theme.logoUrl;

    const refused = await upload('logo', zip(), 'image/png');
    expect(refused.status).toBe(400);

    // Nothing was written: the instance still shows what it showed before.
    expect((await publicConfig()).body.theme.logoUrl).toBe(before);
    await expectNoOrphans();
  });

  it('refuses an SVG, which would be script from the same origin', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
    );

    expect((await upload('logo', svg, 'image/svg+xml')).status).toBe(400);
  });

  it('refuses an image above the ceiling', async () => {
    const tooLarge = png(MAX_BRANDING_BYTES);

    // 413 rather than 400, like the per-file ceiling of the registration form:
    // the multipart parser stops reading, and the answer says so.
    expect((await upload('logo', tooLarge, 'image/png')).status).toBe(413);
  });

  it('shows the new image at once after a second upload', async () => {
    const before = (await publicConfig()).body.theme.logoUrl;
    const bytes = jpeg();

    const { body } = await upload('logo', bytes, 'image/jpeg');

    // A new image is a new URL — the reason the bytes may be cached for a year.
    expect(version(body.logoUrl)).toBeGreaterThan(version(before));

    const image = await fetchImage(body.logoUrl ?? '');
    expect(image.bytes.equals(bytes)).toBe(true);
    expect(image.headers.get('content-type')).toContain('image/jpeg');

    // The replaced file is gone.
    await expectNoOrphans();
  });

  it('keeps the app icon and the logo apart', async () => {
    const bytes = png(128);

    const { body } = await upload('app-icon', bytes, 'image/png');
    expect(body.appIconUrl).toMatch(
      /^\/api\/media\/branding\/app-icon\?v=\d+$/,
    );

    const config = (await publicConfig()).body;
    expect(config.appIconUrl).toBe(body.appIconUrl);

    const icon = await fetchImage(body.appIconUrl ?? '');
    expect(icon.bytes.equals(bytes)).toBe(true);

    // A second, independent image (E26) — a wide logo gets cropped on a home
    // screen. The logo from the previous test is untouched; only its `?v=`
    // moved, because the version belongs to the configuration row.
    const logo = await fetchImage(config.theme.logoUrl ?? '');
    expect(logo.bytes.equals(jpeg())).toBe(true);
    await expectNoOrphans();
  });

  it('takes an image away again, and its file with it', async () => {
    const removed = await drop('logo');

    expect(removed.status).toBe(200);
    expect(removed.body.logoUrl).toBeNull();
    expect(removed.body.appIconUrl).not.toBeNull();
    expect((await publicConfig()).body.theme.logoUrl).toBeNull();

    // 404, not an empty answer: there is no logo, and the clients fall back to
    // the organization's name.
    expect((await fetchImage('/api/media/branding/logo')).status).toBe(404);
    await expectNoOrphans();
  });
});
