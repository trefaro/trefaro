import { adminCookie } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  deleteNewsletterSubscriptions,
  deleteRegistrations,
  markContactOptOut,
  newsletterConfirmedAt,
  newsletterRowCount,
  seedRegistrations,
} from '../support/database';
import {
  clearMailbox,
  newsletterTokenFrom,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of AP 12: the newsletter is an address, not a registration
 * (FR 4.8 — E45, F8).
 *
 * Five things are decided here, and each of them is a sentence somebody could
 * otherwise get wrong in good faith:
 *
 * 1. **A sign-up counts only after the click in the mailbox** (E45). The row
 *    exists from the moment the form is posted and appears on no list until the
 *    link is used — which is what makes the double opt-in more than decoration.
 * 2. **The answer never varies** (E32 applied word for word). New address,
 *    unconfirmed address, address that has been on the list for a year: the
 *    same 200 and the same body. This form is public, so anything else would
 *    turn it into a query for who is on the list.
 * 3. **The overview says which source an address comes from**, over both of
 *    them: the checkbox in a registration form and the sign-up in the app. An
 *    address that did both appears twice, because it said yes twice about two
 *    different things.
 * 4. **An objection wins over both sources** (F24). An address that used the
 *    objection link of an invitation appears in no further list, and this is a
 *    further list — a promise kept in the port's SQL, not by a caller
 *    remembering to filter (F152, F173).
 * 5. **The module switch is real** (F53, E21). Off — which is the default —
 *    and the sign-up, the confirmation and the overview all answer 404, while
 *    every stored consent stays where it is (E14).
 *
 * There is deliberately nothing here about sending a newsletter: v1 has no
 * dispatch and will not get one (F8). What this list is for is being exported.
 */
interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
}

interface Consent {
  email: string;
  source: 'form' | 'app';
  confirmedAt: string;
  seriesId: string | null;
  seriesName: string | null;
  subscriptionId: string | null;
}

interface AudiencePage {
  rows: Consent[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    total: number;
    fromForm: number;
    fromApp: number;
    addresses: number;
  };
}

/** Unique per run, so a leftover row cannot make the next run fail elsewhere. */
const stamp = Date.now();
const DOMAIN = `@newsletter-${stamp}.example.org`;

