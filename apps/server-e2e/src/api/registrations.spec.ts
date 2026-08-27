import { api, postJson } from '../support/api-client';
import {
  clearMailbox,
  confirmationTokenFrom,
  countMailTo,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of the registration endpoints (FR 3.5, E5, E5b, E10, E14).
 *
 * This is the suite that proves the acceptance criterion of AP 4 end to end: a
 * registration produces a mail, the link in that mail confirms it, a second
 * click reports the state instead of failing, a forged token is refused, and a
 * repeated attempt on the same address produces no second registration.
 *
 * The mail is read out of Mailpit rather than mocked away — a double opt-in that
 * is only asserted at the mailer interface has not been tested where it matters.
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
  slug: string;
}

interface Confirmation {
  state: string;
  eventName: string;
  seriesSlug: string;
  eventSlug: string;
}

/** Unique per run, so a leftover row cannot make the next run fail elsewhere. */
const stamp = Date.now();
const address = (name: string): string =>
  `${name}-${stamp}@registrations.example.org`;

const FUTURE_EVENT = {
  name: 'Registration Contract Event',
  description: 'The event this suite registers for.',
  eventType: 'onsite',
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

const APPLICANT = {
  firstName: 'Amina',
  lastName: 'Okonkwo',
  phone: '+49 221 123456',
  origin: 'Cologne',
  newsletterOptIn: true,
} as const;

function cookieFrom(headers: Headers): string {
  for (const header of headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [key, ...rest] = pair.split('=');
    if (key.trim() === SESSION_COOKIE)
      return `${SESSION_COOKIE}=${rest.join('=')}`;
  }
  return '';
}

describe('registrations API', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  let pastEvent: Event;
  let draftEvent: Event;
  /** Registrations created here, removed again in the teardown. */
  const registrations: string[] = [];

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const register = (
    email: string,
    overrides: Record<string, unknown> = {},
    slugs: { series: string; event: string } = {
      series: series.slug,
      event: event.slug,
    },
  ) =>
    postJson<{ email: string }>(
      `/api/user/series/${slugs.series}/events/${slugs.event}/registrations`,
      { ...APPLICANT, email, ...overrides },
    );

  /**
   * The registration's own id, taken from the token in its confirmation mail.
   *
   * The token is signed, not encrypted (E5) — its payload is deliberately
   * readable, and reading it here is what lets the teardown remove the rows
   * again. The participant overview of AP 5 replaces this with a list endpoint.
   */
  const idFromToken = (token: string): string =>
    Buffer.from(token.split('.')[0], 'base64url')
      .toString('utf8')
      .split('|')[1];

  /** Registers, reads the mail, and returns the token the link carried. */
  const registerAndCollectToken = async (email: string): Promise<string> => {
    const response = await register(email);
    expect(response.status).toBe(202);
    const token = confirmationTokenFrom(await waitForMailTo(email));
    registrations.push(idFromToken(token));
    return token;
  };

  beforeAll(async () => {
    if (!credentials.email || !credentials.password) {
      throw new Error(
        'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set for the API contract tests.',
      );
    }
    await waitForMailpit();
    await clearMailbox();

    const login = await postJson('/api/admin/auth/login', credentials);
    cookie = cookieFrom(login.headers);

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Registration Contract Series ${stamp}`,
          description: 'Holds the event this suite registers for.',
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
    pastEvent = await createEvent({
      ...FUTURE_EVENT,
      name: 'Registration Contract Past Event',
      startsAt: '2020-02-01T09:00:00.000Z',
      endsAt: '2020-02-01T17:00:00.000Z',
    });
    draftEvent = await createEvent({
      ...FUTURE_EVENT,
      name: 'Registration Contract Draft Event',
      status: 'draft',
    });
  });

  afterAll(async () => {
    // Registrations first: a confirmed one blocks deleting the series (E14),
    // which is the rule this suite also asserts.
    for (const id of registrations) {
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
    await clearMailbox();
  });

  it('accepts a registration and sends a confirmation mail', async () => {
    const email = address('accepted');

    const response = await register(email);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ email });

    const mail = await waitForMailTo(email);
    registrations.push(idFromToken(confirmationTokenFrom(mail)));
    expect(mail.subject).toContain('Registration Contract Event');
    // The link points at the participant client, not at the API (E5b).
    expect(mail.text).toContain('/registrations/confirm?token=');
  });

  it('lower-cases the address it answers with and stores', async () => {
    const email = address('MiXeD');

    const response = await register(email);

    expect(response.body.email).toBe(email.toLowerCase());
    registrations.push(
      idFromToken(
        confirmationTokenFrom(await waitForMailTo(email.toLowerCase())),
      ),
    );
  });

  it('confirms with the token from the mail, and says so on the second click', async () => {
    const email = address('confirming');
    const token = await registerAndCollectToken(email);

    const first = await postJson<Confirmation>(
      '/api/user/registrations/confirm',
      { token },
    );
    expect(first.status).toBe(200);
    expect(first.body.state).toBe('confirmed');
    expect(first.body.eventName).toBe('Registration Contract Event');
    expect(first.body.eventSlug).toBe(event.slug);

    // The receipt is the second mail to this address.
    const receipt = await waitForMailTo(email);
    expect(receipt.subject).toMatch(/confirmed|bestätigt/);

    const second = await postJson<Confirmation>(
      '/api/user/registrations/confirm',
      { token },
    );
    // Idempotent by design: people click links twice (E5b).
    expect(second.status).toBe(200);
    expect(second.body.state).toBe('already-confirmed');
  });

  it('refuses a token whose payload was edited', async () => {
    const email = address('tampering');
    const token = await registerAndCollectToken(email);
    const [payload, signature] = token.split('.');
    const forged = Buffer.from(
      Buffer.from(payload, 'base64url')
        .toString('utf8')
        .replace(/\|[^|]+\|/, '|00000000-0000-0000-0000-000000000000|'),
      'utf8',
    ).toString('base64url');

    const response = await postJson('/api/user/registrations/confirm', {
      token: `${forged}.${signature}`,
    });

    expect(response.status).toBe(400);
  });

  it('refuses a token that was never signed here', async () => {
    const response = await postJson('/api/user/registrations/confirm', {
      token: 'bm90LWEtdG9rZW4.bm90LWEtc2lnbmF0dXJl',
    });

    expect(response.status).toBe(400);
  });

  it('creates no second registration for the same address', async () => {
    const email = address('twice');
    const token = await registerAndCollectToken(email);
    await postJson('/api/user/registrations/confirm', { token });

    const again = await register(email, {
      firstName: 'Someone',
      lastName: 'Else',
    });

    // Same answer as the first attempt (E10) — nothing about the address leaks.
    expect(again.status).toBe(202);
    expect(again.body).toEqual({ email });
    // Three mails: the confirmation, the receipt, and the receipt sent again.
    // A second confirmation request would mean a second pending registration.
    expect(await countMailTo(email)).toBe(3);
    const mails = await waitForMailTo(email);
    expect(mails.subject).toMatch(/confirmed|bestätigt/);
  });

  it('reports how many confirmed registrations block a deletion (E14)', async () => {
    const email = address('blocking');
    const token = await registerAndCollectToken(email);
    await postJson('/api/user/registrations/confirm', { token });

    const deleteEvent = await api(
      `/api/admin/events/${event.id}`,
      asAdmin({ method: 'DELETE' }),
    );
    const deleteSeries = await api(
      `/api/admin/series/${series.id}`,
      asAdmin({ method: 'DELETE' }),
    );

    expect(deleteEvent.status).toBe(409);
    expect(deleteSeries.status).toBe(409);
    // The count is the only place AP 4 makes the registrations visible; the
    // overview that shows them arrives in AP 5.
    expect(JSON.stringify(deleteEvent.body)).toMatch(/confirmed registration/);
  });

  it('does not let anyone delete a registration without a session', async () => {
    const response = await api(
      '/api/admin/registrations/00000000-0000-0000-0000-000000000000',
      { method: 'DELETE' },
    );

    expect(response.status).toBe(401);
  });

  it('answers 404 for an event that is not published', async () => {
    const response = await register(
      address('draft'),
      {},
      {
        series: series.slug,
        event: draftEvent.slug,
      },
    );

    expect(response.status).toBe(404);
  });

  it('refuses an event that has already taken place', async () => {
    const response = await register(
      address('past'),
      {},
      {
        series: series.slug,
        event: pastEvent.slug,
      },
    );

    expect(response.status).toBe(409);
  });

  it('rejects a form without the three mandatory fields', async () => {
    const response = await postJson(
      `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
      { firstName: 'Nameless' },
    );

    expect(response.status).toBe(400);
  });

  it('rejects an unknown field instead of dropping it', async () => {
    const response = await register(address('unknown'), {
      favouriteColour: 'blue',
    });

    // `forbidNonWhitelisted`: a typo in a field key of the coming field kit
    // (F12) must not disappear silently.
    expect(response.status).toBe(400);
  });

  it('rejects an address that is not one', async () => {
    const response = await register('not-an-address');

    expect(response.status).toBe(400);
  });
});
