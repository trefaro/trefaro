import type { CheckinTicketPage } from '@trefaro/shared-models';
import { QrCheckinApi } from './qr-checkin-api';
import { CODE, ticket } from './testing';

/**
 * The one route of this plug-in that takes more than one request.
 *
 * The session route is **plural** (F148: a person is not a registration) and
 * the self-service page is about one registration, so `ticketOf` walks the
 * pages until it finds it. A walk needs a reason to stop — and a wrong one is a
 * loop against somebody's own server, which no component test would ever show.
 */
describe('QrCheckinApi.ticketOf', () => {
  const realFetch = globalThis.fetch;
  let asked: string[];

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** Answers each call with the next page the test laid out. */
  function answering(pages: readonly CheckinTicketPage[]): void {
    asked = [];
    let call = 0;
    globalThis.fetch = (async (url: string) => {
      asked.push(url);
      const page = pages[call++];
      return new Response(JSON.stringify(page ?? { rows: [], total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  }

  const page = (
    rows: readonly unknown[],
    total: number,
    number = 1,
  ): CheckinTicketPage =>
    ({
      rows,
      total,
      page: number,
      pageSize: 50,
    }) as CheckinTicketPage;

  it('stops at the first page when the registration is on it', async () => {
    answering([page([ticket()], 1)]);

    const found = await new QrCheckinApi().ticketOf('registration-1');

    expect(found?.code).toBe(CODE);
    expect(asked).toHaveLength(1);
    // The largest page the server allows: one request for everybody who is not
    // a regular of a weekly series.
    expect(asked[0]).toContain('pageSize=50');
    expect(asked[0]).toContain('/api/participant/plugins/qr-checkin/tickets');
  });

  it('walks on until it finds it', async () => {
    answering([
      page([ticket({ registrationId: 'other' })], 2),
      page([ticket({ registrationId: 'wanted' })], 2, 2),
    ]);

    const found = await new QrCheckinApi().ticketOf('wanted');

    expect(found?.registrationId).toBe('wanted');
    expect(asked).toHaveLength(2);
    expect(asked[1]).toContain('page=2');
  });

  it('gives up once it has read what the server said there was', async () => {
    answering([page([ticket({ registrationId: 'other' })], 1)]);

    expect(await new QrCheckinApi().ticketOf('missing')).toBeNull();
    expect(asked).toHaveLength(1);
  });

  it('gives up on a page that came back empty, whatever the total claims', async () => {
    // An answer that promises two hundred and hands over nothing must not turn
    // into a loop against somebody's own server.
    answering([page([], 200)]);

    expect(await new QrCheckinApi().ticketOf('missing')).toBeNull();
    expect(asked).toHaveLength(1);
  });
});
