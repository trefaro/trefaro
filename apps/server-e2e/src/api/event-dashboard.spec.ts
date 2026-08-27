import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';
import {
  closeDatabase,
  deleteRegistrations,
  seedProgramSignups,
  seedRegistrations,
} from '../support/database';

/**
 * Contract of the event dashboard (FR 3.8) — AP 10.
 *
 * The acceptance criterion of the work package is that the numbers correspond to
 * a real data situation, so this suite builds one: registrations in three
 * statuses, a programme in which some sessions ask who is coming and some do
 * not, seats claimed in two of them, and a form with required and optional
 * questions. Then it changes the data and asks again — a dashboard that were
 * computed once and cached would pass every assertion above and fail the two at
 * the end.
 *
 * The second thing asserted here is what the response does *not* contain. Tiles
 * for modules that do not exist yet (messages in phase 3, programme proposals
 * and the forum in phase 4) must be absent rather than zero, and a shape
 * assertion is the only way to notice the day somebody adds a hard zero.
 *
 * Logs in once; see `admin-access.spec.ts` for why that matters.
 */
interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  slug: string;
}

interface Item {
  id: string;
  title: string;
}

interface Field {
  id: string;
}

interface Dashboard {
  event: {
    id: string;
    slug: string;
    name: string;
    status: string;
    seriesId: string;
  };
  seriesSlug: string;
  registrations: {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
  };
  latestRegistrations: {
    id: string;
    lastName: string;
    email: string;
    status: string;
    registeredAt: string;
  }[];
  program: { items: number; withSignup: number; signups: number };
  form: { questions: number; required: number };
}

