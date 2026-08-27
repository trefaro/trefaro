import { api, postJson } from '../support/api-client';
import { adminCookie } from '../support/admin-session';
import {
  closeDatabase,
  deleteRegistrations,
  seedManyRegistrations,
  seedRegistrations,
} from '../support/database';
import {
  confirmationTokenFrom,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of the participant overview (FR 3.3, E13, E14) — AP 5.
 *
 * The highest rated function of the survey (3,86/4), and the one the phase plan
 * expects to fail first at volume. This suite therefore asserts two different
 * things: that the table answers correctly, and that it still answers quickly
 * with two thousand registrations in it.
 *
 * The fixtures go in through SQL rather than through the public registration
 * endpoint. That endpoint sends a mail per attempt and is rate limited on
 * purpose (AP 4), and the statuses this suite needs — cancelled, cancelled after
 * a confirmation, never confirmed — cannot all be produced from outside. One
 * test still walks the whole real path, so the link between the two work
 * packages is asserted rather than assumed.
 */
/**
 * What a page of the overview may take, in milliseconds.
 *
 * Generous on purpose: a shared CI runner is not a benchmark, and a strict
 * budget here would fail for reasons that have nothing to do with the code. It
 * is still far below what a missing index or a full-table read would cost — the
 * failure this is meant to catch is an order of magnitude, not a percentage.
 * The measured numbers are logged, so a slow trend is visible before it breaks.
 */
const BUDGET_MS = 1_500;

/** The volume the phase plan names for this work package. */
const LOAD_ROWS = 2_000;

interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  slug: string;
}

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  newsletterOptIn: boolean;
  registeredAt: string;
  confirmedAt: string | null;
}

interface Page {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
  };
}

interface Statistics {
  weeks: { weekStart: string; total: number; confirmed: number }[];
  counts: Page['counts'];
  timezone: string;
}

const stamp = Date.now();
const address = (name: string): string =>
  `${name}-${stamp}@participants.example.org`;

