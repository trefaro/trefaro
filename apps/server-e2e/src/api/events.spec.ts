import { api, postJson } from '../support/api-client';

/**
 * Contract of the event endpoints (FR 3.1, FR 3.2, FR 3.9, FR 2.3).
 *
 * The assertions that matter are the two visibility rules and the publish rule:
 * a draft event is absent rather than forbidden, an event of a series that is
 * not public is absent too — its own status cannot override its series' — and
 * publishing requires whatever makes the event reachable.
 *
 * Logs in once; see `admin-access.spec.ts` for why that matters.
 */
const SESSION_COOKIE = 'trefaro_admin_session';

const credentials = {
  email: process.env['ADMIN_BOOTSTRAP_EMAIL'] ?? '',
  password: process.env['ADMIN_BOOTSTRAP_PASSWORD'] ?? '',
};

interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  seriesId: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string | null;
  venueAddress: string | null;
  onlineUrl: string | null;
  languages: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

function cookieFrom(headers: Headers): string {
  for (const header of headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [key, ...rest] = pair.split('=');
    if (key.trim() === SESSION_COOKIE)
      return `${SESSION_COOKIE}=${rest.join('=')}`;
  }
  return '';
}

/** The minimum an on-site event needs, before any test twists one field. */
const ONSITE = {
  name: 'Kickoff in Köln',
  description: 'The opening weekend.',
  eventType: 'onsite',
  startsAt: '2027-03-28T08:00:00.000Z',
  endsAt: '2027-03-30T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
} as const;

