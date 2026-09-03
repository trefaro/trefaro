import { adminCookie } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  attachmentExists,
  closeDatabase,
  contactRequestsOf,
  conversationIdsForEvent,
  deleteConversations,
  deleteProfiles,
  deleteRegistrations,
  messageAttachmentId,
  seedProfile,
  seedRegistrations,
  seedSession,
} from '../support/database';
import {
  clearMailbox,
  countMailTo,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of AP 10: the organization's message overview (FR 3.4 — E39, F133).
 *
 * The acceptance criterion of the package, in the three parts it has:
 *
 * 1. **An answer to a guest lands in Mailpit and stands in the history.** Both,
 *    because F11 is only half kept by either one: the mail is how somebody
 *    with no account hears back, the line is how the next organizer sees that
 *    it was answered.
 * 2. **A group of three registrants comes into being**, from the confirmed
 *    registrations of one event — and only from those: an id that is not among
 *    them creates nothing at all, which is decided by the insert rather than
 *    by a check above it.
 * 3. **Its members see the conversation.** Asserted through the participants'
 *    own endpoint with a real session, which is what the participant client
 *    reads.
 *
 * Three more properties are decided here and nowhere else:
 *
 * - **What two participants write to each other is not the organization's to
 *   read** (F173). A `direct` conversation is absent from the list and answers
 *   404 by id — said the same way an unknown id is.
 * - **The overview does not hang on the `chat` switch, assembling a group
 *   does** (F175). FR 3.4 is P1; a switch that could turn off the
 *   organization's own inbox would say more than it means.
 * - **A deleted event takes the pictures of its conversations with it**
 *   (F158), in the order a `CHECK` dictates.
 */
interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  slug: string;
}

interface Conversation {
  id: string;
  type: string;
  topic: string | null;
  event: { id: string; name: string; slug: string; seriesSlug: string } | null;
  guest: { name: string | null; email: string } | null;
  memberCount: number;
  lastMessageAt: string | null;
  preview: {
    senderType: string;
    text: string | null;
    hasImage: boolean;
  } | null;
  members?: { profileId: string | null; name: string }[];
}

interface Page {
  rows: Conversation[];
  total: number;
  page: number;
  pageSize: number;
}

interface Reply {
  message: {
    id: string;
    senderType: string;
    senderId: string | null;
    body: string | null;
  };
  delivery: string;
}

interface Message {
  id: string;
  senderType: string;
  body: string | null;
  imageUrl: string | null;
}

interface MessageWindow {
  rows: Message[];
  hasMore: boolean;
}

interface Candidate {
  profileId: string;
  name: string;
  email: string;
}

const BASE_URL = `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}`;
const USER_SESSION_COOKIE = 'trefaro_user_session';

/** Unique per run, so a leftover row cannot answer an assertion. */
const stamp = Date.now();
const DOMAIN = `@overview-${stamp}.example.org`;
const ORGANIZER = `team-${stamp}@overview.example.org`;
const GUEST = `stranger${DOMAIN}`;

/** Real headers, so the server's signature check decides as in production. */
const png = (padding = 64): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding, 0x2a),
  ]);