const EVENT = {
  description: 'The event whose form has the newsletter box.',
  eventType: 'onsite',
  startsAt: '2099-05-20T08:00:00.000Z',
  endsAt: '2099-05-20T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

describe('the newsletter opt-in administration', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  /**
   * What the switch was before this suite touched it.
   *
   * `null` until it has been read, and only then is it put back: a suite may
   * only restore what it read. The guess that was here in AP 11 left `push`
   * switched on in the development instance and broke the organizer's module
   * page, which is a different suite entirely.
   */
  let wasEnabled: boolean | null = null;

  const asAdmin = (method: string, payload?: unknown) => ({
    method,
    headers: {
      cookie,
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });

  const setModule = (enabled: boolean) =>
    api(`/api/admin/modules/newsletter-opt-in`, asAdmin('PATCH', { enabled }));

  const moduleEnabled = async (): Promise<boolean> => {
    const { body } = await api<{ key: string; enabled: boolean }[]>(
      '/api/admin/modules',
      asAdmin('GET'),
    );
    return (
      body.find((one) => one.key === 'newsletter-opt-in')?.enabled ?? false
    );
  };

  const signUp = (email: string, seriesSlug?: string) =>
    postJson<{ email: string }>('/api/user/newsletter', {
      email,
      ...(seriesSlug ? { seriesSlug } : {}),
    });

  const confirm = (token: string) =>
    postJson<{ state: string }>('/api/user/newsletter/confirm', { token });

  const overview = (query = '') =>
    api<AudiencePage>(`/api/admin/newsletter${query}`, asAdmin('GET'));

  /** Signs an address up and follows the link in its mail, as a person would. */
  const signUpAndConfirm = async (email: string, seriesSlug?: string) => {
    const posted = await signUp(email, seriesSlug);
    expect(posted.status).toBe(200);
    const mail = await waitForMailTo(email);
    const confirmed = await confirm(newsletterTokenFrom(mail));
    expect(confirmed.status).toBe(200);
    return confirmed.body;
  };

  const rowsFor = async (email: string): Promise<Consent[]> => {
    const { body } = await overview('?pageSize=200');
    return body.rows.filter((row) => row.email === email.toLowerCase());
  };

  beforeAll(async () => {
    await waitForMailpit();
    await clearMailbox();
    cookie = adminCookie();

    wasEnabled = await moduleEnabled();
    await setModule(true);

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdmin('POST', {
          name: `Newsletter Contract Series ${stamp}`,
          description: 'The series this suite signs up for.',
          status: 'published',
        }),
      )
    ).body;

    event = (
      await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdmin('POST', { ...EVENT, name: `Newsletter Event ${stamp}` }),
      )
    ).body;
  });

  afterAll(async () => {
    await deleteNewsletterSubscriptions(DOMAIN);
    if (event?.id) await deleteRegistrations(event.id);
    if (series?.id) {
      await api(`/api/admin/series/${series.id}`, {
        method: 'DELETE',
        headers: { cookie },
      });
    }
    if (wasEnabled !== null) await setModule(wasEnabled);
    await closeDatabase();
  });

  describe('signing up', () => {
    it('stores the address unconfirmed and sends the link (E45)', async () => {
      const email = `fresh${DOMAIN}`;

      const { status, body } = await signUp(email);

      expect(status).toBe(200);
      expect(body).toEqual({ email });
      // Stored, and on no list: that is the state a double opt-in exists for.
      expect(await newsletterConfirmedAt(email)).toBeNull();
      expect(await rowsFor(email)).toEqual([]);

      const mail = await waitForMailTo(email);
      expect(mail.subject).toMatch(/confirm/i);
      expect(() => newsletterTokenFrom(mail)).not.toThrow();
    });

    it('counts the address once, however it is spelled', async () => {
      const email = `casing${DOMAIN}`;

      await signUp(email.toUpperCase());
      await signUp(email);

      // One row, because the unique index is on `lower(email)` — and the
      // second post is somebody asking for the mail again, not a second
      // consent.
      expect(await newsletterRowCount(email)).toBe(1);
    });

    it('answers the same way for an address that is already on the list', async () => {
      const email = `repeat${DOMAIN}`;
      await signUpAndConfirm(email);

      const again = await signUp(email);

      expect(again.status).toBe(200);
      expect(again.body).toEqual({ email });
      // And nothing changed: the consent keeps the moment it was given.
      expect(await newsletterRowCount(email)).toBe(1);
    });

    it('refuses something that is not an address', async () => {
      const { status } = await signUp('not-an-address');

      expect(status).toBe(400);
    });

    it('rejects a field the contract does not name (F44)', async () => {
      const { status } = await postJson('/api/user/newsletter', {
        email: `strict${DOMAIN}`,
        subscribeAll: true,
      });

      expect(status).toBe(400);
    });

    it('refuses a series nobody can see', async () => {
      const { status } = await signUp(
        `ghost${DOMAIN}`,
        `no-such-series-${stamp}`,
      );

      // About a series and not about an address: series are public, so this
      // says nothing the start page does not.
      expect(status).toBe(404);
    });
  });

  describe('confirming', () => {
    it('turns the sign-up into a consent, once', async () => {
      const email = `confirming${DOMAIN}`;
      const posted = await signUp(email);
      expect(posted.status).toBe(200);
      const token = newsletterTokenFrom(await waitForMailTo(email));

      const first = await confirm(token);
      const second = await confirm(token);

      expect(first.body).toEqual({ state: 'confirmed' });
      // A second click reports what is already true (E5b): people click links
      // twice, and forwarded mail gets opened by a colleague.
      expect(second.body).toEqual({ state: 'already-confirmed' });
      expect(await newsletterConfirmedAt(email)).toBeInstanceOf(Date);
    });

    it('refuses a token that was signed for something else', async () => {
      // The purpose is inside the signature, so no other confirmation link in
      // this application can add an address to this list.
      const { status } = await confirm('bm90LWEtdG9rZW4.signature');

      expect(status).toBe(400);
    });
  });

  describe('the overview', () => {
    it('names both sources, and counts them apart (E45)', async () => {
      const both = `both${DOMAIN}`;
      await seedRegistrations(event.id, [
        {
          email: both,
          firstName: 'Amina',
          lastName: 'Okonkwo',
          status: 'confirmed',
          newsletterOptIn: true,
        },
      ]);
      await signUpAndConfirm(both, series.slug);

      const rows = await rowsFor(both);

      // Two rows for one address, and that is right: it said yes in a
      // registration form and again in the app, about two different things.
      expect(rows.map((row) => row.source).sort()).toEqual(['app', 'form']);
      expect(rows.every((row) => row.seriesId === series.id)).toBe(true);
      // Only the app source can be taken back here; a checkbox in a form
      // belongs to that registration.
      expect(
        rows.find((row) => row.source === 'form')?.subscriptionId,
      ).toBeNull();
      expect(rows.find((row) => row.source === 'app')?.subscriptionId).toEqual(
        expect.any(String),
      );
    });

    it('names the series of a consent, and leaves an instance-wide one open', async () => {
      const wide = `wide${DOMAIN}`;
      const scoped = `scoped${DOMAIN}`;
      await signUpAndConfirm(wide);
      await signUpAndConfirm(scoped, series.slug);

      const [wideRow] = await rowsFor(wide);
      const [scopedRow] = await rowsFor(scoped);

      expect(wideRow).toMatchObject({ seriesId: null, seriesName: null });
      expect(scopedRow).toMatchObject({
        seriesId: series.id,
        seriesName: `Newsletter Contract Series ${stamp}`,
      });
    });

    it('leaves out a sign-up nobody confirmed', async () => {
      const email = `pending${DOMAIN}`;
      await signUp(email);

      expect(await newsletterConfirmedAt(email)).toBeNull();
      expect(await rowsFor(email)).toEqual([]);
    });

    it('leaves out a registration that never confirmed its address', async () => {
      const email = `unconfirmed${DOMAIN}`;
      await seedRegistrations(event.id, [
        {
          email,
          firstName: 'Ben',
          lastName: 'Nowak',
          status: 'pending',
          newsletterOptIn: true,
        },
      ]);

      // The box was ticked, the address was never proven. Same rule on both
      // sources, and it lives in the port's SQL.
      expect(await rowsFor(email)).toEqual([]);
    });

    it('leaves out a registration that did not tick the box', async () => {
      const email = `noopt${DOMAIN}`;
      await seedRegistrations(event.id, [
        {
          email,
          firstName: 'Chi',
          lastName: 'Adeyemi',
          status: 'confirmed',
          newsletterOptIn: false,
        },
      ]);

      expect(await rowsFor(email)).toEqual([]);
    });

    it('leaves out an address that objected to being written to (F24)', async () => {
      const email = `objected${DOMAIN}`;
      await seedRegistrations(event.id, [
        {
          email,
          firstName: 'Dana',
          lastName: 'Roth',
          status: 'confirmed',
          newsletterOptIn: true,
        },
      ]);
      await signUpAndConfirm(email);
      expect((await rowsFor(email)).length).toBeGreaterThan(0);

      await markContactOptOut(email);

      // Both sources at once, by address: the objection was not about one
      // registration, it was "stop writing to me".
      expect(await rowsFor(email)).toEqual([]);
    });

    it('says how many consents there are and how many addresses', async () => {
      const { body } = await overview('?pageSize=200');

      expect(body.counts.total).toBe(
        body.counts.fromForm + body.counts.fromApp,
      );
      // Smaller or equal, and smaller exactly when somebody said yes twice —
      // this suite has made that happen, so it is smaller here.
      expect(body.counts.addresses).toBeLessThan(body.counts.total);
      expect(body.total).toBe(body.counts.total);
    });

    it('pages without losing rows', async () => {
      const first = await overview('?page=1&pageSize=2');
      const second = await overview('?page=2&pageSize=2');

      expect(first.body.rows).toHaveLength(2);
      expect(first.body.page).toBe(1);
      expect(first.body.pageSize).toBe(2);
      const emails = new Set(
        [...first.body.rows, ...second.body.rows].map(
          (row) => `${row.email}/${row.source}/${row.seriesId}`,
        ),
      );
      expect(emails.size).toBe(
        first.body.rows.length + second.body.rows.length,
      );
    });

    it('needs an administrative session', async () => {
      const anonymous = await api('/api/admin/newsletter');

      expect(anonymous.status).toBe(401);
    });

    it('takes one sign-up back, and only that one', async () => {
      const email = `withdrawn${DOMAIN}`;
      await signUpAndConfirm(email);
      const [row] = await rowsFor(email);

      const removed = await api(
        `/api/admin/newsletter/${row.subscriptionId}`,
        asAdmin('DELETE'),
      );

      expect(removed.status).toBe(204);
      expect(await newsletterConfirmedAt(email)).toBeUndefined();
      // Idempotent: the organizer's answer to the person is the same either
      // way, so a second click is not an error.
      const again = await api(
        `/api/admin/newsletter/${row.subscriptionId}`,
        asAdmin('DELETE'),
      );
      expect(again.status).toBe(204);
    });
  });

  describe('with the module switched off', () => {
    afterEach(() => setModule(true));

    it('answers 404 on every route and keeps every consent (F53, E14)', async () => {
      const kept = `kept${DOMAIN}`;
      await signUpAndConfirm(kept);

      await setModule(false);

      const signedUp = await signUp(`while-off${DOMAIN}`);
      const confirmed = await confirm('anything');
      const list = await overview();

      expect(signedUp.status).toBe(404);
      expect(confirmed.status).toBe(404);
      expect(list.status).toBe(404);
      // Switching a module off deletes nothing — the consent is still there
      // when it comes back on.
      expect(await newsletterConfirmedAt(kept)).toBeInstanceOf(Date);
    });
  });
});
