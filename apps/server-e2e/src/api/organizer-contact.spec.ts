import { adminCookie } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  contactRequestsOf,
  deleteConversations,
  deleteProfiles,
  seedProfile,
  seedSession,
} from '../support/database';
import {
  clearMailbox,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of AP 9: reaching the organizer without an account
 * (FR 3.4, UC 14 — E10, E39, F11).
 *
 * The acceptance criterion of the package, in the three parts it has:
 *
 * 1. **An interested person without an account reaches the organizer.** The
 *    request is stored as an `organizer_contact` conversation whose first line
 *    was written by a `guest`, and the organization learns about it by mail —
 *    without watching a screen.
 * 2. **The conversation is in the shape the overview will read.** That screen
 *    is AP 10, so what can be asserted today is the row: the kind, the event,
 *    the address on the conversation rather than on an invented account, and
 *    **no membership** — the organization is a side of this conversation by
 *    virtue of its kind, not by a row naming whoever was logged in.
 * 3. **The form answers the same for a known and an unknown address** (E10),
 *    including when the mail server cannot be reached — which is asserted the
 *    only way it can be from outside: by taking the notification's recipient
 *    away and seeing the answer stay identical.
 *
 * One more property is decided here and belongs to no other suite: the contact
 * form is **not** behind the `chat` module switch. FR 3.4 is P1, the chat is an
 * optional P2 module, and an instance that runs no participant accounts must
 * still be reachable.
 */
interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  slug: string;
}

/** Unique per run, so a leftover row cannot make the next run fail elsewhere. */
const stamp = Date.now();
const DOMAIN = `@contact-${stamp}.example.org`;
const ORGANIZER = `team-${stamp}@organizer.example.org`;
const USER_SESSION_COOKIE = 'trefaro_user_session';

