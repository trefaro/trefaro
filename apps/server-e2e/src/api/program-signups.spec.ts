import { adminCookie } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  clearMailbox,
  confirmationTokenFrom,
  selfServiceTokenFrom,
  waitForMailpit,
  waitForMailTo,
} from '../support/mailpit';

/**
 * Contract of per-item sign-up and the participant self-service (FR 3.10, E11)
 * — AP 9.
 *
 * This suite proves the acceptance criterion of the work package: a full session
 * takes no further sign-up. It is asserted here rather than only in a unit test
 * because the rule is decided by a lock inside one statement against the real
 * database — a fake repository would only prove that the fake counts.
 *
 * It also walks the whole path a participant actually takes, because that path
 * is the one thing about E11 that could quietly not work: register, confirm,
 * receive the receipt, follow the personal link in it, claim a seat, give it up,
 * cancel. The token comes out of Mailpit, so what is being tested is a link that
 * left the server rather than a token this suite minted for itself.
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
  registrationEnabled: boolean;
  capacity: number | null;
  signupCount: number;
}

interface MyRegistration {
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  customFields: Record<string, unknown>;
  seriesSlug: string;
  event: { id: string; slug: string; name: string; timezone: string };
  program: (Item & { signedUp: boolean })[];
}

interface Load {
  itemId: string;
  title: string;
  registrationEnabled: boolean;
  capacity: number | null;
  signupCount: number;
  participants: {
    registrationId: string;
    firstName: string;
    lastName: string;
    email: string;
    signedUpAt: string;
  }[];
}

/** A one-day conference in Cologne: 08:00 to 18:00 local, 14 June 2099. */
const EVENT = {
  name: 'Sign-up Contract Event',
  description: 'The event whose sessions this suite signs up for.',
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

const WORKSHOP = {
  title: 'Workshop with one chair',
  startsAt: '2099-06-14T07:00:00.000Z',
  endsAt: '2099-06-14T08:30:00.000Z',
  registrationEnabled: true,
  capacity: 1,
} as const;

const PLENARY = {
  title: 'Plenary everybody attends',
  startsAt: '2099-06-14T09:00:00.000Z',
  endsAt: '2099-06-14T10:00:00.000Z',
} as const;

/** Distinguishes this run's addresses: one address registers once per event (E10). */
const stamp = Date.now();

describe('program sign-up API', () => {
  let cookie = '';
  const created: string[] = [];
  let series: Series;
  let event: Event;
  let otherEvent: Event;
  /** A session of `otherEvent`, to prove a link cannot reach another programme. */
  let elsewhere: Item;

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

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

  const plan = (payload: Record<string, unknown>, on: string) =>
    api<Item>(
      `/api/admin/events/${on}/program-items`,
      asAdminJson('POST', payload),
    );

  const planned = async (
    payload: Record<string, unknown>,
    on = event.id,
  ): Promise<Item> => {
    const response = await plan(payload, on);
    expect(`${response.status} ${JSON.stringify(response.body)}`).toMatch(
      /^201/,
    );
    return response.body;
  };

  const address = (what: string): string =>
    `signups-${what}-${stamp}@contract.example.org`;

  /**
   * Registers, confirms, and returns the token from the personal link.
   *
   * The whole point of E11 in one helper: the only way a participant gets here is
   * a link the server mailed them after they confirmed their address.
   */
  const participant = async (email: string): Promise<string> => {
    const registered = await postJson(
      `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
      {
        firstName: 'Amina',
        lastName: 'Okonkwo',
        email,
        customFields: {},
      },
    );
    expect(registered.status).toBe(202);

    const request = await waitForMailTo(email);
    const confirmation = await postJson('/api/user/registrations/confirm', {
      token: confirmationTokenFrom(request),
    });
    expect(confirmation.status).toBe(200);

    // The receipt is the newer of the two messages, and the only one that
    // carries a personal link.
    const receipt = await waitForMailTo(email);
    return selfServiceTokenFrom(receipt);
  };

  const view = (token: string) =>
    api<MyRegistration>(
      `/api/user/registrations/me?token=${encodeURIComponent(token)}`,
    );

  const signUp = (itemId: string, token: string) =>
    api<MyRegistration>(`/api/user/program-items/${itemId}/signup`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });

  const signOff = (itemId: string, token: string) =>
    api<MyRegistration>(`/api/user/program-items/${itemId}/signup`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });

  const load = (itemId: string) =>
    api<Load>(`/api/admin/program-items/${itemId}/signups`, asAdmin());

  const seatIn = (registration: MyRegistration, itemId: string) =>
    registration.program.find((entry) => entry.id === itemId);

  /** Empties the programme, so each test starts from a blank schedule. */
  const clearProgram = async (): Promise<void> => {
    const items = await api<Item[]>(
      `/api/admin/events/${event.id}/program-items`,
      asAdmin(),
    );
    for (const item of items.body) {
      await api(
        `/api/admin/program-items/${item.id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
  };

  beforeAll(async () => {
    await waitForMailpit();
    cookie = adminCookie();

    const response = await api<Series>(
      '/api/admin/series',
      asAdminJson('POST', {
        name: `Sign-up Contract Series ${stamp}`,
        description: 'Holds the event this suite signs up for.',
        status: 'published',
      }),
    );
    series = response.body;
    created.push(series.id);

    event = await createEvent(EVENT);
    otherEvent = await createEvent({
      ...EVENT,
      name: `Sign-up Contract Other Event ${stamp}`,
    });
    elsewhere = await planned(
      { ...PLENARY, title: 'Session of another event' },
      otherEvent.id,
    );
  });

  afterAll(async () => {
    // Registrations first: a confirmed one blocks deleting the series (E14).
    const rows = await api<{ rows: { id: string }[] }>(
      `/api/admin/events/${event.id}/registrations?pageSize=100`,
      asAdmin(),
    );
    for (const row of rows.body.rows ?? []) {
      await api(
        `/api/admin/registrations/${row.id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
    for (const id of created) {
      await api(`/api/admin/series/${id}`, asAdmin({ method: 'DELETE' }));
    }
    await clearMailbox();
  });

  afterEach(clearProgram);

  describe('the guard', () => {
    it('needs a session to read who signed up', async () => {
      const item = await planned(WORKSHOP);

      expect(
        (await api(`/api/admin/program-items/${item.id}/signups`)).status,
      ).toBe(401);
    });
  });

  describe('the sign-up settings of a session', () => {
    it('stores the switch and the seats', async () => {
      const item = await planned(WORKSHOP);

      expect(item.registrationEnabled).toBe(true);
      expect(item.capacity).toBe(1);
      expect(item.signupCount).toBe(0);
    });

    it('refuses a capacity without sign-up switched on', async () => {
      const response = await plan({ ...PLENARY, capacity: 12 }, event.id);

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('sign-up is switched on');
    });

    it('drops the seats when sign-up is switched off again', async () => {
      const item = await planned(WORKSHOP);

      const response = await api<Item>(
        `/api/admin/program-items/${item.id}`,
        asAdminJson('PATCH', { registrationEnabled: false }),
      );

      // Not left behind: the database refuses a capacity on a session that does
      // not ask who is coming, so a leftover would be a 500 on the next write.
      expect(response.status).toBe(200);
      expect(response.body.capacity).toBeNull();
    });

    it('publishes the numbers, but never the names', async () => {
      await planned(WORKSHOP);

      const response = await api<Item[]>(
        `/api/user/series/${series.slug}/events/${event.slug}/program`,
      );

      expect(Object.keys(response.body[0]).sort()).toEqual([
        'capacity',
        'description',
        'endsAt',
        'id',
        'registrationEnabled',
        'signupCount',
        'speaker',
        'startsAt',
        'title',
      ]);
    });
  });

  describe('the personal link (E11)', () => {
    let token = '';

    beforeAll(async () => {
      token = await participant(address('link'));
    });

    it('reaches the participant’s own registration', async () => {
      const response = await view(token);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(address('link'));
      expect(response.body.status).toBe('confirmed');
      expect(response.body.event.slug).toBe(event.slug);
      expect(response.body.seriesSlug).toBe(series.slug);
    });

    it('shows this registration and nothing about anybody else', async () => {
      const response = await view(token);

      // No participant list, no other person's sign-ups: a link that reached the
      // wrong inbox must not become a view of who is attending.
      expect(Object.keys(response.body).sort()).toEqual([
        'confirmedAt',
        'customFields',
        'email',
        'event',
        'firstName',
        'lastName',
        'program',
        'registeredAt',
        'seriesSlug',
        'status',
      ]);
    });

    it('refuses a confirmation token in its place', async () => {
      const email = address('replay');
      await postJson(
        `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
        { firstName: 'Bo', lastName: 'Chen', email, customFields: {} },
      );
      const confirmation = confirmationTokenFrom(await waitForMailTo(email));

      // The purpose is inside the signature (E5): a link that confirms an
      // address cannot be replayed as one that changes a registration.
      expect((await view(confirmation)).status).toBe(400);
    });

    it('says which part is missing when there is no token at all', async () => {
      const response = await api('/api/user/registrations/me');

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('missing its token');
    });

    it('refuses a token whose payload was edited', async () => {
      const [payload, signature] = token.split('.');
      const edited = `${payload}x.${signature}`;

      expect((await view(edited)).status).toBe(400);
    });
  });

  describe('claiming a seat', () => {
    let token = '';

    beforeAll(async () => {
      token = await participant(address('seat'));
    });

    it('claims one, and reports the whole view back', async () => {
      const item = await planned({ ...WORKSHOP, capacity: 4 });

      const response = await signUp(item.id, token);

      expect(response.status).toBe(200);
      expect(seatIn(response.body, item.id)).toMatchObject({
        signedUp: true,
        signupCount: 1,
      });
    });

    it('is idempotent — a second click is not a second seat', async () => {
      const item = await planned({ ...WORKSHOP, capacity: 4 });

      await signUp(item.id, token);
      const second = await signUp(item.id, token);

      expect(second.status).toBe(200);
      expect(seatIn(second.body, item.id)?.signupCount).toBe(1);
    });

    it('gives a seat up again, and the seat comes back', async () => {
      const item = await planned({ ...WORKSHOP, capacity: 4 });
      await signUp(item.id, token);

      const response = await signOff(item.id, token);

      expect(response.status).toBe(200);
      expect(seatIn(response.body, item.id)).toMatchObject({
        signedUp: false,
        signupCount: 0,
      });
    });

    it('says nothing when there was no seat to give up', async () => {
      const item = await planned({ ...WORKSHOP, capacity: 4 });

      expect((await signOff(item.id, token)).status).toBe(200);
    });

    it('refuses a session that does not ask for sign-up', async () => {
      const item = await planned(PLENARY);

      const response = await signUp(item.id, token);

      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toContain('does not ask for');
    });

    it('answers a session of another event as absent, not as forbidden', async () => {
      const response = await signUp(elsewhere.id, token);

      // A 403 would confirm that the session exists.
      expect(response.status).toBe(404);
    });

    it('is a 404 for a session that does not exist', async () => {
      const response = await signUp(
        'ffffffff-0000-4000-8000-000000000000',
        token,
      );

      expect(response.status).toBe(404);
    });
  });

  describe('a full session', () => {
    let first = '';
    let second = '';

    beforeAll(async () => {
      first = await participant(address('first'));
      second = await participant(address('second'));
    });

    it('takes no further sign-up once its seats are gone', async () => {
      // The acceptance criterion of AP 9, against the real database: the count
      // and the insert are one decision, taken under a lock on the session row.
      const item = await planned(WORKSHOP);
      expect((await signUp(item.id, first)).status).toBe(200);

      const refused = await signUp(item.id, second);

      expect(refused.status).toBe(409);
      expect(JSON.stringify(refused.body)).toContain('is full');
      expect((await load(item.id)).body.signupCount).toBe(1);
    });

    it('tells somebody who already has a seat in it that they do', async () => {
      const item = await planned(WORKSHOP);
      await signUp(item.id, first);

      const again = await signUp(item.id, first);

      // Not "full": they are in, and a second click must not read as a refusal.
      expect(again.status).toBe(200);
      expect(seatIn(again.body, item.id)?.signedUp).toBe(true);
    });

    it('lets the next person in as soon as a seat is given up', async () => {
      const item = await planned(WORKSHOP);
      await signUp(item.id, first);
      expect((await signUp(item.id, second)).status).toBe(409);

      await signOff(item.id, first);

      expect((await signUp(item.id, second)).status).toBe(200);
      expect((await load(item.id)).body.signupCount).toBe(1);
    });

    it('takes as many as come where no capacity is set', async () => {
      const item = await planned({ ...PLENARY, registrationEnabled: true });

      expect((await signUp(item.id, first)).status).toBe(200);
      expect((await signUp(item.id, second)).status).toBe(200);
      expect((await load(item.id)).body.signupCount).toBe(2);
    });
  });

  describe('the organizer’s load view', () => {
    let token = '';

    beforeAll(async () => {
      token = await participant(address('load'));
    });

    it('lists who signed up, with the address in the row', async () => {
      const item = await planned({ ...WORKSHOP, capacity: 4 });
      await signUp(item.id, token);

      const response = await load(item.id);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        itemId: item.id,
        capacity: 4,
        signupCount: 1,
      });
      // The one correction the usability test of the thesis produced.
      expect(response.body.participants[0].email).toBe(address('load'));
      expect(response.body.participants[0].firstName).toBe('Amina');
    });

    it('still lists them after sign-up was switched off', async () => {
      const item = await planned({ ...WORKSHOP, capacity: 4 });
      await signUp(item.id, token);

      await api(
        `/api/admin/program-items/${item.id}`,
        asAdminJson('PATCH', { registrationEnabled: false }),
      );

      const response = await load(item.id);
      expect(response.body.registrationEnabled).toBe(false);
      expect(response.body.signupCount).toBe(1);
    });

    it('is a 404 for a session that does not exist', async () => {
      expect((await load('ffffffff-0000-4000-8000-000000000000')).status).toBe(
        404,
      );
    });
  });

  describe('what takes a sign-up with it', () => {
    let token = '';

    beforeAll(async () => {
      token = await participant(address('cascade'));
    });

    it('deleting the session releases its seats', async () => {
      const item = await planned({ ...WORKSHOP, capacity: 4 });
      await signUp(item.id, token);

      await api(
        `/api/admin/program-items/${item.id}`,
        asAdmin({ method: 'DELETE' }),
      );

      // Gone with the row it belonged to, through the cascade — and the
      // participant's own view no longer claims a seat that cannot exist.
      expect((await load(item.id)).status).toBe(404);
      expect((await view(token)).body.program).toHaveLength(0);
    });

    it('cancelling the registration gives up every seat', async () => {
      const workshop = await planned({ ...WORKSHOP, capacity: 4 });
      const plenary = await planned({
        ...PLENARY,
        registrationEnabled: true,
      });
      await signUp(workshop.id, token);
      await signUp(plenary.id, token);

      const cancelled = await postJson<MyRegistration>(
        '/api/user/registrations/me/cancellation',
        { token },
      );

      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('cancelled');
      expect((await load(workshop.id)).body.signupCount).toBe(0);
      expect((await load(plenary.id)).body.signupCount).toBe(0);
    });

    it('and then the link says the registration was cancelled', async () => {
      const response = await view(token);

      // Read, sign up or cancel: all of them stop here, because a link that kept
      // working after a cancellation could take seats for a registration that no
      // longer stands.
      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toContain('was cancelled');
    });
  });
});
