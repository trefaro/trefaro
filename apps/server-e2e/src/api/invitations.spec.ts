import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';
import {
  closeDatabase,
  seedManyConfirmedRegistrations,
  seedRegistrations,
} from '../support/database';
import {
  clearMailbox,
  countMailTo,
  optOutTokenFrom,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of inviting former participants (FR 2.4, F24) — AP 12.
 *
 * The work package has two acceptance criteria and this suite decides both:
 *
 * 1. **An address that objected appears in no further list.** Walked the whole
 *    way: an invitation goes out, the objection link is taken *out of the mail
 *    the server actually sent*, it is used, and the contact list is asked again.
 *    Asserting on the flag in the table instead would prove the column is
 *    written and nothing about the promise E15 makes.
 * 2. **Two hundred addresses do not run into a request timeout.** The `POST`
 *    answers `202` in well under a second and the mails follow afterwards
 *    (F56); the test then polls the invitation until nothing is pending.
 *
 * Everything else is the restriction that makes this legitimate at all: the
 * audience is confirmed registrations of *this* series, a selection names
 * registrations rather than addresses (F55), and there is no field anywhere that
 * takes an e-mail address.
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

interface Contact {
  registrationId: string;
  email: string;
  firstName: string;
  lastName: string;
  events: number;
  lastRegisteredAt: string;
}

interface ContactPage {
  rows: Contact[];
  total: number;
  page: number;
  pageSize: number;
}

interface Invitation {
  id: string;
  seriesId: string;
  eventId: string | null;
  subject: string;
  body: string;
  state: 'sending' | 'sent' | 'partial';
  recipients: number;
  sent: number;
  failed: number;
  createdAt: string;
  finishedAt: string | null;
}

interface InvitationList {
  rows: Invitation[];
  total: number;
  page: number;
  pageSize: number;
}

const stamp = Date.now();

const EVENT = {
  description: 'The event whose former participants this suite writes to.',
  eventType: 'onsite',
  startsAt: '2099-07-14T06:00:00.000Z',
  endsAt: '2099-07-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de'],
  status: 'published',
} as const;

/** Addresses of the suite's own series. */
const AMINA = `invite-amina-${stamp}@example.org`;
const BO = `invite-bo-${stamp}@example.org`;
const PENDING = `invite-pending-${stamp}@example.org`;
const CANCELLED = `invite-cancelled-${stamp}@example.org`;
/** Confirmed, but in a series this invitation has nothing to do with. */
const ELSEWHERE = `invite-elsewhere-${stamp}@example.org`;

