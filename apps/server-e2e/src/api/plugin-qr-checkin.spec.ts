import { adminCookie } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  deleteProfiles,
  deleteRegistrations,
  deleteSeries,
  seedProfile,
  seedRegistrations,
  seedSession,
} from '../support/database';
import {
  confirmationTokenFrom,
  selfServiceTokenFrom,
  waitForMailTo,
} from '../support/mailpit';

/**
 * Contract of the QR code check-in plug-in (FR 3.16) — AP 7 of phase 4.
 *
 * The acceptance criterion of the package is decided here, and most of it can
 * only be decided at this level:
 *
 * - **A token out of a confirmation receipt yields a code, and a foreign one
 *   yields the same 404 as an unknown id** (F148, E53). The token is fetched
 *   the only way a participant ever gets one: by registering, confirming, and
 *   reading the receipt.
 * - **The same code read twice is 200 twice, with the same instant** — the
 *   rule that lives in a conditional `UPDATE` (E53), so a unit test with a fake
 *   repository could only prove that the fake obeys it.
 * - **An unconfirmed registration gets no ticket**, and neither does a
 *   cancelled one. That rule lives in the host adapter's `WHERE`, and it is
 *   visible only against a database that holds all three states.
 * - **The admission list shows the event's confirmed registrations with their
 *   state, without the plug-in querying `registration`.** The suite seeds the
 *   rows straight into the core table and reads them back off the plug-in's
 *   answer: they can only have arrived through `PluginRegistrationReads` (E53),
 *   because the plug-in has no other way to reach them.
 * - **A disabled plug-in is absent, not forbidden**: every route 404, no entry
 *   in `/api/config` — and switching it off keeps every row (E14).
 *
 * Instance-wide state, which is why it lives in `apps/server-e2e` and why the
 * suite puts back the flag it found: `module_config` belongs to the instance.
 *
 * The session is seeded rather than logged in for, like the forum suite's: the
 * login limit is twenty per five minutes for the whole run (E4), and it is
 * never relaxed for a test.
 */
interface Created {
  id: string;
  slug: string;
}

interface Ticket {
  registrationId: string;
  eventId: string;
  firstName: string;
  lastName: string;
  code: string;
  issuedAt: string;
  checkedInAt: string | null;
}

interface AdmissionRow {
  registrationId: string;
  firstName: string;
  lastName: string;
  code: string;
  checkedInAt: string | null;
}

interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface CheckinResult {
  registrationId: string;
  eventId: string;
  firstName: string;
  lastName: string;
  checkedInAt: string;
  alreadyCheckedIn: boolean;
}

interface ModuleSummary {
  key: string;
  requires: string[];
  enabled: boolean;
}

interface PublicConfig {
  enabledModules: string[];
  plugins: { key: string; mountPoints: string[] }[];
}

const PLUGIN = 'qr-checkin';
const NOWHERE = '00000000-0000-4000-8000-000000000000';

/** The `message` of a problem answer, or the body as it came (F77). */
function problem(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : JSON.stringify(body);
}

const stamp = Date.now();
const DOMAIN = `@checkin-${stamp}.example.org`;