/** A one-day conference in Cologne: 08:00 to 18:00 local, 14 June 2099. */
const EVENT = {
  name: 'Dashboard Contract Event',
  description: 'The event whose dashboard this suite reads.',
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

/**
 * Seven registrations, each at its own minute.
 *
 * Seven, because the dashboard shows five: with exactly five nobody would notice
 * a missing limit. Distinct minutes, because "newest first" has to have one
 * right answer.
 */
const PEOPLE = [
  { last: 'Aa', status: 'pending', at: '2026-08-20T09:01:00.000Z' },
  { last: 'Bb', status: 'confirmed', at: '2026-08-20T09:02:00.000Z' },
  { last: 'Cc', status: 'cancelled', at: '2026-08-20T09:03:00.000Z' },
  { last: 'Dd', status: 'pending', at: '2026-08-20T09:04:00.000Z' },
  { last: 'Ee', status: 'pending', at: '2026-08-20T09:05:00.000Z' },
  { last: 'Ff', status: 'confirmed', at: '2026-08-20T09:06:00.000Z' },
  { last: 'Gg', status: 'pending', at: '2026-08-20T09:07:00.000Z' },
] as const;

const stamp = Date.now();

describe('event dashboard API', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  /** Nothing at all on it: the dashboard of an event an organizer just created. */
  let emptyEvent: Event;
  let workshop: Item;
  let confirmedIds: readonly string[] = [];

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const dashboard = (eventId: string) =>
    api<Dashboard>(`/api/admin/events/${eventId}/dashboard`, asAdmin());

  beforeAll(async () => {
    cookie = adminCookie();

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Dashboard Contract Series ${stamp}`,
          description: 'Holds the event whose dashboard this suite reads.',
          status: 'published',
        }),
      )
    ).body;

    const createEvent = async (
      payload: Record<string, unknown>,
    ): Promise<Event> => {
      const response = await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson('POST', payload),
      );
      expect(`${response.status} ${JSON.stringify(response.body)}`).toMatch(
        /^201/,
      );
      return response.body;
    };

    event = await createEvent(EVENT);
    emptyEvent = await createEvent({
      ...EVENT,
      name: 'Dashboard Contract Empty Event',
      status: 'draft',
    });

    const ids = await seedRegistrations(
      event.id,
      PEOPLE.map((person) => ({
        email: `dashboard-${person.last}-${stamp}@contract.example.org`,
        firstName: 'Person',
        lastName: person.last,
        status: person.status,
        neverConfirmed: person.status === 'cancelled',
        registeredAt: person.at,
      })),
    );
    confirmedIds = [ids[1], ids[5]];

    const plan = async (payload: Record<string, unknown>): Promise<Item> => {
      const response = await api<Item>(
        `/api/admin/events/${event.id}/program-items`,
        asAdminJson('POST', payload),
      );
      expect(`${response.status} ${JSON.stringify(response.body)}`).toMatch(
        /^201/,
      );
      return response.body;
    };

    workshop = await plan({
      title: 'Workshop with two chairs',
      startsAt: '2099-06-14T07:00:00.000Z',
      endsAt: '2099-06-14T08:30:00.000Z',
      registrationEnabled: true,
      capacity: 2,
    });
    const roundtable = await plan({
      title: 'Roundtable without a limit',
      startsAt: '2099-06-14T09:00:00.000Z',
      endsAt: '2099-06-14T10:00:00.000Z',
      registrationEnabled: true,
    });
    await plan({
      title: 'Plenary everybody attends',
      startsAt: '2099-06-14T11:00:00.000Z',
      endsAt: '2099-06-14T12:00:00.000Z',
    });

    // Three seats across two sessions, claimed by the two confirmed people.
    await seedProgramSignups(workshop.id, confirmedIds);
    await seedProgramSignups(roundtable.id, [confirmedIds[0]]);

    const define = async (payload: Record<string, unknown>): Promise<Field> => {
      const response = await api<Field>(
        `/api/admin/events/${event.id}/registration-fields`,
        asAdminJson('POST', payload),
      );
      expect(`${response.status} ${JSON.stringify(response.body)}`).toMatch(
        /^201/,
      );
      return response.body;
    };

    await define({ label: 'Meal', type: 'text', required: true });
    await define({ label: 'Arrival', type: 'text', required: true });
    await define({ label: 'Anything else', type: 'text' });
  });

  afterAll(async () => {
    // Registrations first: a confirmed one blocks deleting the series (E14).
    await deleteRegistrations(event.id);
    await api(`/api/admin/series/${series.id}`, asAdmin({ method: 'DELETE' }));
    await closeDatabase();
  });

  it('counts the registrations of the whole event, by status', async () => {
    const response = await dashboard(event.id);

    expect(response.status).toBe(200);
    expect(response.body.registrations).toEqual({
      total: 7,
      pending: 4,
      confirmed: 2,
      cancelled: 1,
    });
  });

  it('lists the five newest registrations, newest first', async () => {
    const { body } = await dashboard(event.id);

    expect(body.latestRegistrations.map((row) => row.lastName)).toEqual([
      'Gg',
      'Ff',
      'Ee',
      'Dd',
      'Cc',
    ]);
  });

  it('puts the e-mail address in the row (E13)', async () => {
    const { body } = await dashboard(event.id);

    expect(body.latestRegistrations[0].email).toBe(
      `dashboard-gg-${stamp}@contract.example.org`,
    );
  });

  it('says how full the programme is', async () => {
    const { body } = await dashboard(event.id);

    // Three sessions, two of which ask who is coming, three seats claimed.
    expect(body.program).toEqual({ items: 3, withSignup: 2, signups: 3 });
  });

  it('counts the questions of the registration form and the required ones', async () => {
    const { body } = await dashboard(event.id);

    expect(body.form).toEqual({ questions: 3, required: 2 });
  });

  it('carries the event and the public address participants are given', async () => {
    const { body } = await dashboard(event.id);

    expect(body.event.id).toBe(event.id);
    expect(body.event.name).toBe(EVENT.name);
    expect(body.event.status).toBe('published');
    // Nested, because slugs are unique per parent rather than globally (E7).
    expect(body.seriesSlug).toBe(series.slug);
    expect(body.event.slug).toBeTruthy();
  });

  it('has no tile for a module that does not exist yet', async () => {
    const { body } = await dashboard(event.id);

    // Messages arrive in phase 3, proposals and the forum in phase 4. Until
    // then their absence is the honest answer; a zero would be a claim.
    expect(Object.keys(body).sort()).toEqual([
      'event',
      'form',
      'latestRegistrations',
      'program',
      'registrations',
      'seriesSlug',
    ]);
  });

  it('answers for an event with nothing on it, with zeros and no rows', async () => {
    const { status, body } = await dashboard(emptyEvent.id);

    expect(status).toBe(200);
    expect(body.registrations).toEqual({
      total: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
    });
    expect(body.latestRegistrations).toEqual([]);
    expect(body.program).toEqual({ items: 0, withSignup: 0, signups: 0 });
    expect(body.form).toEqual({ questions: 0, required: 0 });
    // A draft event has a dashboard: it is how an organizer prepares one.
    expect(body.event.status).toBe('draft');
  });

  it('refuses an anonymous request', async () => {
    const response = await api(`/api/admin/events/${event.id}/dashboard`);

    expect(response.status).toBe(401);
  });

  it('answers 404 for an unknown event rather than a screen of zeros', async () => {
    const response = await dashboard('11111111-1111-4111-8111-111111111111');

    expect(response.status).toBe(404);
  });

  it('rejects an id that is not a uuid', async () => {
    const response = await dashboard('not-a-uuid');

    expect(response.status).toBe(400);
  });

  describe('the numbers follow the data', () => {
    it('moves a registration between the tiles when its status changes', async () => {
      const before = await dashboard(event.id);
      const victim = before.body.latestRegistrations.find(
        (row) => row.status === 'confirmed',
      );
      expect(victim).toBeDefined();

      const cancelled = await api(
        `/api/admin/registrations/${victim?.id}`,
        asAdminJson('PATCH', { status: 'cancelled' }),
      );
      expect(cancelled.status).toBe(200);

      const after = await dashboard(event.id);
      expect(after.body.registrations.confirmed).toBe(
        before.body.registrations.confirmed - 1,
      );
      expect(after.body.registrations.cancelled).toBe(
        before.body.registrations.cancelled + 1,
      );
      // The total does not move: cancelling keeps the row, and with it the
      // record of the opt-in (E14, F23).
      expect(after.body.registrations.total).toBe(
        before.body.registrations.total,
      );

      // Put it back, so the tests above keep describing this event.
      const reinstated = await api(
        `/api/admin/registrations/${victim?.id}`,
        asAdminJson('PATCH', { status: 'confirmed' }),
      );
      expect(reinstated.status).toBe(200);
    });

    it('follows the programme when a session is added and removed', async () => {
      const added = await api<Item>(
        `/api/admin/events/${event.id}/program-items`,
        asAdminJson('POST', {
          title: 'Late addition with sign-up',
          startsAt: '2099-06-14T13:00:00.000Z',
          endsAt: '2099-06-14T14:00:00.000Z',
          registrationEnabled: true,
          capacity: 10,
        }),
      );
      expect(added.status).toBe(201);

      const withIt = await dashboard(event.id);
      expect(withIt.body.program).toEqual({
        items: 4,
        withSignup: 3,
        signups: 3,
      });

      await api(
        `/api/admin/program-items/${added.body.id}`,
        asAdmin({ method: 'DELETE' }),
      );

      const withoutIt = await dashboard(event.id);
      expect(withoutIt.body.program).toEqual({
        items: 3,
        withSignup: 2,
        signups: 3,
      });
    });

    it('loses the seats of a deleted session, not the other sessions', async () => {
      const before = await dashboard(event.id);

      await api(
        `/api/admin/program-items/${workshop.id}`,
        asAdmin({ method: 'DELETE' }),
      );

      const after = await dashboard(event.id);
      // Two seats went with the session (the cascade of F42), one remains in
      // the roundtable — a count that ignored the cascade would still say 3.
      expect(after.body.program.signups).toBe(before.body.program.signups - 2);
      expect(after.body.program.items).toBe(before.body.program.items - 1);
    });
  });
});
