import { api } from '../support/api-client';
import { adminCookie } from '../support/admin-session';

/**
 * Contract of the event series endpoints (FR 2.1, FR 2.2, FR 2.3).
 *
 * The assertion that matters most is the boundary between the two views: an
 * organizer sees drafts, a participant must not — and a draft has to answer 404
 * rather than 403, so an unannounced series stays unannounced.
 *
 * Logs in once; see `admin-access.spec.ts` for why that matters.
 */
interface Series {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

describe('event series API', () => {
  let cookie = '';
  const created: string[] = [];

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const createSeries = async (
    body: Record<string, unknown>,
  ): Promise<{ status: number; body: Series }> => {
    const response = await api<Series>('/api/admin/series', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    });
    if (response.body?.id) created.push(response.body.id);
    return { status: response.status, body: response.body };
  };

  beforeAll(async () => {
    cookie = adminCookie();
  });

  afterAll(async () => {
    // Leave the instance as it was found — other specs read the public list.
    for (const id of created) {
      await api(`/api/admin/series/${id}`, asAdmin({ method: 'DELETE' }));
    }
  });

  it('needs a session to list series', async () => {
    expect((await api('/api/admin/series')).status).toBe(401);
  });

  it('derives a readable address and starts as a draft', async () => {
    const { status, body } = await createSeries({
      name: 'Bürgerräte für Europa',
      description: 'A series on citizen assemblies.',
    });

    expect(status).toBe(201);
    // Transliterated, not stripped — "brgerrte" would be useless.
    expect(body.slug).toBe('buergerraete-fuer-europa');
    expect(body.status).toBe('draft');
  });

  it('keeps a draft out of the public list and answers 404 for it', async () => {
    const { body } = await createSeries({
      name: 'Unannounced Series',
      description: 'Not public yet.',
    });

    const publicList = await api<Series[]>('/api/user/series');
    expect(publicList.body.map((series) => series.id)).not.toContain(body.id);

    expect((await api(`/api/user/series/${body.slug}`)).status).toBe(404);
  });

  it('publishes a series and then serves it without a login', async () => {
    const { body } = await createSeries({
      name: 'Public Series',
      description: 'Visible once published.',
      websiteUrl: 'https://example.org',
    });

    const published = await api<Series>(
      `/api/admin/series/${body.id}`,
      asAdmin({
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      }),
    );
    expect(published.status).toBe(200);

    const publicView = await api<Series>(`/api/user/series/${body.slug}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.name).toBe('Public Series');
    expect(publicView.body.websiteUrl).toBe('https://example.org');
    // The public payload is a different shape, not the organizer's with fields
    // blanked out.
    expect(publicView.body.status).toBeUndefined();
    expect(publicView.body.createdAt).toBeUndefined();
  });

  it('rejects a series without a description, which FR 2.1 makes mandatory', async () => {
    const response = await api('/api/admin/series', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'No Description' }),
    });

    expect(response.status).toBe(400);
  });

  it('rejects a website that is not a URL', async () => {
    const response = await api('/api/admin/series', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        name: 'Bad Website',
        description: 'Has a bare word as a website.',
        websiteUrl: 'example.org',
      }),
    });

    // Phase 0 learned this one: `IsUrl` alone accepts a bare word.
    expect(response.status).toBe(400);
  });

  it('rejects a field it does not know, rather than dropping it silently', async () => {
    const response = await api('/api/admin/series', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        name: 'Typo',
        description: 'Has a misspelled field.',
        websiteURL: 'https://example.org',
      }),
    });

    expect(response.status).toBe(400);
  });

  it('numbers the address when two series share a name', async () => {
    const first = await createSeries({
      name: 'Same Name',
      description: 'First.',
    });
    const second = await createSeries({
      name: 'Same Name',
      description: 'Second.',
    });

    expect(second.body.slug).toBe(`${first.body.slug}-2`);
  });

  it('leaves the public address alone when the name changes', async () => {
    const { body } = await createSeries({
      name: 'Original Name',
      description: 'A series that gets renamed.',
    });

    const renamed = await api<Series>(
      `/api/admin/series/${body.id}`,
      asAdmin({
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Corrected Name' }),
      }),
    );

    expect(renamed.body.name).toBe('Corrected Name');
    expect(renamed.body.slug).toBe('original-name');
  });

  it('answers 404 for an unknown id and 400 for something that is not an id', async () => {
    expect(
      (
        await api(
          '/api/admin/series/11111111-1111-4111-8111-111111111111',
          asAdmin(),
        )
      ).status,
    ).toBe(404);
    expect((await api('/api/admin/series/not-a-uuid', asAdmin())).status).toBe(
      400,
    );
  });

  it('deletes a series', async () => {
    const { body } = await createSeries({
      name: 'Created By Mistake',
      description: 'To be removed.',
    });

    const deleted = await api(
      `/api/admin/series/${body.id}`,
      asAdmin({ method: 'DELETE' }),
    );

    expect(deleted.status).toBe(204);
    expect((await api(`/api/admin/series/${body.id}`, asAdmin())).status).toBe(
      404,
    );
  });
});