describe('the QR check-in plug-in', () => {
  let cookie: string;
  let wasEnabled = false;
  let series: Created;
  /** The event at whose door this suite stands, and a second one for the list. */
  let event: Created;
  let otherEvent: Created;
  /**
   * The person who walks the whole way: registers, confirms, reads the receipt
   * and turns up at the door.
   */
  let attendee = '';
  let attendeeToken = '';
  /** Somebody with a session, three registrations and only two tickets. */
  let holder = '';
  let holderSession = '';

  const asJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const toggle = (enabled: boolean, key = PLUGIN) =>
    api<unknown>(`/api/admin/modules/${key}`, asJson('PATCH', { enabled }));

  const moduleRow = async (key: string): Promise<ModuleSummary> => {
    const list = await api<ModuleSummary[]>('/api/admin/modules', {
      headers: { cookie },
    });
    const found = list.body.find((module) => module.key === key);
    if (!found) throw new Error(`No module "${key}" in the list`);
    return found;
  };

  const ticketByLink = (token: string) =>
    api<Ticket>(
      `/api/user/plugins/${PLUGIN}/ticket?token=${encodeURIComponent(token)}`,
    );

  const myTickets = (session = holderSession, query = '') =>
    api<Page<Ticket>>(`/api/participant/plugins/${PLUGIN}/tickets${query}`, {
      headers: { cookie: `trefaro_user_session=${session}` },
    });

  const scan = (code: string, headers: Record<string, string> = { cookie }) =>
    api<CheckinResult>(`/api/admin/plugins/${PLUGIN}/checkins`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ code }),
    });

  const admissions = (
    eventId = event.id,
    query = '',
    headers: Record<string, string> = { cookie },
  ) =>
    api<Page<AdmissionRow>>(
      `/api/admin/plugins/${PLUGIN}/events/${eventId}/checkins${query}`,
      { headers },
    );

  const setStatus = (registrationId: string, status: string) =>
    api<unknown>(
      `/api/admin/registrations/${registrationId}`,
      asJson('PATCH', { status }),
    );

  beforeAll(async () => {
    cookie = adminCookie();
    wasEnabled = (await moduleRow(PLUGIN)).enabled;
    // Off first, whatever was found: the first tests assert the off state, and
    // a run killed between switching on and restoring leaves the flag on. What
    // was found is still what goes back at the end.
    expect((await toggle(false)).status).toBe(200);

    series = (
      await api<Created>(
        '/api/admin/series',
        asJson('POST', {
          name: `Check-in Contract Series ${stamp}`,
          description: 'Holds the two events this suite opens a door for.',
          status: 'published',
        }),
      )
    ).body;

    const newEvent = (name: string) =>
      api<Created>(
        `/api/admin/series/${series.id}/events`,
        asJson('POST', {
          name: `${name} ${stamp}`,
          description: 'Somebody stands at its door with a phone.',
          eventType: 'onsite',
          startsAt: '2099-06-14T06:00:00.000Z',
          endsAt: '2099-06-14T16:00:00.000Z',
          timezone: 'Europe/Berlin',
          venueName: 'Bürgerhaus Kalk',
          languages: ['de', 'en'],
          status: 'published',
        }),
      );
    const first = await newEvent('Check-in Contract Event');
    event = first.body;
    otherEvent = (await newEvent('Check-in Contract Other Event')).body;

    // The one participant who walks the real way in, because the token has to
    // be a real one: registered, confirmed, and read out of the receipt (E11).
    attendee = `attendee${DOMAIN}`;
    const registered = await postJson(
      `/api/user/series/${series.slug}/events/${first.body.slug}/registrations`,
      {
        firstName: 'Amina',
        lastName: 'Okonkwo',
        email: attendee,
        customFields: {},
      },
    );
    expect(registered.status).toBe(202);
    const request = await waitForMailTo(attendee);
    expect(
      (
        await postJson('/api/user/registrations/confirm', {
          token: confirmationTokenFrom(request),
        })
      ).status,
    ).toBe(200);
    attendeeToken = selfServiceTokenFrom(await waitForMailTo(attendee));

    // Somebody with an account and four registrations in three states: two
    // confirmed (two events), one pending, one cancelled. Only the two
    // confirmed ones may ever become a ticket.
    const holderAddress = `holder${DOMAIN}`;
    holder = await seedProfile({
      email: holderAddress,
      firstName: 'Jonas',
      lastName: 'Weber',
    });
    holderSession = await seedSession(holder);
    await seedRegistrations(event.id, [
      {
        email: holderAddress,
        firstName: 'Jonas',
        lastName: 'Weber',
        status: 'confirmed',
      },
      {
        email: `cancelled${DOMAIN}`,
        firstName: 'Bo',
        lastName: 'Andersen',
        status: 'cancelled',
      },
      {
        email: `pending${DOMAIN}`,
        firstName: 'Chen',
        lastName: 'Zhao',
        status: 'pending',
      },
    ]);
    await seedRegistrations(otherEvent.id, [
      {
        email: holderAddress,
        firstName: 'Jonas',
        lastName: 'Weber',
        status: 'confirmed',
      },
    ]);
    // A registration of this account that nobody confirmed: no ticket, ever.
    await seedRegistrations(otherEvent.id, [
      {
        email: `unconfirmed${DOMAIN}`,
        firstName: 'Dalia',
        lastName: 'Haddad',
        status: 'pending',
      },
    ]);
  });

  afterAll(async () => {
    await toggle(wasEnabled);
    await deleteRegistrations(event.id);
    await deleteRegistrations(otherEvent.id);
    await deleteSeries(series.id);
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  describe('while the organization has it switched off', () => {
    it('answers 404 on every route and appears in no configuration', async () => {
      const [ticket, mine, door, list, config] = await Promise.all([
        ticketByLink(attendeeToken),
        myTickets(),
        scan('WHATEVER'),
        admissions(),
        api<PublicConfig>('/api/config'),
      ]);

      // Absent rather than forbidden, so a client sees the same thing the API
      // says: nothing here.
      expect([ticket.status, mine.status, door.status, list.status]).toEqual([
        404, 404, 404, 404,
      ]);
      expect(config.body.plugins.map((plugin) => plugin.key)).not.toContain(
        PLUGIN,
      );
      expect(config.body.enabledModules).not.toContain(PLUGIN);
    });

    it('is listed for the organizer, and needs nothing switched on first (E47)', async () => {
      const row = await moduleRow(PLUGIN);

      // Three of the five curated plug-ins need `profiles`; a door reads a
      // registration, and a registration needs no account.
      expect(row).toMatchObject({ enabled: false, requires: [] });
    });
  });

  describe('switched on', () => {
    beforeAll(async () => {
      expect((await toggle(true)).status).toBe(200);
    });

    it('answers, and hands the clients its two hook points (AP 8)', async () => {
      const [row, config] = await Promise.all([
        moduleRow(PLUGIN),
        api<PublicConfig>('/api/config'),
      ]);

      // On for the organizer, and its routes answer — the tests below are the
      // proof of that. What `/api/config` carries is the **client** half, which
      // this plug-in gained with its screens: the ticket at `my-registration`,
      // the hook point it brought with it (E54), and the door at
      // `event-dashboard`. Nothing on the public event page: a ticket belongs
      // to one registration and an admission list to whoever holds the door.
      expect(row.enabled).toBe(true);
      const descriptor = config.body.plugins.find(
        (plugin) => plugin.key === PLUGIN,
      );
      expect(descriptor?.mountPoints).toEqual([
        'my-registration',
        'event-dashboard',
      ]);
    });
  });

  describe('the ticket behind the mailed link (E11, E54)', () => {
    let issued: Ticket;

    it('turns the token from a receipt into a code', async () => {
      const answer = await ticketByLink(attendeeToken);

      expect(answer.status).toBe(200);
      issued = answer.body;
      expect(issued).toMatchObject({
        eventId: event.id,
        firstName: 'Amina',
        lastName: 'Okonkwo',
        checkedInAt: null,
      });
      // Crockford's base32, 26 characters — readable out loud when a camera
      // and a screen both fail (F199).
      expect(issued.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('is never the self-service token itself (E53)', async () => {
      // The signed token can cancel a registration (F44). A QR code gets
      // photographed and held up at a door, so it carries nothing at all.
      expect(attendeeToken).not.toContain(issued.code);
      expect(issued.code).not.toContain(attendeeToken);
    });

    it('gives the same code on the second read', async () => {
      const again = await ticketByLink(attendeeToken);

      expect(again.body.code).toBe(issued.code);
      expect(again.body.issuedAt).toBe(issued.issuedAt);
    });

    it('answers a forged token with the same 404 as an unknown id (F148)', async () => {
      const forged = await ticketByLink('not-a-token');
      const swapped = await ticketByLink(`${attendeeToken.slice(0, -4)}beef`);

      expect([forged.status, swapped.status]).toEqual([404, 404]);
      // Word for word the same: forged, expired and pointing nowhere are one
      // answer, because the difference is not the holder's to learn.
      expect(problem(forged.body)).toBe(problem(swapped.body));
    });

    it('answers 400 when the link lost its token', async () => {
      const answer = await api(`/api/user/plugins/${PLUGIN}/ticket`);

      expect(answer.status).toBe(400);
    });
  });

  describe('my tickets, over a session (F148)', () => {
    it('lists the confirmed registrations of this account and nothing else', async () => {
      const page = await myTickets();

      expect(page.status).toBe(200);
      // Two confirmed registrations in two events. The pending and the
      // cancelled rows of this suite belong to other addresses, and this
      // account's own rows are the two that are confirmed.
      expect(page.body.total).toBe(2);
      expect(new Set(page.body.rows.map((row) => row.eventId))).toEqual(
        new Set([event.id, otherEvent.id]),
      );
      for (const row of page.body.rows) {
        expect(row.firstName).toBe('Jonas');
        expect(row.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      }
    });

    it('gives a different code to every registration', async () => {
      const page = await myTickets();

      expect(new Set(page.body.rows.map((row) => row.code)).size).toBe(2);
    });

    it('has nothing for an account with no confirmed registration', async () => {
      const stranger = await seedProfile({
        email: `stranger${DOMAIN}`,
        firstName: 'Eze',
        lastName: 'Nwosu',
      });
      const page = await myTickets(await seedSession(stranger));

      expect(page.body).toMatchObject({ rows: [], total: 0 });
    });

    it('needs a session', async () => {
      const answer = await api(`/api/participant/plugins/${PLUGIN}/tickets`);

      expect(answer.status).toBe(401);
    });
  });

  describe('the door (FR 3.16, E53)', () => {
    let code = '';

    beforeAll(async () => {
      code = (await ticketByLink(attendeeToken)).body.code;
    });

    it('lets somebody in and answers with their name', async () => {
      const admitted = await scan(code);

      expect(admitted.status).toBe(200);
      expect(admitted.body).toMatchObject({
        eventId: event.id,
        firstName: 'Amina',
        lastName: 'Okonkwo',
        alreadyCheckedIn: false,
      });
    });

    it('answers the second scan with the first instant, not an error', async () => {
      const first = await scan(code);
      const second = await scan(code);

      expect([first.status, second.status]).toEqual([200, 200]);
      expect(first.body.alreadyCheckedIn).toBe(true);
      // The instant they walked in, not the instant somebody looked again.
      expect(second.body.checkedInAt).toBe(first.body.checkedInAt);
    });

    it('reads a code that was typed with a space and the caps lock off', async () => {
      const typed = await scan(`  ${code.toLowerCase()} `);

      expect(typed.status).toBe(200);
      expect(typed.body.registrationId).toBe(
        (await ticketByLink(attendeeToken)).body.registrationId,
      );
    });

    it('shows the admission on the ticket afterwards', async () => {
      const ticket = await ticketByLink(attendeeToken);

      expect(ticket.body.checkedInAt).not.toBeNull();
    });

    it('answers an unknown code with a 404 that says nothing about registrations', async () => {
      const unknown = await scan('ZZZZZZZZZZZZZZZZZZZZZZZZZZ');

      expect(unknown.status).toBe(404);
      const said = problem(unknown.body).toLowerCase();
      expect(said).toContain('code');
      // Not a word about who is expected behind this door.
      expect(said).not.toContain('registration');
      expect(said).not.toContain('event');
    });

    it('refuses a code that is longer than any this instance issues', async () => {
      const answer = await scan('X'.repeat(65));

      expect(answer.status).toBe(400);
    });

    it('needs an administrative session', async () => {
      const answer = await scan(code, {});

      expect(answer.status).toBe(401);
    });
  });

  describe('the admission list', () => {
    it('shows the confirmed registrations of one event, by name', async () => {
      const list = await admissions();

      expect(list.status).toBe(200);
      // Amina Okonkwo and Jonas Weber are confirmed; Bo Andersen is cancelled
      // and Chen Zhao is pending, so neither is at this door. The rows were
      // written straight into `registration`, and the plug-in never queries
      // that table — they can only have arrived through the port (E53).
      expect(list.body.rows.map((row) => row.lastName)).toEqual([
        'Okonkwo',
        'Weber',
      ]);
      expect(list.body.total).toBe(2);
    });

    it('says who has arrived and who has not', async () => {
      const list = await admissions();

      const [amina, jonas] = list.body.rows;
      expect(amina.checkedInAt).not.toBeNull();
      expect(jonas.checkedInAt).toBeNull();
    });

    it('carries a code per row, and the door reads it (F199)', async () => {
      const jonas = (await admissions()).body.rows[1];

      // The same route a camera would have reached: one door, two ways to it.
      const admitted = await scan(jonas.code);

      expect(admitted.body).toMatchObject({
        lastName: 'Weber',
        alreadyCheckedIn: false,
      });
      expect((await admissions()).body.rows[1].checkedInAt).not.toBeNull();
    });

    it('pages, with the id as the last criterion', async () => {
      const first = await admissions(event.id, '?page=1&pageSize=1');
      const second = await admissions(event.id, '?page=2&pageSize=1');

      expect(first.body.rows.map((row) => row.lastName)).toEqual(['Okonkwo']);
      expect(second.body.rows.map((row) => row.lastName)).toEqual(['Weber']);
      expect([first.body.total, second.body.total]).toEqual([2, 2]);
    });

    it('is empty for an event nobody is confirmed for', async () => {
      const list = await admissions(NOWHERE);

      expect(list.body).toMatchObject({ rows: [], total: 0 });
    });

    it('needs an administrative session', async () => {
      const answer = await admissions(event.id, '', {});

      expect(answer.status).toBe(401);
    });
  });

  describe('a registration that is given up', () => {
    it('stops opening the door, without the row going anywhere', async () => {
      const ticket = (await ticketByLink(attendeeToken)).body;

      expect((await setStatus(ticket.registrationId, 'cancelled')).status).toBe(
        200,
      );

      // The ticket outlives the cancellation — only an erasure takes the row —
      // but it resolves to nothing, which is how a door closes behind somebody
      // who gave their place up.
      const closed = await scan(ticket.code);
      expect(closed.status).toBe(404);
      expect((await ticketByLink(attendeeToken)).status).toBe(404);
      expect((await admissions()).body.rows.map((row) => row.lastName)).toEqual(
        ['Weber'],
      );

      // And back: the same code, the same admission, nothing reissued.
      expect((await setStatus(ticket.registrationId, 'confirmed')).status).toBe(
        200,
      );
      const restored = await ticketByLink(attendeeToken);
      expect(restored.body.code).toBe(ticket.code);
      expect(restored.body.checkedInAt).toBe(ticket.checkedInAt);
    });
  });

  describe('switching it off again', () => {
    it('answers 404 everywhere and loses no row (E14)', async () => {
      const before = (await ticketByLink(attendeeToken)).body;

      expect((await toggle(false)).status).toBe(200);
      const [ticket, list] = await Promise.all([
        ticketByLink(attendeeToken),
        admissions(),
      ]);
      expect([ticket.status, list.status]).toEqual([404, 404]);

      expect((await toggle(true)).status).toBe(200);
      const after = (await ticketByLink(attendeeToken)).body;
      expect(after.code).toBe(before.code);
      expect(after.checkedInAt).toBe(before.checkedInAt);
    });
  });
});