const FUTURE_EVENT = {
  name: 'Contact Contract Event',
  description: 'The event this suite asks about.',
  eventType: 'onsite',
  startsAt: '2099-04-18T08:00:00.000Z',
  endsAt: '2099-04-18T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

const QUESTION = {
  name: 'Amina Okonkwo',
  body: 'is the venue accessible by wheelchair?\n\nThanks in advance.',
} as const;

describe('contacting the organizer without an account', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  let pastEvent: Event;
  let draftEvent: Event;
  /** Conversations this suite created, removed again in the teardown. */
  const conversations: string[] = [];

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const contact = (
    email: string,
    overrides: Record<string, unknown> = {},
    slugs: { series: string; event: string } = {
      series: series.slug,
      event: event.slug,
    },
  ) =>
    postJson<{ email: string }>(
      `/api/user/series/${slugs.series}/events/${slugs.event}/contact`,
      { ...QUESTION, email, ...overrides },
    );

  const setModule = (key: string, enabled: boolean) =>
    api(`/api/admin/modules/${key}`, asAdminJson('PATCH', { enabled }));

  /** Remembers what to clean up, and returns what was stored. */
  const stored = async (email: string) => {
    const rows = await contactRequestsOf(email);
    for (const row of rows) {
      if (!conversations.includes(row.conversationId)) {
        conversations.push(row.conversationId);
      }
    }
    return rows;
  };

  beforeAll(async () => {
    await waitForMailpit();
    await clearMailbox();

    cookie = adminCookie();

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Contact Contract Series ${stamp}`,
          description: 'Holds the event this suite asks about.',
          status: 'published',
          // Where a question about this series lands: the address the series
          // page already shows to the public.
          contactEmail: ORGANIZER,
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
      name: 'Contact Contract Past Event',
      startsAt: '2020-02-01T09:00:00.000Z',
      endsAt: '2020-02-01T17:00:00.000Z',
    });
    draftEvent = await createEvent({
      ...FUTURE_EVENT,
      name: 'Contact Contract Draft Event',
      status: 'draft',
    });
  });

  afterAll(async () => {
    await deleteConversations(conversations);
    await deleteProfiles(DOMAIN);
    if (series?.id) {
      await api(`/api/admin/series/${series.id}`, {
        method: 'DELETE',
        headers: { cookie },
      });
    }
    await closeDatabase();
  });

  it('stores the question and tells the organization', async () => {
    const email = `stranger${DOMAIN}`;

    const response = await contact(email);
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ email });

    const rows = await stored(email);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.type).toBe('organizer_contact');
    expect(row.eventId).toBe(event.id);
    // No subject of its own: what the request is about is the event, and a
    // second field holding its name would be the same fact stored twice.
    expect(row.topic).toBeNull();
    expect(row.guestEmail).toBe(email);
    expect(row.guestName).toBe(QUESTION.name);
    // The one sender with no id (E39): a guest is identified by the address on
    // the conversation, not by a row pretending to be an account.
    expect(row.senderType).toBe('guest');
    expect(row.senderId).toBeNull();
    expect(row.body).toBe(QUESTION.body);
    // The sort order of the overview, set with the line that justifies it.
    expect(row.lastMessageAt).not.toBeNull();
    // Nobody is a member: the organization is a side of this conversation by
    // its kind, and an `admin` membership would name whichever person happened
    // to be logged in when a stranger wrote — which is nobody.
    expect(row.members).toBe(0);

    const mail = await waitForMailTo(ORGANIZER);
    expect(mail.subject).toContain(FUTURE_EVENT.name);
    expect(mail.text).toContain(QUESTION.name);
    // The address the answer goes to (F11) — the whole reason this mail exists.
    expect(mail.text).toContain(email);
    expect(mail.text).toContain('is the venue accessible by wheelchair?');
  });

  it('answers a known address exactly as an unknown one (E10)', async () => {
    // An address that has an account, which is the difference a public form
    // must not be able to reveal.
    const known = `member${DOMAIN}`;
    await seedProfile({
      email: known,
      firstName: 'Amina',
      lastName: 'Okonkwo',
    });

    const first = await contact(known);
    const second = await contact(`nobody${DOMAIN}`);

    expect(first.status).toBe(second.status);
    expect(Object.keys(first.body)).toEqual(Object.keys(second.body));
    await stored(known);
    await stored(`nobody${DOMAIN}`);
  });

  it('answers the same when the notification has nowhere to go', async () => {
    // The series' contact address taken away: the notification then goes to
    // the instance's own sender, and whether that mailbox exists is not
    // something this endpoint may reveal either. What matters is that the
    // question is stored and the answer does not change.
    await api(
      `/api/admin/series/${series.id}`,
      asAdminJson('PATCH', { contactEmail: null }),
    );
    const email = `no-mailbox${DOMAIN}`;

    const response = await contact(email);

    expect(response.status).toBe(202);
    expect(await stored(email)).toHaveLength(1);

    await api(
      `/api/admin/series/${series.id}`,
      asAdminJson('PATCH', { contactEmail: ORGANIZER }),
    );
  });

  it('can still be reached about an event that is over', async () => {
    // Deliberately unlike the registration, which answers 409 for a past event
    // (E10's neighbour): "where is the recording" is a question about an event
    // that has happened.
    const email = `late${DOMAIN}`;

    const response = await contact(
      email,
      {},
      { series: series.slug, event: pastEvent.slug },
    );

    expect(response.status).toBe(202);
    const rows = await stored(email);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventId).toBe(pastEvent.id);
  });

  it('has nothing to write to for a draft event', async () => {
    const email = `draft${DOMAIN}`;

    const response = await contact(
      email,
      {},
      { series: series.slug, event: draftEvent.slug },
    );

    expect(response.status).toBe(404);
    expect(await stored(email)).toEqual([]);
  });

  it('refuses a message that is not one', async () => {
    const empty = await contact(`empty${DOMAIN}`, { body: '   \n ' });
    const nameless = await contact(`nameless${DOMAIN}`, { name: ' ' });
    const misaddressed = await contact('not-an-address', {});

    expect(empty.status).toBe(400);
    expect(nameless.status).toBe(400);
    expect(misaddressed.status).toBe(400);
    expect(await stored(`empty${DOMAIN}`)).toEqual([]);
    expect(await stored(`nameless${DOMAIN}`)).toEqual([]);
  });

  it('takes words and nothing else', async () => {
    // No picture, unlike every other message of the chat (E40): a public
    // endpoint accepting bytes from somebody with no account behind them would
    // be a second upload surface. An unknown property is refused rather than
    // dropped, which is what makes that visible from outside.
    const response = await contact(`extra${DOMAIN}`, {
      image: 'data:image/png;base64,AAAA',
    });

    expect(response.status).toBe(400);
    expect(await stored(`extra${DOMAIN}`)).toEqual([]);
  });

  it('works while the chat module is switched off', async () => {
    // FR 3.4 is P1 and the chat is an optional P2 module that requires
    // `profiles` (E42) — so an organization that runs no participant accounts
    // would otherwise be unreachable. The switch decides whether the people in
    // an instance may write to each other.
    const off = await setModule('chat', false);
    expect(off.status).toBe(200);

    try {
      const email = `chat-off${DOMAIN}`;
      const response = await contact(email);

      expect(response.status).toBe(202);
      expect(await stored(email)).toHaveLength(1);

      // And the participant side really is gone meanwhile, so this is not a
      // test of a switch that does nothing (F53). Asked **with** a session,
      // because the participant guard is global and runs before a controller
      // guard: without a cookie the answer would be 401 either way and would
      // prove nothing (E33).
      const id = await seedProfile({
        email: `switch${DOMAIN}`,
        firstName: 'Sena',
        lastName: 'Yilmaz',
      });
      const session = `${USER_SESSION_COOKIE}=${await seedSession(id)}`;
      const mine = await api('/api/participant/conversations', {
        headers: { cookie: session },
      });
      expect(mine.status).toBe(404);
    } finally {
      const on = await setModule('chat', true);
      expect(on.status).toBe(200);
    }
  });
});
