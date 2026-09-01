import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of the per-series and per-event logo (FR 2.1, FR 3.1 — both P1).
 *
 * The acceptance criterion of this work package, and it is one only a request
 * can decide: an uploaded logo is reachable **without a login**, while the
 * volume it lives in also holds registration attachments that must never be
 * (E9). Both halves are properties of the routing table and of what a stored
 * path can be, not of any one function — which is why `logo-image.service.spec`
 * cannot settle them.
 *
 * Five questions:
 *
 * 1. Does an anonymous request get the logo, under a URL that carries no stored
 *    path (E19)?
 * 2. Is the row's own stored path unreachable through that route?
 * 3. Does a zip archive announced as a PNG get refused (F38)?
 * 4. Does the public payload of the series and of the event carry the URL, and
 *    does a second upload change the `?v=`?
 * 5. Does deleting a series take the logo files of the series **and of its
 *    events** with it, while the rows can still name them?
 *
 * Unlike the branding suite this one owns its rows, so nothing has to be
 * captured and restored — it creates a series, works inside it, and deletes it.
 */

/** The same directory the server writes to; see `UPLOAD_DIR` in `.env`. */
const UPLOAD_DIR = resolve(
  __dirname,
  '../../../..',
  process.env['UPLOAD_DIR'] ?? './tmp/uploads',
);

/** Real headers, so the server's signature check decides as in production. */
const png = (padding = 64): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding, 0x2a),
  ]);

/** A zip archive's local file header — a `.zip` and a `.docx` start with it. */
const zip = (): Buffer =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);

interface Logo {
  logoUrl: string | null;
}

interface Series {
  id: string;
  slug: string;
  logoUrl: string | null;
}

interface Event {
  id: string;
  slug: string;
  logoUrl: string | null;
}

/** Every file in the logo subtree — an empty list if it does not exist. */
async function allLogoFiles(): Promise<string[]> {
  try {
    return await readdir(resolve(UPLOAD_DIR, 'logos'));
  } catch {
    return [];
  }
}

function version(url: string | null): string | null {
  return new URL(url ?? '', 'http://localhost').searchParams.get('v');
}

