import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of the content translations (FR 3.12, E25) — AP 11 of phase 2.
 *
 * This suite proves the acceptance criterion of the work package end to end,
 * against a real database: an event with a German translation reads German in
 * German and English in English, a session without one shows its original rather
 * than a gap, `venueAddress` is the same string in every language, and deleting
 * an event takes its translations with it.
 *
 * Four things can only be shown here and not in a unit test:
 *
 * - **The cascade.** `ON DELETE CASCADE` is the whole reason nobody has to
 *   remember to tidy translations up, and only the database can be asked whether
 *   it works.
 * - **`?locale=` on the public endpoints**, including that a malformed tag is a
 *   400 while an untranslated one is the original page.
 * - **The composite key.** Writing `de` twice is one row, and `de-AT` and
 *   `de-at` are one language.
 * - **That a cleared translation leaves no row**, which is what every count of
 *   translated languages depends on.
 *
 * Logs in once; see `admin-access.spec.ts` for why that matters.
 */
interface Series {
  id: string;
  slug: string;
  name: string;
  description: string;
}

interface Event {
  id: string;
  slug: string;
  name: string;
  description: string;
  venueName: string | null;
  venueAddress: string | null;
  followUpBody: string | null;
}

interface Item {
  id: string;
  title: string;
  description: string | null;
  speaker: string | null;
}

interface Translations<T> {
  id: string;
  source: T;
  translations: Record<string, T>;
}

interface EventScreen extends Translations<Record<string, string | null>> {
  timezone: string;
  programItems: (Translations<Record<string, string | null>> & {
    startsAt: string;
  })[];
}

/** A one-day conference in Cologne, long enough ago to be over. */
const EVENT = {
  name: 'Translation Contract Event',
  description: 'The event this suite translates.',
  eventType: 'onsite',
  startsAt: '2020-06-14T06:00:00.000Z',
  endsAt: '2020-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Town Hall',
  venueAddress: 'Kalker Hauptstraße 247, 51103 Köln',
  languages: ['en'],
  status: 'published',
  followUpBody: 'Thank you for coming.',
} as const;

const KEYNOTE = {
  title: 'Keynote',
  description: 'How a citizens’ assembly works.',
  speaker: 'Ada Lovelace',
  startsAt: '2020-06-14T07:00:00.000Z',
  endsAt: '2020-06-14T08:30:00.000Z',
} as const;