const EVENT = {
  name: 'Overview Contract Event',
  description: 'The event these conversations are about.',
  eventType: 'onsite',
  startsAt: '2099-05-18T08:00:00.000Z',
  endsAt: '2099-05-18T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

describe('the organization’s conversations', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  /** Three confirmed registrants with accounts, and two who are not. */
  const people: Record<string, { id: string; session: string }> = {};
  let pendingId = '';
  let strangerId = '';
  /** Findable on purpose, so a `direct` conversation can exist to be hidden. */
  let visibleId = '';
  /** Conversations this suite created, removed again in the teardown. */
  const conversations: string[] = [];
  let request: Conversation;

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit =>
    asAdmin({
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

  const list = (query = '') =>
    api<Page>(`/api/admin/conversations${query}`, asAdmin());

  const one = (id: string) =>
    api<Conversation>(`/api/admin/conversations/${id}`, asAdmin());

  const history = (id: string) =>
    api<MessageWindow>(`/api/admin/conversations/${id}/messages`, asAdmin());

  const reply = (id: string, body: unknown) =>
    api<Reply>(
      `/api/admin/conversations/${id}/messages`,
      asAdminJson('POST', body),
    );

  const candidates = (eventId: string) =>
    api<Candidate[]>(
      `/api/admin/conversations/candidates?eventId=${eventId}`,
      asAdmin(),
    );

  const createGroup = (payload: unknown) =>
    api<Conversation>('/api/admin/conversations', asAdminJson('POST', payload));

  /**
   * Switches a module through the API rather than in the table.
   *
   * The flags are cached in the server (`ModuleFlagCache`), so a row changed
   * behind its back means nothing until the cache refreshes — a test that
   * wrote SQL here would be green for the wrong reason for a few seconds and
   * then red for the right one.
   */
  const setModule = (key: string, enabled: boolean) =>
    api(`/api/admin/modules/${key}`, asAdminJson('PATCH', { enabled }));

  const remember = (id: string) => {
    if (!conversations.includes(id)) conversations.push(id);
    return id;
  };

  beforeAll(async () => {
    await waitForMailpit();
    await clearMailbox();
    cookie = adminCookie();
    // Another suite may have left it off; the group routes need it on (F175),
    // and the switch is restored in this file's own teardown.
    await setModule('chat', true);

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Overview Contract Series ${stamp}`,
          description: 'Holds the event these conversations are about.',
          status: 'published',
          contactEmail: ORGANIZER,
        }),
      )
    ).body;

    event = (
      await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson('POST', EVENT),
      )
    ).body;

    // Three people who confirmed a place and have an account: the group of the
    // acceptance criterion. Plus two who must not be offered — somebody whose
    // registration is still pending, and somebody with an account who never
    // registered at all.
    for (const [key, name] of [
      ['amina', ['Amina', 'Okonkwo']],
      ['bo', ['Bo', 'Lindgren']],
      ['chen', ['Chen', 'Wei']],
    ] as const) {
      const email = `${key}${DOMAIN}`;
      const id = await seedProfile({
        email,
        firstName: name[0],
        lastName: name[1],
      });
      people[key] = { id, session: await seedSession(id) };
      await seedRegistrations(event.id, [
        { email, firstName: name[0], lastName: name[1], status: 'confirmed' },
      ]);
    }

    pendingId = await seedProfile({
      email: `dalia${DOMAIN}`,
      firstName: 'Dalia',
      lastName: 'Haddad',
    });
    await seedRegistrations(event.id, [
      {
        email: `dalia${DOMAIN}`,
        firstName: 'Dalia',
        lastName: 'Haddad',
        status: 'pending',
      },
    ]);

    strangerId = await seedProfile({
      email: `eze${DOMAIN}`,
      firstName: 'Eze',
      lastName: 'Nwosu',
    });

    // The one account of this suite that opts in to being found — and the only
    // reason it does is that opening a `direct` conversation asks for exactly
    // that (E37). Its own row rather than a flag on a group member, so nothing
    // this package tests makes somebody findable as a side effect.
    visibleId = await seedProfile({
      email: `visible${DOMAIN}`,
      firstName: 'Visible',
      lastName: 'Zamora',
      searchable: true,
    });

    // A question from somebody without an account, through the form itself:
    // this suite reads what AP 9 writes rather than a row of its own.
    await postJson(
      `/api/user/series/${series.slug}/events/${event.slug}/contact`,
      {
        name: 'Fatou Diallo',
        email: GUEST,
        body: 'is the venue accessible by wheelchair?\n\nThanks in advance.',
      },
    );
    const [stored] = await contactRequestsOf(GUEST);
    remember(stored.conversationId);
    request = { id: stored.conversationId } as Conversation;
  });

  afterAll(async () => {
    await deleteConversations(conversations);
    await deleteProfiles(DOMAIN);
    if (series?.id) {
      await deleteRegistrations(event.id);
      await api(
        `/api/admin/series/${series.id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
    await setModule('chat', true);
    await closeDatabase();
  });

  describe('the overview', () => {
    it('carries the question with its event and its preview', async () => {
      const response = await list();
      expect(response.status).toBe(200);

      const row = response.body.rows.find((one) => one.id === request.id);
      expect(row).toBeDefined();
      expect(row?.type).toBe('organizer_contact');
      expect(row?.guest).toEqual({ name: 'Fatou Diallo', email: GUEST });
      // The event, with both slugs, so the overview can link the page the
      // question was asked on (F112).
      expect(row?.event?.id).toBe(event.id);
      expect(row?.event?.slug).toBe(event.slug);
      expect(row?.event?.seriesSlug).toBe(series.slug);
      // The last line, cut by the server, and who wrote it — which is the
      // whole of "is this waiting for an answer" (F133).
      expect(row?.preview?.senderType).toBe('guest');
      expect(row?.preview?.text).toContain('accessible by wheelchair');
      expect(row?.preview?.hasImage).toBe(false);
      // Nobody is a member of a contact request: the organization is a side of
      // it by its kind.
      expect(row?.memberCount).toBe(0);
    });

    it('answers one of them by id, with the accounts in it', async () => {
      const response = await one(request.id);

      expect(response.status).toBe(200);
      expect(response.body.members).toEqual([]);
    });

    it('refuses an unknown id and a malformed one', async () => {
      expect((await one('11111111-1111-4111-8111-111111111111')).status).toBe(
        404,
      );
      expect((await one('not-a-uuid')).status).toBe(400);
    });

    it('needs a session at all', async () => {
      expect((await api('/api/admin/conversations')).status).toBe(401);
    });
  });

  describe('answering somebody without an account (F11, F174)', () => {
    it('sends the answer and keeps it in the history', async () => {
      const answer = 'yes, the whole ground floor is level.\n\nSee you there.';

      const response = await reply(request.id, { body: answer });
      expect(response.status).toBe(201);
      expect(response.body.delivery).toBe('sent');
      // Written as the organizer who wrote it (E39): `sender_type` alone would
      // only say "somebody here".
      expect(response.body.message.senderType).toBe('admin');
      expect(response.body.message.senderId).not.toBeNull();

      // In Mailpit, at the address the guest typed — the half of F11 that
      // leaves the application.
      const mail = await waitForMailTo(GUEST);
      expect(mail.subject).toContain(EVENT.name);
      expect(mail.text).toContain('Fatou Diallo');
      expect(mail.text).toContain('the whole ground floor is level');

      // And in the conversation — the half that stays.
      const window = await history(request.id);
      expect(window.body.rows[0].senderType).toBe('admin');
      expect(window.body.rows[0].body).toBe(answer);
      // Newest first, so the guest's own question is behind it.
      expect(window.body.rows[1].senderType).toBe('guest');
    });

    it('now says the organization answered last (F133)', async () => {
      const row = (await list()).body.rows.find((one) => one.id === request.id);

      expect(row?.preview?.senderType).toBe('admin');
    });

    it('refuses an empty answer and writes nothing', async () => {
      const before = (await history(request.id)).body.rows.length;

      expect((await reply(request.id, { body: '   ' })).status).toBe(400);
      expect((await reply(request.id, {})).status).toBe(400);

      expect((await history(request.id)).body.rows).toHaveLength(before);
    });
  });

  describe('assembling a group (E39)', () => {
    let group: Conversation;

    it('offers the confirmed registrants who have an account', async () => {
      const response = await candidates(event.id);

      expect(response.status).toBe(200);
      const addresses = response.body.map((person) => person.email);
      expect(addresses).toEqual([
        `bo${DOMAIN}`,
        `amina${DOMAIN}`,
        `chen${DOMAIN}`,
      ]);
      // Not somebody whose registration is still pending, and not somebody who
      // never registered: a group holds the people the event confirmed.
      expect(response.body.map((person) => person.profileId)).not.toContain(
        pendingId,
      );
      expect(response.body.map((person) => person.profileId)).not.toContain(
        strangerId,
      );
      expect(response.body[0].name).toBe('Bo Lindgren');
    });

    it('answers 404 for the candidates of an unknown event', async () => {
      expect(
        (await candidates('11111111-1111-4111-8111-111111111111')).status,
      ).toBe(404);
    });

    it('creates a group of three, empty and named', async () => {
      const response = await createGroup({
        eventId: event.id,
        topic: 'Travel to Köln',
        profileIds: [people.amina.id, people.bo.id, people.chen.id],
      });

      expect(response.status).toBe(201);
      group = response.body;
      remember(group.id);

      expect(group.type).toBe('group');
      expect(group.topic).toBe('Travel to Köln');
      expect(group.memberCount).toBe(3);
      expect(group.members?.map((member) => member.name)).toEqual([
        'Bo Lindgren',
        'Amina Okonkwo',
        'Chen Wei',
      ]);
      // Nobody has written in it, so it is not waiting for an answer and has
      // no preview: a group is created empty and the first line follows.
      expect(group.preview).toBeNull();
      expect(group.lastMessageAt).toBeNull();
    });

    it('is seen by its members in their own list', async () => {
      // The acceptance criterion's third part, through the endpoint the
      // participant client reads.
      for (const key of ['amina', 'bo', 'chen'] as const) {
        const response = await api<{ rows: { id: string; topic: string }[] }>(
          '/api/participant/conversations',
          {
            headers: {
              cookie: `${USER_SESSION_COOKIE}=${people[key].session}`,
            },
          },
        );

        expect(response.status).toBe(200);
        const row = response.body.rows.find((one) => one.id === group.id);
        expect(row?.topic).toBe('Travel to Köln');
      }
    });

    it('is not seen by somebody who was not put into it', async () => {
      const outsider = await seedProfile({
        email: `outsider${DOMAIN}`,
        firstName: 'Outsider',
        lastName: 'Nobody',
      });
      const session = await seedSession(outsider);

      const response = await api<{ rows: { id: string }[] }>(
        '/api/participant/conversations',
        { headers: { cookie: `${USER_SESSION_COOKIE}=${session}` } },
      );

      expect(response.body.rows.map((row) => row.id)).not.toContain(group.id);
    });

    it('answers a group without mail, because its members read it in the app', async () => {
      const before = await countMailTo(GUEST);

      const response = await reply(group.id, {
        body: 'The bus leaves at eight.',
      });

      expect(response.status).toBe(201);
      expect(response.body.delivery).toBe('none');
      expect(await countMailTo(GUEST)).toBe(before);
    });

    it('creates nothing when somebody picked has no confirmed place', async () => {
      const before = (await list('?pageSize=50')).body.total;

      const response = await createGroup({
        eventId: event.id,
        topic: 'Should not exist',
        profileIds: [people.amina.id, pendingId],
      });

      expect(response.status).toBe(400);
      // Not a group short of the people it was assembled for: nothing at all.
      expect((await list('?pageSize=50')).body.total).toBe(before);
    });

    it('refuses a group without a subject, without members, or for no event', async () => {
      expect(
        (
          await createGroup({
            eventId: event.id,
            topic: '   ',
            profileIds: [people.amina.id],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await createGroup({
            eventId: event.id,
            topic: 'Nobody',
            profileIds: [],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await createGroup({
            eventId: '11111111-1111-4111-8111-111111111111',
            topic: 'Elsewhere',
            profileIds: [people.amina.id],
          })
        ).status,
      ).toBe(404);
    });
  });

  describe('what participants write to each other (F173)', () => {
    let direct = '';

    beforeAll(async () => {
      const opened = await api<{ id: string }>(
        '/api/participant/conversations',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${USER_SESSION_COOKIE}=${people.bo.session}`,
          },
          body: JSON.stringify({ profileId: visibleId }),
        },
      );
      direct = remember(opened.body.id);
    });

    it('is absent from the organization’s list', async () => {
      const rows = (await list('?pageSize=50')).body.rows;

      expect(rows.map((row) => row.id)).not.toContain(direct);
      expect(rows.every((row) => row.type !== 'direct')).toBe(true);
    });

    it('answers 404 by id, the way an unknown id does', async () => {
      expect((await one(direct)).status).toBe(404);
      expect((await history(direct)).status).toBe(404);
      expect((await reply(direct, { body: 'Hello?' })).status).toBe(404);
    });
  });

  describe('the pictures of a conversation', () => {
    let messageId = '';
    let attachmentId = '';
    let groupId = '';

    beforeAll(async () => {
      const group = await createGroup({
        eventId: event.id,
        topic: 'Photos from the venue',
        profileIds: [people.amina.id],
      });
      groupId = remember(group.body.id);

      const form = new FormData();
      form.set(
        'image',
        new Blob([new Uint8Array(png())], { type: 'image/png' }),
      );
      const sent = await api<Message>(
        `/api/participant/conversations/${groupId}/messages`,
        {
          method: 'POST',
          headers: { cookie: `${USER_SESSION_COOKIE}=${people.amina.session}` },
          body: form,
        },
      );
      messageId = sent.body.id;
      attachmentId = (await messageAttachmentId(messageId)) ?? '';
    });

    it('serves them to the organizer through their own route (F133)', async () => {
      const response = await fetch(
        `${BASE_URL}/api/admin/conversations/${groupId}/messages/${messageId}/image`,
        { headers: { cookie } },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('image/png');
      // Not by the URL in the message: that one is served to members of a
      // conversation, and the organization is not one (F156).
      expect(response.headers.get('cache-control')).toContain('private');
    });

    it('refuses a picture through a conversation it is not in', async () => {
      const response = await fetch(
        `${BASE_URL}/api/admin/conversations/${request.id}/messages/${messageId}/image`,
        { headers: { cookie } },
      );

      expect(response.status).toBe(404);
    });

    it('refuses them without a session', async () => {
      const response = await fetch(
        `${BASE_URL}/api/admin/conversations/${groupId}/messages/${messageId}/image`,
      );

      expect(response.status).toBe(401);
    });

    it('go with the event that carried them (F158)', async () => {
      // An event with confirmed registrations cannot be deleted (E14), so this
      // is the state the leak is actually reachable in: the registrations were
      // cancelled again, and the group they produced is still there.
      const doomed = (
        await api<Event>(
          `/api/admin/series/${series.id}/events`,
          asAdminJson('POST', { ...EVENT, name: 'Overview Doomed Event' }),
        )
      ).body;
      await seedRegistrations(doomed.id, [
        {
          email: `amina${DOMAIN}`,
          firstName: 'Amina',
          lastName: 'Okonkwo',
          status: 'confirmed',
        },
      ]);
      const doomedGroup = (
        await createGroup({
          eventId: doomed.id,
          topic: 'Doomed group',
          profileIds: [people.amina.id],
        })
      ).body;

      const form = new FormData();
      form.set(
        'image',
        new Blob([new Uint8Array(png(96))], { type: 'image/png' }),
      );
      const sent = await api<Message>(
        `/api/participant/conversations/${doomedGroup.id}/messages`,
        {
          method: 'POST',
          headers: { cookie: `${USER_SESSION_COOKIE}=${people.amina.session}` },
          body: form,
        },
      );
      const doomedAttachment = (await messageAttachmentId(sent.body.id)) ?? '';
      expect(doomedAttachment).not.toBe('');

      await deleteRegistrations(doomed.id);
      const deleted = await api(
        `/api/admin/events/${doomed.id}`,
        asAdmin({ method: 'DELETE' }),
      );
      expect(deleted.status).toBe(204);

      // The conversation is gone with its event, and the `attachment` row with
      // it — which only holds because the conversation was deleted **first**:
      // the reverse order fails on `CHK_message_content`.
      expect(await conversationIdsForEvent(doomed.id)).toEqual([]);
      expect(await attachmentExists(doomedAttachment)).toBe(false);
    });

    it('leaves the picture of a living conversation alone', async () => {
      expect(await attachmentExists(attachmentId)).toBe(true);
    });
  });

  describe('the module switch (F175)', () => {
    beforeAll(async () => {
      await setModule('chat', false);
    });

    afterAll(async () => {
      await setModule('chat', true);
    });

    it('keeps the overview answering, because FR 3.4 is P1', async () => {
      // The whole argument in two requests: an instance that runs no chat at
      // all still has an inbox, or the contact form of AP 9 delivers nowhere.
      const rows = (await list('?pageSize=50')).body.rows;
      expect(rows.some((row) => row.id === request.id)).toBe(true);
      expect((await one(request.id)).status).toBe(200);
      expect((await history(request.id)).status).toBe(200);
      expect(
        (await reply(request.id, { body: 'Still answering.' })).status,
      ).toBe(201);
    });

    it('refuses to assemble a group, whose readers would have no endpoints', async () => {
      expect(
        (
          await createGroup({
            eventId: event.id,
            topic: 'While the chat is off',
            profileIds: [people.amina.id],
          })
        ).status,
      ).toBe(404);
      expect((await candidates(event.id)).status).toBe(404);
    });

    it('and the participants cannot read theirs either — the counter-check', async () => {
      const response = await api('/api/participant/conversations', {
        headers: { cookie: `${USER_SESSION_COOKIE}=${people.amina.session}` },
      });

      // With a session, so this is the module's 404 and not the guard's 401.
      expect(response.status).toBe(404);
    });
  });
});