describe('the logo of a series and of an event', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  /**
   * What the volume held before this suite ran.
   *
   * The counts below are deltas rather than absolutes, unlike the branding
   * suite's: `logos/` is shared with every other series and event of the
   * instance the suite runs against, and a developer who ran the demo seed
   * would otherwise see this suite fail for a reason that is not a defect.
   */
  let baseline: string[] = [];

  /** The files this suite is responsible for. */
  const logoFiles = async (): Promise<string[]> =>
    (await allLogoFiles()).filter((name) => !baseline.includes(name));

  const json = (body: unknown): RequestInit => ({
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });

  const uploadLogo = (path: string, bytes: Buffer, mimeType: string) => {
    const body = new FormData();
    body.set('file', new Blob([new Uint8Array(bytes)], { type: mimeType }));
    return api<Logo>(path, { method: 'PUT', headers: { cookie }, body });
  };

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

  beforeAll(async () => {
    cookie = adminCookie();
    baseline = await allLogoFiles();

    const label = `logo-${process.pid}`;
    series = (
      await api<Series>('/api/admin/series', {
        method: 'POST',
        ...json({
          name: `Logo Series ${label}`,
          description: 'Owned by the logo contract suite.',
          status: 'published',
        }),
      })
    ).body;

    event = (
      await api<Event>(`/api/admin/series/${series.id}/events`, {
        method: 'POST',
        ...json({
          name: `Logo Event ${label}`,
          description: 'Owned by the logo contract suite.',
          eventType: 'onsite',
          timezone: 'Europe/Berlin',
          startsAt: '2027-06-01T09:00:00.000Z',
          endsAt: '2027-06-01T17:00:00.000Z',
          venueName: 'Bürgerhaus Kalk',
          languages: ['de', 'en'],
          status: 'published',
        }),
      })
    ).body;
  });

  afterAll(async () => {
    // Takes both logo files with it, which is question 5.
    await api(`/api/admin/series/${series.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
  });

  it('answers with no logo until one is uploaded', async () => {
    const response = await api<Series>(`/api/user/series/${series.slug}`);

    expect(response.body.logoUrl).toBeNull();
  });

  it('serves a series logo to an anonymous visitor, under a path-free URL', async () => {
    const bytes = png();

    const uploaded = await uploadLogo(
      `/api/admin/series/${series.id}/logo`,
      bytes,
      'image/png',
    );

    expect(uploaded.status).toBe(200);
    // E19 in one assertion: the address names the row, not the file. A URL with
    // the stored path in it would put registration attachments one guess away.
    expect(uploaded.body.logoUrl).toMatch(
      new RegExp(`^/api/media/series/${series.id}/logo\\?v=\\d+$`),
    );

    const image = await fetchImage(uploaded.body.logoUrl ?? '');
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');
    expect(image.bytes.equals(bytes)).toBe(true);
  });

  it('carries the URL in the public payload of the series', async () => {
    const response = await api<Series>(`/api/user/series/${series.slug}`);

    expect(response.body.logoUrl).toContain(
      `/api/media/series/${series.id}/logo`,
    );
  });

  it('changes the version when the image is replaced', async () => {
    const before = (await api<Series>(`/api/user/series/${series.slug}`)).body
      .logoUrl;

    // A second image, distinguishable from the first by its padding byte.
    const replaced = await uploadLogo(
      `/api/admin/series/${series.id}/logo`,
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(32, 0x5b),
      ]),
      'image/png',
    );

    // The bytes are served `immutable` for a year, so a new picture has to be a
    // new URL or nobody would ever see it.
    expect(version(replaced.body.logoUrl)).not.toBe(version(before));
    expect((await fetchImage(replaced.body.logoUrl ?? '')).status).toBe(200);
  });

  it('keeps exactly one file per row, replacing rather than accumulating', async () => {
    // One series logo written twice, plus whatever the event has: at this point
    // in the suite the event has none.
    expect(await logoFiles()).toHaveLength(1);
  });

  it('serves an event logo, independently of its series', async () => {
    const uploaded = await uploadLogo(
      `/api/admin/events/${event.id}/logo`,
      png(),
      'image/png',
    );

    expect(uploaded.body.logoUrl).toMatch(
      new RegExp(`^/api/media/events/${event.id}/logo\\?v=\\d+$`),
    );

    const landing = await api<Event>(
      `/api/user/series/${series.slug}/events/${event.slug}`,
    );
    expect(landing.body.logoUrl).toContain(
      `/api/media/events/${event.id}/logo`,
    );
    expect((await fetchImage(uploaded.body.logoUrl ?? '')).status).toBe(200);
  });

  it('refuses an archive announced as a PNG (F38)', async () => {
    const refused = await uploadLogo(
      `/api/admin/events/${event.id}/logo`,
      zip(),
      'image/png',
    );

    expect(refused.status).toBe(400);
    // Two rows with a logo each, and nothing left over from the refusal.
    expect(await logoFiles()).toHaveLength(2);
  });

  it('refuses an SVG whatever it is called', async () => {
    const refused = await uploadLogo(
      `/api/admin/series/${series.id}/logo`,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>'),
      'image/svg+xml',
    );

    expect(refused.status).toBe(400);
  });

  it('needs an administrative session to write', async () => {
    const body = new FormData();
    body.set('file', new Blob([new Uint8Array(png())], { type: 'image/png' }));

    const anonymous = await api<Logo>(`/api/admin/series/${series.id}/logo`, {
      method: 'PUT',
      body,
    });

    expect(anonymous.status).toBe(401);
  });

  it('answers 404 for a row that does not exist', async () => {
    const missing = await uploadLogo(
      '/api/admin/series/2b0f3a56-0000-4000-8000-000000000000/logo',
      png(),
      'image/png',
    );

    expect(missing.status).toBe(404);
  });

  it('answers 404 for an id that is not a uuid', async () => {
    // The route takes an id, and only an id: `ParseUUIDPipe` refuses anything
    // that could be a path before the service is reached.
    const response = await fetch(
      `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}/api/media/series/..%2F..%2Fattachments/logo`,
    );

    expect([400, 404]).toContain(response.status);
  });

  it('answers 404 for a stored path, so the volume stays shut (E9)', async () => {
    const stored = (await logoFiles())[0];

    // The only public routes to stored bytes name a row or a branding kind.
    // Nothing under `/api/media` takes a file name.
    const attempt = await fetchImage(`/api/media/logos/${stored}`);

    expect(attempt.status).toBe(404);
  });

  it('removes the file when the logo is removed', async () => {
    const removed = await api<Logo>(`/api/admin/events/${event.id}/logo`, {
      method: 'DELETE',
      headers: { cookie },
    });

    expect(removed.status).toBe(200);
    expect(removed.body.logoUrl).toBeNull();
    expect(await logoFiles()).toHaveLength(1);

    const landing = await api<Event>(
      `/api/user/series/${series.slug}/events/${event.slug}`,
    );
    expect(landing.body.logoUrl).toBeNull();
  });

  it('takes every logo below a series with it when the series is deleted', async () => {
    // Both rows carry one again, so the cascade has two files to orphan.
    await uploadLogo(`/api/admin/events/${event.id}/logo`, png(), 'image/png');
    expect(await logoFiles()).toHaveLength(2);

    await api(`/api/admin/series/${series.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });

    // The cascade takes the event rows without touching the volume, so the paths
    // had to be collected while the rows could still say them (E9).
    expect(await logoFiles()).toHaveLength(0);

    // Recreated for `afterAll`, which deletes it again — deleting a series that
    // is already gone is a 404, and a hook that throws hides the real failure.
    series = (
      await api<Series>('/api/admin/series', {
        method: 'POST',
        ...json({
          name: `Logo Series ${process.pid} tail`,
          description: 'Recreated so the teardown has something to delete.',
        }),
      })
    ).body;
  });
});
