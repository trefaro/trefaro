import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of AP 2 of phase 5: what this instance refuses to do too often, and
 * *whose* budget it comes out of (E4, E60).
 *
 * Four counters guard the public endpoints, and until this package all four
 * counted the **caller**. That is the right unit for a password guess and the
 * wrong one for a mail: a caller picks their own address and can pick a new one,
 * while the inbox that receives what they send cannot. So there is a fifth
 * counter now, per recipient, and this suite is the proof that it belongs to
 * the inbox — because a counter that silently tracked the caller after all
 * would look exactly like a working one from inside a single test process.
 *
 * The forwarded client address is how this is asked. Only the reverse proxy
 * publishes a port and it sets `X-Forwarded-For`, so the server trusts exactly
 * one hop (`main.ts`) and reads the last entry as the client — which lets a
 * test be several clients without several machines.
 *
 * What it spends: six registrations on one address and three on others, against
 * a registration budget the end-to-end profile sets to several hundred
 * (`apps/server/.env.serve-e2e`). The recipient budget is the one number that
 * profile deliberately leaves at the shipped value, which is what makes the
 * refusal below the real one rather than a staged one.
 */
interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  slug: string;
}

const stamp = Date.now();
const address = (name: string): string =>
  `${name}-${stamp}@rate-limits.example.org`;

const APPLICANT = {
  firstName: 'Amina',
  lastName: 'Okonkwo',
  phone: '+49 221 123456',
  origin: 'Cologne',
  newsletterOptIn: false,
} as const;

describe('rate limits API', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
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

  /** One registration, as if it had come through the proxy from `client`. */
  const registerFrom = (client: string, email: string) =>
    api<{ email: string }>(
      `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // The proxy's own hop comes first, the client it vouches for last.
          'x-forwarded-for': `203.0.113.1, ${client}`,
        },
        body: JSON.stringify({ ...APPLICANT, email }),
      },
    );

  beforeAll(async () => {
    cookie = adminCookie();

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Rate Limit Contract Series ${stamp}`,
          description: 'Holds the event this suite registers for.',
          status: 'published',
        }),
      )
    ).body;

    event = (
      await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson('POST', {
          name: 'Rate Limit Contract Event',
          description: 'The event this suite registers for.',
          eventType: 'onsite',
          startsAt: '2099-05-12T08:00:00.000Z',
          endsAt: '2099-05-12T15:00:00.000Z',
          timezone: 'Europe/Berlin',
          venueName: 'Bürgerhaus Kalk',
          languages: ['de', 'en'],
          status: 'published',
        }),
      )
    ).body;
  });

  afterAll(async () => {
    // Registrations first: a series with registrations under it refuses to be
    // deleted (E14), and a fixture that made them has to take them back.
    const found = await api<{ rows: { id: string }[] }>(
      `/api/admin/events/${event?.id}/registrations`,
      asAdmin(),
    );
    for (const row of found.body?.rows ?? []) registrations.push(row.id);
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
  });

  /*
   * Asked first, because every assertion after it depends on the answer: if the
   * forwarded address were ignored, the two calls below would share a counter
   * and this suite would be one client pretending to be many.
   */
  it('gives every forwarded client address a budget of its own', async () => {
    const remaining = async (client: string, email: string) => {
      const response = await registerFrom(client, email);
      expect(response.status).toBe(202);
      return response.headers.get('x-ratelimit-remaining-registration');
    };

    const first = await remaining('198.51.100.10', address('client-a'));
    const second = await remaining('198.51.100.11', address('client-b'));

    // The same number twice: each address spent the first of its own budget.
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  /*
   * The package's own acceptance criterion. Every call comes from a different
   * client address, so not one of the four caller-side counters can be what
   * refuses the last one — and the registration budget is in the hundreds here
   * anyway. What runs out is the inbox's.
   */
  it('counts one recipient across client addresses and refuses when its budget is gone', async () => {
    const recipient = address('one-inbox');
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await registerFrom(
        `198.51.100.${20 + attempt}`,
        recipient,
      );
      statuses.push(response.status);
    }

    // Accepted until the budget is spent, refused from then on — and refused
    // from an address that had never asked for anything before.
    expect(statuses).toContain(202);
    expect(statuses).toContain(429);
    expect(statuses.at(-1)).toBe(429);
    expect(statuses.indexOf(429)).toBe(statuses.lastIndexOf(202) + 1);
  });

  it('refuses the inbox, not the caller — the same client may still write elsewhere', async () => {
    // 198.51.100.27 is the address that was just refused above.
    const response = await registerFrom(
      '198.51.100.27',
      address('other-inbox'),
    );

    expect(response.status).toBe(202);
  });
});