describe('content translations API', () => {
  let cookie = '';
  const created: string[] = [];
  let series: Series;
  let event: Event;
  let keynote: Item;

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const writeSeries = (locale: string, payload: unknown) =>
    api(
      `/api/admin/series/${series.id}/translations/${locale}`,
      asAdminJson('PUT', payload),
    );

  const writeEvent = (locale: string, payload: unknown) =>
    api(
      `/api/admin/events/${event.id}/translations/${locale}`,
      asAdminJson('PUT', payload),
    );

  const writeItem = (locale: string, payload: unknown) =>
    api(
      `/api/admin/program-items/${keynote.id}/translations/${locale}`,
      asAdminJson('PUT', payload),
    );

  const seriesScreen = () =>
    api<Translations<Record<string, string | null>>>(
      `/api/admin/series/${series.id}/translations`,
      asAdmin(),
    );

  const eventScreen = () =>
    api<EventScreen>(`/api/admin/events/${event.id}/translations`, asAdmin());

  const publicEvent = (locale?: string) =>
    api<Event>(
      `/api/user/series/${series.slug}/events/${event.slug}` +
        (locale === undefined ? '' : `?locale=${locale}`),
    );

  const publicProgram = (locale?: string) =>
    api<Item[]>(
      `/api/user/series/${series.slug}/events/${event.slug}/program` +
        (locale === undefined ? '' : `?locale=${locale}`),
    );

  beforeAll(async () => {
    cookie = adminCookie();

    const seriesResponse = await api<Series>(
      '/api/admin/series',
      asAdminJson('POST', {
        name: 'Translation Contract Series',
        description: 'Holds the event this suite translates.',
        status: 'published',
      }),
    );
    series = seriesResponse.body;
    created.push(series.id);

    const eventResponse = await api<Event>(
      `/api/admin/series/${series.id}/events`,
      asAdminJson('POST', EVENT),
    );
    expect(
      `${eventResponse.status} ${JSON.stringify(eventResponse.body)}`,
    ).toMatch(/^201/);
    event = eventResponse.body;

    const itemResponse = await api<Item>(
      `/api/admin/events/${event.id}/program-items`,
      asAdminJson('POST', KEYNOTE),
    );
    expect(
      `${itemResponse.status} ${JSON.stringify(itemResponse.body)}`,
    ).toMatch(/^201/);
    keynote = itemResponse.body;
  });

  afterAll(async () => {
    for (const id of created) {
      await api(`/api/admin/series/${id}`, asAdmin({ method: 'DELETE' }));
    }
  });

  afterEach(async () => {
    for (const locale of ['de', 'de-at', 'fr']) {
      await api(
        `/api/admin/series/${series.id}/translations/${locale}`,
        asAdmin({ method: 'DELETE' }),
      );
      await api(
        `/api/admin/events/${event.id}/translations/${locale}`,
        asAdmin({ method: 'DELETE' }),
      );
      await api(
        `/api/admin/program-items/${keynote.id}/translations/${locale}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
  });

  describe('the guard', () => {
    it('needs a session to read a translation screen', async () => {
      expect(
        (await api(`/api/admin/events/${event.id}/translations`)).status,
      ).toBe(401);
    });

    it('needs a session to write one', async () => {
      const response = await api(
        `/api/admin/events/${event.id}/translations/de`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Auftakt' }),
        },
      );

      expect(response.status).toBe(401);
    });
  });

  describe('what a participant reads', () => {
    it('shows the translation in that language and the original in the other', async () => {
      await writeEvent('de', {
        name: 'Auftakt in Köln',
        description: 'Das Eröffnungswochenende.',
        venueName: 'Rathaus',
        followUpBody: 'Danke für Ihren Besuch.',
      });

      const german = await publicEvent('de');
      const english = await publicEvent('en');

      expect(german.body.name).toBe('Auftakt in Köln');
      expect(german.body.venueName).toBe('Rathaus');
      expect(german.body.followUpBody).toBe('Danke für Ihren Besuch.');
      expect(english.body.name).toBe(EVENT.name);
      expect(english.body.venueName).toBe(EVENT.venueName);
    });

    it('keeps the address identical in every language (E25)', async () => {
      await writeEvent('de', { name: 'Auftakt in Köln', venueName: 'Rathaus' });

      expect((await publicEvent('de')).body.venueAddress).toBe(
        EVENT.venueAddress,
      );
      expect((await publicEvent()).body.venueAddress).toBe(EVENT.venueAddress);
    });

    it('falls back field by field, so a half-translated event has no hole', async () => {
      await writeEvent('de', { name: 'Auftakt in Köln' });

      const german = await publicEvent('de');

      expect(german.body.name).toBe('Auftakt in Köln');
      expect(german.body.description).toBe(EVENT.description);
    });

    it('shows a session without a translation in its original', async () => {
      await writeEvent('de', { name: 'Auftakt in Köln' });

      const [item] = (await publicProgram('de')).body;

      expect(item.title).toBe(KEYNOTE.title);
      expect(item.speaker).toBe(KEYNOTE.speaker);
    });

    it('translates a session, and never its speaker', async () => {
      await writeItem('de', { title: 'Eröffnungsvortrag' });

      const [item] = (await publicProgram('de')).body;

      expect(item.title).toBe('Eröffnungsvortrag');
      expect(item.description).toBe(KEYNOTE.description);
      expect(item.speaker).toBe(KEYNOTE.speaker);
    });

    it('translates the series on the start page and in its own answer', async () => {
      await writeSeries('de', { name: 'Vertragsreihe' });

      const one = await api<Series>(
        `/api/user/series/${series.slug}?locale=de`,
      );
      const listed = await api<Series[]>('/api/user/series?locale=de');

      expect(one.body.name).toBe('Vertragsreihe');
      expect(
        listed.body.find((entry) => entry.slug === series.slug)?.name,
      ).toBe('Vertragsreihe');
    });

    it('renders the original for a language nobody has translated into', async () => {
      // A link somebody shared last year has to keep working, even after the
      // organization has stopped offering that language.
      const response = await publicEvent('fr');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(EVENT.name);
    });

    it('refuses something that is not a language tag', async () => {
      expect((await publicEvent('de_DE')).status).toBe(400);
      expect((await publicProgram('deutsch bitte')).status).toBe(400);
    });
  });

  describe('the organizer’s screen', () => {
    it('answers with the original beside every language it has', async () => {
      await writeSeries('de', { name: 'Vertragsreihe' });

      const screen = await seriesScreen();

      expect(screen.body.source['name']).toBe(series.name);
      expect(screen.body.translations['de']['name']).toBe('Vertragsreihe');
      expect(screen.body.translations['de']['description']).toBeNull();
    });

    it('brings the event and its whole programme in one request (F49)', async () => {
      await writeEvent('de', { name: 'Auftakt in Köln' });
      await writeItem('de', { title: 'Eröffnungsvortrag' });

      const screen = await eventScreen();

      expect(screen.body.timezone).toBe(EVENT.timezone);
      expect(screen.body.translations['de']['name']).toBe('Auftakt in Köln');
      expect(screen.body.programItems).toHaveLength(1);
      expect(screen.body.programItems[0].source['title']).toBe(KEYNOTE.title);
      expect(screen.body.programItems[0].translations['de']['title']).toBe(
        'Eröffnungsvortrag',
      );
    });

    it('reads de-AT and de-at as one language', async () => {
      await writeSeries('de-AT', { name: 'Erste' });
      await writeSeries('de-at', { name: 'Zweite' });

      const screen = await seriesScreen();

      expect(Object.keys(screen.body.translations)).toEqual(['de-at']);
      expect(screen.body.translations['de-at']['name']).toBe('Zweite');
    });

    it('accepts a language this instance does not offer (E30)', async () => {
      expect((await writeSeries('fr', { name: 'Série' })).status).toBe(200);
      expect((await seriesScreen()).body.translations['fr']['name']).toBe(
        'Série',
      );
    });

    it('refuses a tag that is not a language tag', async () => {
      expect((await writeSeries('de_DE', { name: 'x' })).status).toBe(400);
    });

    it('refuses a text longer than the original may be', async () => {
      expect((await writeSeries('de', { name: 'x'.repeat(201) })).status).toBe(
        400,
      );
    });

    it('leaves no row when the last field is cleared', async () => {
      await writeSeries('de', { name: 'Vertragsreihe' });
      await writeSeries('de', { name: '   ' });

      // Not an empty row: everything that counts translated languages counts
      // rows, and a row that says nothing would be counted as a translation.
      expect(Object.keys((await seriesScreen()).body.translations)).toEqual([]);
    });

    it('replaces rather than merges, so a cleared box can be expressed', async () => {
      await writeEvent('de', {
        name: 'Auftakt in Köln',
        description: 'Das Eröffnungswochenende.',
      });
      await writeEvent('de', { name: 'Auftakt in Köln' });

      expect(
        (await eventScreen()).body.translations['de']['description'],
      ).toBeNull();
    });

    it('deletes one language and leaves the others', async () => {
      await writeSeries('de', { name: 'Vertragsreihe' });
      await writeSeries('fr', { name: 'Série' });

      const removed = await api(
        `/api/admin/series/${series.id}/translations/de`,
        asAdmin({ method: 'DELETE' }),
      );

      expect(removed.status).toBe(204);
      expect(Object.keys((await seriesScreen()).body.translations)).toEqual([
        'fr',
      ]);
    });

    it('deletes idempotently — removing nothing is the state asked for', async () => {
      const response = await api(
        `/api/admin/series/${series.id}/translations/de`,
        asAdmin({ method: 'DELETE' }),
      );

      expect(response.status).toBe(204);
    });

    it('says 404 for a parent that does not exist', async () => {
      const missing = '00000000-0000-4000-8000-000000000000';

      expect(
        (await api(`/api/admin/events/${missing}/translations`, asAdmin()))
          .status,
      ).toBe(404);
      expect(
        (
          await api(
            `/api/admin/program-items/${missing}/translations/de`,
            asAdminJson('PUT', { title: 'x' }),
          )
        ).status,
      ).toBe(404);
    });
  });

  describe('deleting the parent', () => {
    it('takes the translations with it (ON DELETE CASCADE)', async () => {
      // A whole series of its own, so the deletion is the test rather than a
      // side effect on the fixtures above.
      const doomed = (
        await api<Series>(
          '/api/admin/series',
          asAdminJson('POST', {
            name: 'Translation Cascade Series',
            description: 'Deleted by this test, translations and all.',
          }),
        )
      ).body;
      const doomedEvent = (
        await api<Event>(
          `/api/admin/series/${doomed.id}/events`,
          asAdminJson('POST', { ...EVENT, name: 'Translation Cascade Event' }),
        )
      ).body;
      await api(
        `/api/admin/events/${doomedEvent.id}/translations/de`,
        asAdminJson('PUT', { name: 'Kaskadenauftakt' }),
      );

      expect(
        (
          await api(
            `/api/admin/series/${doomed.id}`,
            asAdmin({ method: 'DELETE' }),
          )
        ).status,
      ).toBe(204);

      // The event is gone, so its screen is a 404; what this proves is that the
      // delete succeeded at all — a translation row still pointing at the event
      // would have made the foreign key refuse it.
      expect(
        (
          await api(
            `/api/admin/events/${doomedEvent.id}/translations`,
            asAdmin(),
          )
        ).status,
      ).toBe(404);
    });
  });
});