const FUTURE_EVENT = {
  name: 'Participant Overview Event',
  description: 'The event whose participants this suite reads.',
  eventType: 'onsite',
  startsAt: '2099-05-12T08:00:00.000Z',
  endsAt: '2099-05-12T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

/**
 * Placed in three different calendar weeks, so the graph has something to show —
 * and each row at its own minute, so "newest first" has one right answer.
 */
const WEEK_ONE = '2026-08-04T09:00:00.000Z';
const WEEK_THREE_EARLY = '2026-08-18T09:00:00.000Z';
const WEEK_THREE_LATE = '2026-08-18T11:00:00.000Z';
const WEEK_FOUR_EARLY = '2026-08-25T09:00:00.000Z';
const WEEK_FOUR_LATE = '2026-08-25T11:00:00.000Z';

describe('participant overview API', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  let otherEvent: Event;
  let loadEvent: Event;
  const seeded: Record<string, string> = {};

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const list = (eventId: string, query = '') =>
    api<Page>(
      `/api/admin/events/${eventId}/registrations${query ? `?${query}` : ''}`,
      asAdmin(),
    );

  beforeAll(async () => {
    await waitForMailpit();

    cookie = adminCookie();

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Participant Overview Series ${stamp}`,
          description: 'Holds the events whose participants this suite reads.',
          status: 'published',
        }),
      )
    ).body;

    const createEvent = async (
      payload: Record<string, unknown>,
    ): Promise<Event> =>
      (
        await api<Event>(
          `/api/admin/series/${series.id}/events`,
          asAdminJson('POST', payload),
        )
      ).body;

    event = await createEvent(FUTURE_EVENT);
    otherEvent = await createEvent({
      ...FUTURE_EVENT,
      name: 'Participant Overview Other Event',
    });
    loadEvent = await createEvent({
      ...FUTURE_EVENT,
      name: 'Participant Overview Load Event',
    });

    const [amina, bruno, chiara, dieter, emile] = await seedRegistrations(
      event.id,
      [
        {
          email: address('amina'),
          firstName: 'Amina',
          lastName: 'Okonkwo',
          status: 'confirmed',
          origin: 'Cologne',
          newsletterOptIn: true,
          registeredAt: WEEK_ONE,
        },
        {
          email: address('bruno'),
          firstName: 'Bruno',
          lastName: 'Adeyemi',
          status: 'pending',
          registeredAt: WEEK_THREE_EARLY,
        },
        {
          email: address('chiara'),
          firstName: 'Chiara',
          lastName: 'Okonkwo',
          status: 'cancelled',
          neverConfirmed: true,
          registeredAt: WEEK_THREE_LATE,
        },
        {
          email: address('dieter'),
          firstName: 'Dieter',
          lastName: 'Zimmermann',
          status: 'cancelled',
          registeredAt: WEEK_FOUR_EARLY,
        },
        {
          email: address('emile'),
          firstName: 'Émile',
          lastName: 'Bernard',
          status: 'confirmed',
          registeredAt: WEEK_FOUR_LATE,
        },
      ],
    );
    Object.assign(seeded, { amina, bruno, chiara, dieter, emile });

    // One row on a different event of the same series: no filter may reach it.
    await seedRegistrations(otherEvent.id, [
      {
        email: address('elsewhere'),
        firstName: 'Neighbour',
        lastName: 'Okonkwo',
        status: 'confirmed',
      },
    ]);
  });

  afterAll(async () => {
    for (const id of [event?.id, otherEvent?.id, loadEvent?.id]) {
      if (id) await deleteRegistrations(id);
    }
    if (series?.id) {
      await api(
        `/api/admin/series/${series.id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
    await closeDatabase();
  });

  describe('the table', () => {
    it('shows every registration newest first, with the address in the row', async () => {
      const response = await list(event.id);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(5);
      expect(response.body.page).toBe(1);
      expect(response.body.rows.map((row) => row.firstName)).toEqual([
        'Émile',
        'Dieter',
        'Chiara',
        'Bruno',
        'Amina',
      ]);
      // The one correction the usability test of the thesis produced (E13).
      for (const row of response.body.rows) {
        expect(row.email).toMatch(/@participants\.example\.org$/);
      }
    });

    it('counts the whole event even when a page shows two rows', async () => {
      const response = await list(event.id, 'pageSize=2&page=2');

      expect(response.body.rows).toHaveLength(2);
      expect(response.body.total).toBe(5);
      expect(response.body.pageSize).toBe(2);
      expect(response.body.counts).toEqual({
        total: 5,
        pending: 1,
        confirmed: 2,
        cancelled: 2,
      });
    });

    it('does not repeat or skip a row between two pages', async () => {
      const first = await list(event.id, 'pageSize=2&page=1');
      const second = await list(event.id, 'pageSize=2&page=2');
      const third = await list(event.id, 'pageSize=2&page=3');

      const ids = [...first.body.rows, ...second.body.rows, ...third.body.rows]
        .map((row) => row.id)
        .sort();
      expect(new Set(ids).size).toBe(5);
    });

    it('filters by status', async () => {
      const response = await list(event.id, 'status=cancelled');

      expect(response.body.total).toBe(2);
      expect(
        response.body.rows.every((row) => row.status === 'cancelled'),
      ).toBe(true);
      // Unfiltered, so the interface can say what the filter is a subset of.
      expect(response.body.counts.total).toBe(5);
    });

    it('searches over name and e-mail, in either word order', async () => {
      const bySurname = await list(event.id, 'search=okonkwo');
      const bothWords = await list(event.id, 'search=okonkwo%20chiara');
      const byAddress = await list(event.id, `search=${address('dieter')}`);

      expect(bySurname.body.total).toBe(2);
      expect(bothWords.body.total).toBe(1);
      expect(bothWords.body.rows[0].firstName).toBe('Chiara');
      expect(byAddress.body.total).toBe(1);
      expect(byAddress.body.rows[0].firstName).toBe('Dieter');
    });

    it('never reaches a registration of another event', async () => {
      const response = await list(event.id, 'search=neighbour');

      expect(response.body.total).toBe(0);
    });

    it('treats a wildcard in the search box as a character', async () => {
      const response = await list(event.id, 'search=%25');

      // Without escaping, `%` would match every participant — a filter that
      // quietly stops filtering.
      expect(response.body.total).toBe(0);
    });

    it('sorts by name, case-insensitively', async () => {
      const response = await list(event.id, 'sort=name&direction=asc');

      expect(response.body.rows.map((row) => row.lastName)).toEqual([
        'Adeyemi',
        'Bernard',
        'Okonkwo',
        'Okonkwo',
        'Zimmermann',
      ]);
      // Within the same surname, the first name decides.
      expect(response.body.rows[2].firstName).toBe('Amina');
    });

    it('sorts by status with the ones needing attention first', async () => {
      const response = await list(event.id, 'sort=status&direction=asc');

      expect(response.body.rows[0].status).toBe('pending');
      expect(response.body.rows.at(-1)?.status).toBe('cancelled');
    });

    it('sorts by e-mail address', async () => {
      const response = await list(event.id, 'sort=email&direction=asc');

      const addresses = response.body.rows.map((row) => row.email);
      expect([...addresses].sort()).toEqual(addresses);
    });

    it('rejects a query parameter it does not know', async () => {
      const response = await list(event.id, 'orderBy=salary');

      // `forbidNonWhitelisted`: a mistyped parameter must not be ignored, or a
      // filter silently does nothing.
      expect(response.status).toBe(400);
    });

    it('rejects a page size that is not a page size', async () => {
      expect((await list(event.id, 'pageSize=0')).status).toBe(400);
      expect((await list(event.id, 'page=abc')).status).toBe(400);
    });

    it('answers 404 for an event that does not exist', async () => {
      const response = await list('00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
    });

    it('answers 400 for something that is not an id at all', async () => {
      const response = await list('not-a-uuid');

      expect(response.status).toBe(400);
    });

    it('lets nobody read participants without a session', async () => {
      const response = await api(`/api/admin/events/${event.id}/registrations`);

      expect(response.status).toBe(401);
    });
  });

  describe('the weekly graph', () => {
    it("counts the weeks in the event's own time zone", async () => {
      const response = await api<Statistics>(
        `/api/admin/events/${event.id}/registrations/statistics`,
        asAdmin(),
      );

      expect(response.status).toBe(200);
      expect(response.body.timezone).toBe('Europe/Berlin');
      expect(response.body.counts.total).toBe(5);
      // Three weeks hold rows, and the quiet week between them is filled in, so
      // the curve does not turn a lull into a plateau.
      expect(response.body.weeks.map((week) => week.weekStart)).toEqual([
        '2026-08-03',
        '2026-08-10',
        '2026-08-17',
        '2026-08-24',
      ]);
      expect(response.body.weeks[1]).toEqual({
        weekStart: '2026-08-10',
        total: 0,
        confirmed: 0,
      });
      expect(response.body.weeks[0]).toEqual({
        weekStart: '2026-08-03',
        total: 1,
        confirmed: 1,
      });
    });

    it('is not readable without a session either', async () => {
      const response = await api(
        `/api/admin/events/${event.id}/registrations/statistics`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('one registration', () => {
    it('names the event it belongs to', async () => {
      const response = await api<Row & { eventName: string; eventId: string }>(
        `/api/admin/registrations/${seeded.amina}`,
        asAdmin(),
      );

      expect(response.status).toBe(200);
      expect(response.body.eventName).toBe('Participant Overview Event');
      expect(response.body.eventId).toBe(event.id);
      expect(response.body.newsletterOptIn).toBe(true);
      expect(response.body.confirmedAt).not.toBeNull();
    });

    it('answers 404 for an id nothing matches', async () => {
      const response = await api(
        '/api/admin/registrations/00000000-0000-0000-0000-000000000000',
        asAdmin(),
      );

      expect(response.status).toBe(404);
    });

    it('cancels a confirmed registration and keeps the confirmation date', async () => {
      const response = await api<Row>(
        `/api/admin/registrations/${seeded.emile}`,
        asAdminJson('PATCH', { status: 'cancelled' }),
      );

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
      expect(response.body.confirmedAt).not.toBeNull();

      // Put it back, so the tests above keep their fixture.
      await api(
        `/api/admin/registrations/${seeded.emile}`,
        asAdminJson('PATCH', { status: 'confirmed' }),
      );
    });

    it('reinstates a cancelled registration that had been confirmed', async () => {
      const response = await api<Row>(
        `/api/admin/registrations/${seeded.dieter}`,
        asAdminJson('PATCH', { status: 'confirmed' }),
      );

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('confirmed');

      await api(
        `/api/admin/registrations/${seeded.dieter}`,
        asAdminJson('PATCH', { status: 'cancelled' }),
      );
    });

    it('refuses to confirm an address the participant never confirmed', async () => {
      const response = await api(
        `/api/admin/registrations/${seeded.chiara}`,
        asAdminJson('PATCH', { status: 'confirmed' }),
      );

      // Nothing would tell a hand-set status from a real double opt-in
      // afterwards (E5, F23).
      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toMatch(/submit the form again/);
    });

    it('rejects a status that is not one', async () => {
      const response = await api(
        `/api/admin/registrations/${seeded.bruno}`,
        asAdminJson('PATCH', { status: 'attending' }),
      );

      expect(response.status).toBe(400);
    });

    it('lets nobody change a registration without a session', async () => {
      const response = await api(`/api/admin/registrations/${seeded.bruno}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('a registration from the real form', () => {
    it('appears in the overview once the participant confirmed', async () => {
      const email = address('walkthrough');
      const registration = await postJson(
        `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
        {
          firstName: 'Walk',
          lastName: 'Through',
          email,
          origin: 'Cologne',
        },
      );
      expect(registration.status).toBe(202);

      const token = confirmationTokenFrom(await waitForMailTo(email));
      expect(
        (await postJson('/api/user/registrations/confirm', { token })).status,
      ).toBe(200);

      const found = await list(event.id, `search=${encodeURIComponent(email)}`);
      expect(found.body.total).toBe(1);
      expect(found.body.rows[0].status).toBe('confirmed');
      expect(found.body.rows[0].lastName).toBe('Through');

      // Deleting it again is what an erasure request looks like (E14).
      const removed = await api(
        `/api/admin/registrations/${found.body.rows[0].id}`,
        asAdmin({ method: 'DELETE' }),
      );
      expect(removed.status).toBe(204);
      expect(
        (await list(event.id, `search=${encodeURIComponent(email)}`)).body
          .total,
      ).toBe(0);
    });
  });

  /**
   * The acceptance criterion of AP 5: two thousand registrations, and the table
   * still pages and searches without a noticeable delay.
   *
   * Two thousand is what the risk table of the phase plan names — a large event
   * for a small organization, and the volume at which a screen that reads
   * everything into memory stops working.
   */
  describe(`with ${LOAD_ROWS} registrations`, () => {
    const timings: Record<string, number> = {};

    const timed = async (label: string, query: string): Promise<Page> => {
      const started = performance.now();
      const response = await list(loadEvent.id, query);
      timings[label] = Math.round(performance.now() - started);
      expect(response.status).toBe(200);
      return response.body;
    };

    beforeAll(async () => {
      await seedManyRegistrations(loadEvent.id, LOAD_ROWS, `load-${stamp}`);
      // Not measured: the first request pays for the connection pool and the
      // query plan cache.
      await list(loadEvent.id);
    }, 120_000);

    afterAll(() => {
      // Reported rather than only asserted, so a slow trend is visible in the
      // build log before it becomes a failure. Straight to stdout: the runner
      // captures `console` per test and would file this under the last one.
      process.stdout.write(
        `\nParticipant overview, ${LOAD_ROWS} registrations (ms): ` +
          `${JSON.stringify(timings)}\n`,
      );
    });

    it('reads the first page', async () => {
      const page = await timed('firstPage', 'pageSize=25');

      expect(page.total).toBe(LOAD_ROWS);
      expect(page.rows).toHaveLength(25);
      expect(timings['firstPage']).toBeLessThan(BUDGET_MS);
    });

    it('reads a page deep in the table', async () => {
      const page = await timed('page60', 'pageSize=25&page=60');

      expect(page.rows).toHaveLength(25);
      expect(timings['page60']).toBeLessThan(BUDGET_MS);
    });

    it('searches for one participant among all of them', async () => {
      const page = await timed('searchOne', 'search=load01234');

      expect(page.total).toBe(1);
      expect(timings['searchOne']).toBeLessThan(BUDGET_MS);
    });

    it('searches for a term that matches every row', async () => {
      // The worst case for a substring search: nothing is filtered out.
      const page = await timed('searchAll', 'search=load');

      expect(page.total).toBe(LOAD_ROWS);
      expect(timings['searchAll']).toBeLessThan(BUDGET_MS);
    });

    it('sorts by name over the whole table', async () => {
      await timed('sortByName', 'sort=name&direction=asc&pageSize=25');

      expect(timings['sortByName']).toBeLessThan(BUDGET_MS);
    });

    it('filters by status', async () => {
      const page = await timed('filterConfirmed', 'status=confirmed');

      expect(page.total).toBeGreaterThan(0);
      expect(page.total).toBeLessThan(LOAD_ROWS);
      expect(timings['filterConfirmed']).toBeLessThan(BUDGET_MS);
    });

    it('draws the weekly graph', async () => {
      const started = performance.now();
      const response = await api<Statistics>(
        `/api/admin/events/${loadEvent.id}/registrations/statistics`,
        asAdmin(),
      );
      timings['statistics'] = Math.round(performance.now() - started);

      expect(response.status).toBe(200);
      expect(response.body.counts.total).toBe(LOAD_ROWS);
      expect(response.body.weeks.length).toBeGreaterThan(1);
      expect(timings['statistics']).toBeLessThan(BUDGET_MS);
    });
  });
});
