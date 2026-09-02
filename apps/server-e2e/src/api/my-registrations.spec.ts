import { adminCookie, cookieFrom } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  deleteProfiles,
  seedRegistrations,
} from '../support/database';
import {
  accountConfirmationTokenFrom,
  clearMailbox,
  confirmationTokenFrom,
  selfServiceTokenFrom,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of AP 4: the registration knows the person (FR 3.3, FR 4.7 — E11,
 * E31, F125).
 *
 * Four promises are kept or broken here, and none of them can be decided
 * without a request:
 *
 * 1. **An old link from an inbox still works.** That was the promise of E11,
 *    made before there was a login to put in front of it.
 * 2. **A logged-in participant needs no link.** The same view, the same seats,
 *    resolved by the session — and somebody else's registration is a 404 that
 *    reads exactly like an unknown id.
 * 3. **The participant overview marks the addresses that have an account**
 *    (FR 3.3), which is the column phase 1 deliberately left out (E13).
 * 4. **A mail is written in the recipient's language, and its content is in the
 *    same one** (F125). Read out of Mailpit, because a letter is the one thing
 *    in this application that cannot be reloaded.
 *
 * The suite assumes the instance is *not* configured in German — the factory
 * default is English, and the browser suites rely on the same thing (see
 * `docs/rules/e2e-tests.md`: a development database that has been seeded is not
 * the factory default). The contrast between "the reader's language" and "the
 * instance's" is the point of the fourth promise.
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

interface SessionInfo {
  participant: { id: string; email: string; preferredLocale: string };
  expiresAt: string;
}

interface MyProgramItem {
  id: string;
  signedUp: boolean;
}

interface MyRegistration {
  id?: string;
  email: string;
  status: string;
  seriesSlug: string;
  event: { name: string; slug: string };
  program: MyProgramItem[];
}

interface MySummary {
  id: string;
  status: string;
  seriesSlug: string;
  confirmedAt: string | null;
  event: { name: string };
}

interface MyPage {
  rows: MySummary[];
  total: number;
  page: number;
  pageSize: number;
}

interface ParticipantRow {
  id: string;
  email: string;
  hasProfile: boolean;
}

const USER_SESSION_COOKIE = 'trefaro_user_session';

/** Unique per run, so a leftover row cannot make the next run take a branch. */
const stamp = Date.now();
const DOMAIN = '@mine.example.org';
const address = (name: string): string => `${name}-${stamp}${DOMAIN}`;
const PASSWORD = 'a-long-enough-passphrase';

const ENGLISH_TITLE = `My Registrations Contract Event ${stamp}`;
const GERMAN_TITLE = `Auftakt in Köln ${stamp}`;

const EVENT = {
  name: ENGLISH_TITLE,
  description: 'The event these registrations are for.',
  eventType: 'onsite',
  startsAt: '2099-04-18T08:00:00.000Z',
  endsAt: '2099-04-18T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

describe('my registrations API', () => {
  let admin = '';
  let cookie = '';
  let series: Series;
  let event: Event;
  let workshop: Item;
  /** The account's own registration for the event above. */
  let mine = '';
  /** Somebody else's registration for the same event — never this account's. */
  let theirs = '';
  let accountEmail = '';
  let defaultLocale = 'en';

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie: admin },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie: admin },
    body: JSON.stringify(payload),
  });

  const asParticipant = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const list = (query = '') =>
    api<MyPage>(`/api/participant/registrations${query}`, asParticipant());

  const view = (id: string, query = '') =>
    api<MyRegistration>(
      `/api/participant/registrations/${id}${query}`,
      asParticipant(),
    );

  const byLink = (token: string) =>
    api<MyRegistration>(
      `/api/user/registrations/me?token=${encodeURIComponent(token)}`,
    );

  const seat = (method: 'PUT' | 'DELETE', registrationId: string) =>
    api<MyRegistration>(
      `/api/participant/registrations/${registrationId}` +
        `/program-items/${workshop.id}/signup`,
      asParticipant({ method }),
    );

  const overview = (search: string) =>
    api<{ rows: ParticipantRow[] }>(
      `/api/admin/events/${event.id}/registrations?search=${encodeURIComponent(search)}`,
      asAdmin(),
    );

  /** The shipped words of one language, through the endpoint that serves them. */
  const catalogueOf = async (locale: string): Promise<Record<string, string>> =>
    (await api<Record<string, string>>(`/api/i18n/${locale}`)).body;

  /** Creates an account. Confirmed only when asked, because both are useful. */
  const createAccount = async (
    name: string,
    preferredLocale: string,
    confirm = true,
  ): Promise<string> => {
    const email = address(name);
    await postJson('/api/user/profiles', {
      email,
      password: PASSWORD,
      firstName: 'Amina',
      lastName: 'Okonkwo',
      preferredLocale,
    });
    if (confirm) {
      await postJson('/api/user/profiles/confirm', {
        token: accountConfirmationTokenFrom(await waitForMailTo(email)),
      });
    }
    return email;
  };

  /** Registers the address for the event and confirms it, like a person would. */
  const registerAndConfirm = async (email: string): Promise<void> => {
    const registered = await postJson(
      `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
      { firstName: 'Amina', lastName: 'Okonkwo', email, customFields: {} },
    );
    expect(registered.status).toBe(202);
    await postJson('/api/user/registrations/confirm', {
      token: confirmationTokenFrom(await waitForMailTo(email)),
    });
  };

  const idOf = async (email: string): Promise<string> => {
    const found = await overview(email);
    const [row] = found.body.rows;
    if (!row) throw new Error(`No registration for ${email} in the overview.`);
    return row.id;
  };

  beforeAll(async () => {
    await waitForMailpit();
    admin = adminCookie();
    defaultLocale = (await api<{ defaultLocale: string }>('/api/config')).body
      .defaultLocale;

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `My Registrations Contract Series ${stamp}`,
          description: 'Holds the event these registrations are for.',
          status: 'published',
        }),
      )
    ).body;

    event = (
      await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson('POST', EVENT),
      )
    ).body;

    // The German half of F125: the letter's language decides the title too.
    await api(
      `/api/admin/events/${event.id}/translations/de`,
      asAdminJson('PUT', { name: GERMAN_TITLE, description: null }),
    );

    workshop = (
      await api<Item>(
        `/api/admin/events/${event.id}/program-items`,
        asAdminJson('POST', {
          title: 'Workshop with seats',
          startsAt: '2099-04-18T09:00:00.000Z',
          endsAt: '2099-04-18T10:30:00.000Z',
          registrationEnabled: true,
          capacity: 20,
        }),
      )
    ).body;

    accountEmail = await createAccount('owner', 'de');
    const login = await postJson<SessionInfo>('/api/participant/auth/login', {
      email: accountEmail,
      password: PASSWORD,
    });
    expect(login.status).toBe(200);
    cookie = cookieFrom(login.headers, USER_SESSION_COOKIE);

    [theirs] = await seedRegistrations(event.id, [
      {
        email: address('stranger-row'),
        firstName: 'Ben',
        lastName: 'Mwangi',
        status: 'confirmed',
      },
    ]);
  });

  afterAll(async () => {
    for (const id of [mine, theirs].filter(Boolean)) {
      await api(
        `/api/admin/registrations/${id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
    if (series?.id) {
      await api(
        `/api/admin/series/${series.id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
    await deleteProfiles(DOMAIN);
    await clearMailbox();
    await closeDatabase();
  });

  describe('a mail in the recipient’s language (F125)', () => {
    let germanConfirmation = '';
    let selfServiceToken = '';

    it('writes to an address with an account in the language it chose', async () => {
      await clearMailbox();
      const registered = await postJson(
        `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
        {
          firstName: 'Amina',
          lastName: 'Okonkwo',
          email: accountEmail,
          customFields: {},
        },
      );
      expect(registered.status).toBe(202);

      const mail = await waitForMailTo(accountEmail);
      const german = await catalogueOf('de');

      expect(mail.text).toContain(german['mail.confirm.step']);
      // Both halves in one assertion, which is the point of F125: a German
      // letter naming the English original would be half a decision.
      expect(mail.subject).toContain(GERMAN_TITLE);
      expect(mail.subject).not.toContain(ENGLISH_TITLE);
      germanConfirmation = confirmationTokenFrom(mail);
    });

    it('keeps the instance’s language for an address without an account', async () => {
      const stranger = address('stranger-mail');
      await registerAndConfirm(stranger);

      const receipt = await waitForMailTo(stranger);
      const shipped = await catalogueOf(defaultLocale);

      expect(receipt.text).toContain(shipped['mail.receipt.keepPrivate']);
      expect(receipt.subject).toContain(ENGLISH_TITLE);
      expect(receipt.subject).not.toContain(GERMAN_TITLE);
      // Removed again here rather than in the teardown: it is not this
      // account's registration and no later test knows about it.
      await api(
        `/api/admin/registrations/${await idOf(stranger)}`,
        asAdmin({ method: 'DELETE' }),
      );
    });

    it('sends the receipt in the same language as the request', async () => {
      const confirmed = await postJson('/api/user/registrations/confirm', {
        token: germanConfirmation,
      });
      expect(confirmed.status).toBe(200);

      const receipt = await waitForMailTo(accountEmail);
      const german = await catalogueOf('de');

      expect(receipt.text).toContain(german['mail.receipt.keepPrivate']);
      expect(receipt.subject).toContain(GERMAN_TITLE);
      selfServiceToken = selfServiceTokenFrom(receipt);
      mine = await idOf(accountEmail);
    });

    it('falls back to English as a whole for a language nothing translates (E24)', async () => {
      // A profile that has never been confirmed still carries a preference:
      // the one mail it ever receives is its own confirmation request, and the
      // language was chosen on the form a moment earlier.
      const french = await createAccount('french', 'fr', false);

      const mail = await waitForMailTo(french);
      const english = await catalogueOf('en');

      // The letter and its content move together: an English letter names the
      // English original, not the French translation of nothing.
      expect(mail.text).toContain(english['mail.profileConfirm.step']);
      expect(mail.subject).not.toContain(GERMAN_TITLE);
    });

    it('still answers the link that was mailed before the login existed (E11)', async () => {
      const opened = await byLink(selfServiceToken);

      expect(opened.status).toBe(200);
      expect(opened.body.email).toBe(accountEmail);
    });
  });

  describe('the list a session opens (FR 4.7)', () => {
    it('needs a session', async () => {
      const anonymous = await api('/api/participant/registrations');

      expect(anonymous.status).toBe(401);
    });

    it('lists the registrations of this address, and only those', async () => {
      const page = await list();

      expect(page.status).toBe(200);
      expect(page.body.rows.map((row) => row.id)).toEqual([mine]);
      expect(page.body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
      expect(page.body.rows[0].seriesSlug).toBe(series.slug);
      expect(page.body.rows[0].confirmedAt).not.toBeNull();
    });

    it('names the event in the language that was asked for (FR 3.12)', async () => {
      const page = await list('?locale=de');

      expect(page.body.rows[0].event.name).toBe(GERMAN_TITLE);
    });

    it('caps the page size, so one request cannot ask for everything', async () => {
      const page = await list('?pageSize=5000');

      expect(page.body.pageSize).toBe(50);
    });
  });

  describe('one registration, resolved by the session (E11, E31)', () => {
    it('opens without a token at all', async () => {
      const opened = await view(mine);

      expect(opened.status).toBe(200);
      expect(opened.body.email).toBe(accountEmail);
      expect(opened.body.event.slug).toBe(event.slug);
      expect(opened.body.program).toHaveLength(1);
    });

    it('claims and gives up a seat (FR 3.10)', async () => {
      const claimed = await seat('PUT', mine);
      expect(claimed.status).toBe(200);
      expect(claimed.body.program[0].signedUp).toBe(true);

      const released = await seat('DELETE', mine);
      expect(released.status).toBe(200);
      expect(released.body.program[0].signedUp).toBe(false);
    });

    it('answers 404 for a registration of somebody else', async () => {
      const foreign = await view(theirs);

      expect(foreign.status).toBe(404);
    });

    it('says the same thing for an id nothing matches', async () => {
      const unknown = await view('11111111-2222-3333-4444-555555555555');
      const foreign = await view(theirs);

      // Worded identically, so a logged-in participant cannot find out which
      // registrations exist by watching the difference.
      expect(unknown.status).toBe(404);
      expect(message(unknown.body)).toBe(message(foreign.body));
    });

    it('refuses a seat in a registration that is not theirs', async () => {
      const foreign = await seat('PUT', theirs);

      expect(foreign.status).toBe(404);
    });
  });

  describe('the profile column of the participant overview (FR 3.3)', () => {
    it('marks an address that has a confirmed account', async () => {
      const marked = await overview(accountEmail);

      expect(marked.body.rows[0].hasProfile).toBe(true);
    });

    it('leaves an address without one unmarked', async () => {
      const plain = await overview('stranger-row');

      expect(plain.body.rows[0].hasProfile).toBe(false);
    });
  });
});

/** The `message` of an error body, whatever else it carries. */
function message(body: unknown): string {
  return typeof body === 'object' && body && 'message' in body
    ? String((body as { message: unknown }).message)
    : '';
}