describe('invitations API', () => {
  let cookie = '';
  let series: Series;
  let otherSeries: Series;
  let firstEvent: Event;
  let secondEvent: Event;
  let eventElsewhere: Event;
  let ids: Record<string, string> = {};

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const contacts = (query = '') =>
    api<ContactPage>(
      `/api/admin/series/${series.id}/contacts${query}`,
      asAdmin(),
    );

  const invite = (payload: Record<string, unknown>) =>
    api<Invitation>(
      `/api/admin/series/${series.id}/invitations`,
      asAdminJson('POST', payload),
    );

  const message = (recipients: readonly string[], extra = {}) => ({
    subject: `Invitation ${stamp}`,
    body: 'we would love to see you again.\n\nRegistration is open.',
    recipients,
    ...extra,
  });

  /** Waits until the background sender is through with an invitation (F56). */
  const untilSent = async (id: string, timeoutMs = 60_000) => {
    const deadline = Date.now() + timeoutMs;
    let last: Invitation | null = null;

    while (Date.now() < deadline) {
      last = (await api<Invitation>(`/api/admin/invitations/${id}`, asAdmin()))
        .body;
      if (last.state !== 'sending') return last;
      // Half a second, not a quarter: a global limit of 300 requests per minute
      // and client address covers every route (`ThrottlerModule.forRoot`), and
      // in CI this suite shares that budget with two browser suites against the
      // same server. Polling is the one thing here that can spend it in bursts.
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(
      `Invitation ${id} was still sending after ${timeoutMs / 1000}s ` +
        `(${last?.sent ?? 0} of ${last?.recipients ?? 0})`,
    );
  };

  const addressOf = (email: string): string => ids[email];

  beforeAll(async () => {
    cookie = adminCookie();
    await waitForMailpit();

    const createSeries = async (name: string): Promise<Series> =>
      (
        await api<Series>(
          '/api/admin/series',
          asAdminJson('POST', {
            name,
            description: 'Holds the events this suite invites from.',
            status: 'published',
          }),
        )
      ).body;

    series = await createSeries(`Invitations Contract Series ${stamp}`);
    otherSeries = await createSeries(`Invitations Other Series ${stamp}`);

    const createEvent = async (
      seriesId: string,
      name: string,
    ): Promise<Event> => {
      const response = await api<Event>(
        `/api/admin/series/${seriesId}/events`,
        asAdminJson('POST', { ...EVENT, name }),
      );
      expect(`${response.status} ${JSON.stringify(response.body)}`).toMatch(
        /^201/,
      );
      return response.body;
    };

    firstEvent = await createEvent(series.id, `Invitations First ${stamp}`);
    secondEvent = await createEvent(series.id, `Invitations Second ${stamp}`);
    eventElsewhere = await createEvent(
      otherSeries.id,
      `Invitations Elsewhere ${stamp}`,
    );

    // Seeded rather than registered through the form: the public endpoint sends
    // a mail per attempt and is rate limited on purpose (AP 4), and this suite
    // needs the mailbox to hold invitations and nothing else.
    const [aminaFirst, pending, cancelled] = await seedRegistrations(
      firstEvent.id,
      [
        {
          email: AMINA,
          firstName: 'Amina',
          lastName: 'Okonkwo',
          status: 'confirmed',
          registeredAt: '2026-05-01T09:00:00.000Z',
        },
        {
          email: PENDING,
          firstName: 'Pia',
          lastName: 'Pending',
          status: 'pending',
        },
        {
          email: CANCELLED,
          firstName: 'Cai',
          lastName: 'Cancelled',
          status: 'cancelled',
        },
      ],
    );

    // The same person, at the second event of the same series: one contact.
    const [aminaSecond, bo] = await seedRegistrations(secondEvent.id, [
      {
        email: AMINA,
        firstName: 'Amina',
        lastName: 'Okonkwo',
        status: 'confirmed',
        registeredAt: '2026-06-01T09:00:00.000Z',
      },
      { email: BO, firstName: 'Bo', lastName: 'Nkemelu', status: 'confirmed' },
    ]);

    const [elsewhere] = await seedRegistrations(eventElsewhere.id, [
      {
        email: ELSEWHERE,
        firstName: 'Eze',
        lastName: 'Elsewhere',
        status: 'confirmed',
      },
    ]);

    ids = {
      [AMINA]: aminaSecond,
      [`${AMINA}-first`]: aminaFirst,
      [BO]: bo,
      [PENDING]: pending,
      [CANCELLED]: cancelled,
      [ELSEWHERE]: elsewhere,
    };

    await clearMailbox();
  }, 60_000);

  afterAll(async () => {
    await closeDatabase();
  });

  describe('who may be written to (E15)', () => {
    it('lists the confirmed addresses of this series', async () => {
      const { status, body } = await contacts();

      expect(status).toBe(200);
      expect(body.rows.map((row) => row.email)).toEqual(
        expect.arrayContaining([AMINA, BO]),
      );
    });

    it('folds one address across the events of the series', async () => {
      const { body } = await contacts();

      const amina = body.rows.filter((row) => row.email === AMINA);
      // One row, not two: they are one person and would otherwise receive the
      // invitation twice.
      expect(amina).toHaveLength(1);
      expect(amina[0].events).toBe(2);
      // And the row speaks for their most recent registration.
      expect(amina[0].registrationId).toBe(addressOf(AMINA));
    });

    it('leaves out an address that has not confirmed', async () => {
      const { body } = await contacts();

      expect(body.rows.map((row) => row.email)).not.toContain(PENDING);
    });

    it('leaves out a cancelled registration', async () => {
      const { body } = await contacts();

      expect(body.rows.map((row) => row.email)).not.toContain(CANCELLED);
    });

    it('leaves out an address of another series', async () => {
      const { body } = await contacts();

      // The one restriction the whole feature rests on: these people registered
      // for an event of *this* series.
      expect(body.rows.map((row) => row.email)).not.toContain(ELSEWHERE);
    });

    it('searches over name and address', async () => {
      const { body } = await contacts('?search=okonkwo');

      expect(body.rows.map((row) => row.email)).toEqual([AMINA]);
      expect(body.total).toBe(1);
    });

    it('finds a person by two words in either order', async () => {
      const { body } = await contacts('?search=okonkwo%20amina');

      expect(body.rows.map((row) => row.email)).toEqual([AMINA]);
    });

    it('pages, and reports what it answered for', async () => {
      const { body } = await contacts('?page=1&pageSize=1');

      expect(body.rows).toHaveLength(1);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(1);
      expect(body.total).toBeGreaterThan(1);
    });

    it('caps the page size at two hundred', async () => {
      const { body } = await contacts('?pageSize=5000');

      expect(body.pageSize).toBe(200);
    });

    it('answers 404 for a series that does not exist', async () => {
      const { status } = await api(
        '/api/admin/series/11111111-1111-4111-8111-111111111111/contacts',
        asAdmin(),
      );

      expect(status).toBe(404);
    });

    it('needs an administrative session', async () => {
      const { status } = await api(`/api/admin/series/${series.id}/contacts`);

      expect(status).toBe(401);
    });
  });

  describe('writing to them', () => {
    it('answers 202 and reports the send as under way (F56)', async () => {
      const started = Date.now();
      const { status, body } = await invite(message([addressOf(BO)]));
      const elapsed = Date.now() - started;

      expect(status).toBe(202);
      expect(body.state).toBe('sending');
      expect(body.recipients).toBe(1);
      expect(body.sent).toBe(0);
      // The whole point of the background sender: the answer does not wait for
      // SMTP, whether there is one recipient or two hundred.
      expect(elapsed).toBeLessThan(2000);

      const finished = await untilSent(body.id);
      expect(finished.state).toBe('sent');
      expect(finished.sent).toBe(1);
      expect(finished.finishedAt).not.toBeNull();
    }, 70_000);

    it('sends one message per recipient, addressed to them alone', async () => {
      await clearMailbox();

      const { body } = await invite(message([addressOf(AMINA), addressOf(BO)]));
      await untilSent(body.id);

      const toAmina = await waitForMailTo(AMINA);
      const toBo = await waitForMailTo(BO);
      // Never a shared To or CC: that would tell every invited person who else
      // was invited.
      expect(toAmina.to).toEqual([AMINA]);
      expect(toBo.to).toEqual([BO]);
      expect(await countMailTo(AMINA)).toBe(1);
    }, 70_000);

    it('sends the subject and the text the organizer wrote', async () => {
      await clearMailbox();

      const { body } = await invite(message([addressOf(BO)]));
      await untilSent(body.id);

      const mail = await waitForMailTo(BO);
      expect(mail.subject).toBe(`Invitation ${stamp}`);
      expect(mail.text).toContain('we would love to see you again.');
      // Greeted by name, which is why a recipient is a registration and not an
      // address (F55).
      expect(mail.text).toContain('Bo');
    }, 70_000);

    it('carries an objection link the organizer cannot leave out (F58)', async () => {
      await clearMailbox();

      const { body } = await invite(message([addressOf(BO)]));
      await untilSent(body.id);

      const mail = await waitForMailTo(BO);
      expect(mail.text).toContain('/invitations/unsubscribe?token=');
      expect(optOutTokenFrom(mail).length).toBeGreaterThan(20);
    }, 70_000);

    it('names the event when the invitation invites to one', async () => {
      await clearMailbox();

      const { body } = await invite(
        message([addressOf(BO)], { eventId: firstEvent.id }),
      );
      expect(body.eventId).toBe(firstEvent.id);
      await untilSent(body.id);

      const mail = await waitForMailTo(BO);
      expect(mail.text).toContain(`Invitations First ${stamp}`);
      expect(mail.text).toContain(
        `/series/${series.slug}/events/${firstEvent.slug}`,
      );
    }, 70_000);

    it('refuses an event of another series', async () => {
      const { status, body } = await invite(
        message([addressOf(BO)], { eventId: eventElsewhere.id }),
      );

      expect(status).toBe(400);
      expect(JSON.stringify(body)).toMatch(/different event series/);
    });

    it('refuses a registration of another series (F55)', async () => {
      const { status } = await invite(message([addressOf(ELSEWHERE)]));

      expect(status).toBe(400);
    });

    it('refuses an address that has not confirmed', async () => {
      const { status } = await invite(message([addressOf(PENDING)]));

      expect(status).toBe(400);
    });

    it('refuses a selection with no recipients at all', async () => {
      const { status } = await invite(message([]));

      expect(status).toBe(400);
    });

    it('refuses an id that is not a uuid before it reaches the database', async () => {
      const { status } = await invite(message(['not-a-uuid']));

      expect(status).toBe(400);
    });

    it('refuses an empty subject', async () => {
      const { status } = await invite(
        message([addressOf(BO)], { subject: '   ' }),
      );

      expect(status).toBe(400);
    });

    it('refuses an empty message', async () => {
      const { status } = await invite(message([addressOf(BO)], { body: '' }));

      expect(status).toBe(400);
    });

    it('takes no e-mail address anywhere in its input (F55)', async () => {
      const { status } = await invite({
        subject: 'Invitation',
        body: 'Come along.',
        recipients: [],
        // Not a field of the DTO; the global validation pipe strips or refuses
        // it, and either way nothing is sent to it.
        emails: ['stranger@example.org'],
      });

      expect(status).toBe(400);
      expect(await countMailTo('stranger@example.org')).toBe(0);
    });

    it('needs an administrative session', async () => {
      const { status } = await api(
        `/api/admin/series/${series.id}/invitations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(message([addressOf(BO)])),
        },
      );

      expect(status).toBe(401);
    });
  });

  describe('the log of what was sent', () => {
    it('lists the invitations of the series, newest first', async () => {
      const { status, body } = await api<InvitationList>(
        `/api/admin/series/${series.id}/invitations`,
        asAdmin(),
      );

      expect(status).toBe(200);
      expect(body.rows.length).toBeGreaterThan(0);
      const timestamps = body.rows.map((row) => row.createdAt);
      expect([...timestamps].sort().reverse()).toEqual(timestamps);
    });

    it('counts the recipients of each send rather than storing a number', async () => {
      const { body } = await api<InvitationList>(
        `/api/admin/series/${series.id}/invitations`,
        asAdmin(),
      );

      for (const row of body.rows) {
        expect(row.sent + row.failed).toBeLessThanOrEqual(row.recipients);
        expect(['sending', 'sent', 'partial']).toContain(row.state);
      }
    });

    it('answers 404 for an invitation that does not exist', async () => {
      const { status } = await api(
        '/api/admin/invitations/11111111-1111-4111-8111-111111111111',
        asAdmin(),
      );

      expect(status).toBe(404);
    });
  });

  describe('objecting to further invitations (E15)', () => {
    /** A person of their own, so the objection cannot disturb other tests. */
    const objector = `invite-objector-${stamp}@example.org`;
    let objectorId = '';
    let token = '';

    beforeAll(async () => {
      await clearMailbox();
      const [id] = await seedRegistrations(firstEvent.id, [
        {
          email: objector,
          firstName: 'Ola',
          lastName: 'Objector',
          status: 'confirmed',
        },
      ]);
      objectorId = id;

      const { body } = await invite(message([objectorId]));
      await untilSent(body.id);
      // Out of the message the server actually sent — not minted by the test.
      token = optOutTokenFrom(await waitForMailTo(objector));
    }, 70_000);

    it('is not something a GET can do (E5b)', async () => {
      const { status } = await api(
        `/api/user/invitations/opt-out?token=${encodeURIComponent(token)}`,
      );

      // A link previewer that fetched every URL in the mail must not decide
      // this for the reader.
      expect(status).toBe(404);
    });

    it('needs no account, and no administrative session', async () => {
      const { status, body } = await api<{ state: string }>(
        '/api/user/invitations/opt-out',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      );

      expect(status).toBe(200);
      expect(body.state).toBe('opted-out');
    });

    it('takes the address out of every further list — the criterion of AP 12', async () => {
      const { body } = await contacts('?pageSize=200');

      expect(body.rows.map((row) => row.email)).not.toContain(objector);
    });

    it('refuses to write to that registration afterwards', async () => {
      const { status } = await invite(message([objectorId]));

      // Not "sends nothing": the selection is refused, so an organizer working
      // from a stale list learns about it.
      expect(status).toBe(400);
    });

    it('answers already-opted-out on a second click', async () => {
      const { status, body } = await api<{ state: string }>(
        '/api/user/invitations/opt-out',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      );

      // From the reader's side nothing about their situation has changed, so
      // this is not an error.
      expect(status).toBe(200);
      expect(body.state).toBe('already-opted-out');
    });

    it('refuses a forged token', async () => {
      const { status } = await api('/api/user/invitations/opt-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: `${token.slice(0, -2)}xy` }),
      });

      expect(status).toBe(400);
    });
  });

  describe('two hundred addresses — the other criterion of AP 12', () => {
    let volumeEvent: Event;
    const total = 200;

    beforeAll(async () => {
      volumeEvent = (
        await api<Event>(
          `/api/admin/series/${series.id}/events`,
          asAdminJson('POST', {
            ...EVENT,
            name: `Invitations Volume ${stamp}`,
          }),
        )
      ).body;
      await seedManyConfirmedRegistrations(
        volumeEvent.id,
        total,
        `invite-volume-${stamp}`,
      );
      await clearMailbox();
    }, 60_000);

    it('accepts the send at once and delivers it afterwards (F56)', async () => {
      const page = (
        await api<ContactPage>(
          `/api/admin/series/${series.id}/contacts?search=invite-volume-${stamp}&pageSize=200`,
          asAdmin(),
        )
      ).body;
      expect(page.rows).toHaveLength(total);

      const started = Date.now();
      const { status, body } = await invite(
        message(page.rows.map((row) => row.registrationId)),
      );
      const elapsed = Date.now() - started;

      expect(status).toBe(202);
      expect(body.recipients).toBe(total);
      // The acceptance criterion: two hundred recipients do not turn the request
      // into a timeout. Two seconds is generous for writing two hundred rows.
      expect(elapsed).toBeLessThan(2000);

      const finished = await untilSent(body.id, 120_000);
      expect(finished.sent).toBe(total);
      expect(finished.failed).toBe(0);
      expect(finished.state).toBe('sent');
    }, 180_000);
  });
});