describe('events API', () => {
  let cookie = '';
  /** Series ids created here; deleting them takes their events with them. */
  const created: string[] = [];
  let publishedSeries: Series;
  let draftSeries: Series;

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const createSeries = async (
    payload: Record<string, unknown>,
  ): Promise<Series> => {
    const response = await api<Series>(
      '/api/admin/series',
      asAdminJson('POST', payload),
    );
    created.push(response.body.id);
    return response.body;
  };

  const createEvent = (
    seriesId: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: number; body: Event }> =>
    api<Event>(
      `/api/admin/series/${seriesId}/events`,
      asAdminJson('POST', payload),
    ).then((response) => ({ status: response.status, body: response.body }));

  beforeAll(async () => {
    if (!credentials.email || !credentials.password) {
      throw new Error(
        'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set for the API contract tests.',
      );
    }
    const login = await postJson('/api/admin/auth/login', credentials);
    cookie = cookieFrom(login.headers);

    publishedSeries = await createSeries({
      name: 'Events Contract Published Series',
      description: 'Holds the publicly visible events of this suite.',
      status: 'published',
    });
    draftSeries = await createSeries({
      name: 'Events Contract Draft Series',
      description: 'Holds events that must stay invisible.',
    });
  });

  afterAll(async () => {
    // Leave the instance as it was found — other specs read the public list.
    for (const id of created) {
      await api(`/api/admin/series/${id}`, asAdmin({ method: 'DELETE' }));
    }
  });

  it('needs a session to list the events of a series', async () => {
    const response = await api(
      `/api/admin/series/${publishedSeries.id}/events`,
    );

    expect(response.status).toBe(401);
  });

  it('derives a readable address and starts as a draft', async () => {
    const { status, body } = await createEvent(publishedSeries.id, ONSITE);

    expect(status).toBe(201);
    // Transliterated, not stripped — "kln" would be useless.
    expect(body.slug).toBe('kickoff-in-koeln');
    expect(body.status).toBe('draft');
    expect(body.seriesId).toBe(publishedSeries.id);
  });

  it('lets two series each hold the same address', async () => {
    const here = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Shared Address',
    });
    const there = await createEvent(draftSeries.id, {
      ...ONSITE,
      name: 'Shared Address',
    });

    // Unique per series, not per instance (E7): the series is part of the URL.
    expect(there.body.slug).toBe(here.body.slug);
  });

  it('keeps a draft event out of the public list and answers 404 for it', async () => {
    const { body } = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Unannounced Event',
    });

    const list = await api<Event[]>(
      `/api/user/series/${publishedSeries.slug}/events`,
    );
    expect(list.body.map((event) => event.id)).not.toContain(body.id);

    const single = await api(
      `/api/user/series/${publishedSeries.slug}/events/${body.slug}`,
    );
    expect(single.status).toBe(404);
  });

  it('hides a published event whose series is not published', async () => {
    const { body } = await createEvent(draftSeries.id, {
      ...ONSITE,
      name: 'Published In A Draft Series',
      status: 'published',
    });
    expect(body.status).toBe('published');

    // The series decides first; an event cannot publish itself into visibility.
    expect(
      (await api(`/api/user/series/${draftSeries.slug}/events`)).status,
    ).toBe(404);
    expect(
      (
        await api(
          `/api/user/series/${draftSeries.slug}/events/${body.slug}`,
        )
      ).status,
    ).toBe(404);
  });

  it('serves a published hybrid event with both its venue and its link', async () => {
    const { body } = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Hybrid Event',
      eventType: 'hybrid',
      venueAddress: 'Kalk-Mülheimer Str. 58, 51103 Köln',
      onlineUrl: 'https://stream.example.org/hybrid',
      status: 'published',
    });

    const publicView = await api<Event>(
      `/api/user/series/${publishedSeries.slug}/events/${body.slug}`,
    );

    expect(publicView.status).toBe(200);
    expect(publicView.body.eventType).toBe('hybrid');
    expect(publicView.body.venueName).toBe('Bürgerhaus Kalk');
    expect(publicView.body.onlineUrl).toBe('https://stream.example.org/hybrid');
    expect(publicView.body.timezone).toBe('Europe/Berlin');
    expect(publicView.body.languages).toEqual(['de', 'en']);
    // The public payload is a different shape, not the organizer's with fields
    // blanked out.
    expect(publicView.body.status).toBeUndefined();
    expect(publicView.body.seriesId).toBeUndefined();
    expect(publicView.body.createdAt).toBeUndefined();
  });

  it('lists published events of a published series in date order', async () => {
    const series = await createSeries({
      name: 'Ordered Events Series',
      description: 'Two events, deliberately created out of order.',
      status: 'published',
    });
    const later = await createEvent(series.id, {
      ...ONSITE,
      name: 'Closing',
      startsAt: '2027-06-01T08:00:00.000Z',
      endsAt: '2027-06-01T16:00:00.000Z',
      status: 'published',
    });
    const earlier = await createEvent(series.id, {
      ...ONSITE,
      name: 'Opening',
      status: 'published',
    });

    const list = await api<Event[]>(`/api/user/series/${series.slug}/events`);

    expect(list.body.map((event) => event.id)).toEqual([
      earlier.body.id,
      later.body.id,
    ]);
  });

  it('refuses to publish an on-site event without a venue', async () => {
    const response = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'No Venue Yet',
      venueName: null,
      status: 'published',
    });

    expect(response.status).toBe(400);
  });

  it('refuses to publish a hybrid event that has no link', async () => {
    const { body } = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Hybrid Without Link',
      eventType: 'hybrid',
    });

    const response = await api(
      `/api/admin/events/${body.id}`,
      asAdminJson('PATCH', { status: 'published' }),
    );

    expect(response.status).toBe(400);
  });

  it('accepts a draft that is still missing its venue', async () => {
    // Planning starts before the venue is booked; demanding it up front would
    // only produce a placeholder.
    const response = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Date First, Venue Later',
      venueName: null,
    });

    expect(response.status).toBe(201);
    expect(response.body.venueName).toBeNull();
  });

  it('accepts switching type and adding the link in one request', async () => {
    const { body } = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Turns Hybrid',
    });

    const response = await api<Event>(
      `/api/admin/events/${body.id}`,
      asAdminJson('PATCH', {
        eventType: 'hybrid',
        onlineUrl: 'https://stream.example.org/turned',
        status: 'published',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('published');
  });

  it('refuses an event that ends before it starts', async () => {
    const response = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Backwards',
      endsAt: '2027-03-27T08:00:00.000Z',
    });

    expect(response.status).toBe(400);
  });

  it('refuses a time zone that is not one', async () => {
    const response = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Atlantis',
      timezone: 'Europe/Atlantis',
    });

    expect(response.status).toBe(400);
  });

  it('refuses an event without a language', async () => {
    const response = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Speechless',
      languages: [],
    });

    expect(response.status).toBe(400);
  });

  it('refuses an unknown event type', async () => {
    const response = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Telepathic',
      eventType: 'telepathic',
    });

    expect(response.status).toBe(400);
  });

  it('refuses a field it does not know, rather than dropping it silently', async () => {
    const response = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Typo',
      venuName: 'Bürgerhaus Kalk',
    });

    expect(response.status).toBe(400);
  });

  it('says 404 for an event in a series that does not exist', async () => {
    const response = await api(
      '/api/admin/series/11111111-1111-4111-8111-111111111111/events',
      asAdmin(),
    );

    expect(response.status).toBe(404);
  });

  it('leaves the public address alone when the name changes', async () => {
    const { body } = await createEvent(publishedSeries.id, {
      ...ONSITE,
      name: 'Original Event Name',
    });

    const renamed = await api<Event>(
      `/api/admin/events/${body.id}`,
      asAdminJson('PATCH', { name: 'Corrected Event Name' }),
    );

    // A link that is already out there must survive a fixed typo.
    expect(renamed.body.slug).toBe(body.slug);
    expect(renamed.body.name).toBe('Corrected Event Name');
  });

  it('deletes a series together with its events', async () => {
    const series = await createSeries({
      name: 'Series To Delete',
      description: 'Its event must go with it.',
    });
    const { body } = await createEvent(series.id, {
      ...ONSITE,
      name: 'Goes With Its Series',
    });

    const removed = await api(
      `/api/admin/series/${series.id}`,
      asAdmin({ method: 'DELETE' }),
    );

    expect(removed.status).toBe(204);
    expect(
      (await api(`/api/admin/events/${body.id}`, asAdmin())).status,
    ).toBe(404);
  });
});
