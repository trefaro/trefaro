import { adminCookie, cookieFrom } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  deleteConversations,
  deleteProfiles,
  messageAttachmentId,
  seedProfile,
} from '../support/database';
import {
  accountConfirmationTokenFrom,
  clearMailbox,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of AP 6: conversations, messages and the pictures in them
 * (FR 4.5 — E37, E38, E39, E40).
 *
 * The acceptance criterion of the package is decided here, all five parts of
 * it:
 *
 * 1. **Two accounts can hold a conversation** — opened once, found the second
 *    time, and readable and answerable from both sides.
 * 2. **A conversation with a profile that is not findable is a 403**, said the
 *    same way for an unknown id: whoever can tell those apart can enumerate
 *    the accounts of an instance (F124).
 * 3. **A non-member gets neither the history nor the picture.** The picture is
 *    the reason this package has the one media route of this application that
 *    checks a permission (E40), and the reason the organizer's attachment
 *    download now answers 404 for a chat picture.
 * 4. **A message without text and without a picture is refused** (E40).
 * 5. **The unread counter is computed from `last_read_at`, not stored** (E38)
 *    — which is asserted the only way it can be from outside: it moves when
 *    somebody writes, it does not count one's own lines, and it goes to zero
 *    when the conversation is marked as read.
 *
 * **Two logins, three people.** The login budget is 20 attempts per five
 * minutes for the whole instance (E4) and the account suites already use
 * fourteen, so the third person is seeded: she is opted in and never logs in,
 * which is all a non-member test needs on the other side.
 */
interface Counterpart {
  profileId: string | null;
  name: string;
  avatarUrl: string | null;
}

interface Conversation {
  id: string;
  type: string;
  topic: string | null;
  counterparts: Counterpart[];
  lastMessageAt: string | null;
  unread: number;
}

interface ConversationPage {
  rows: Conversation[];
  total: number;
  page: number;
  pageSize: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string | null;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
}

interface MessageWindow {
  rows: Message[];
  hasMore: boolean;
}

interface SessionInfo {
  participant: { id: string; email: string };
}

interface Module {
  key: string;
  enabled: boolean;
}

/**
 * The wording of a refusal, and never the whole body.
 *
 * Two answers that have to be indistinguishable are compared on `message`
 * alone: an error body carries a timestamp, and the millisecond between two
 * requests would make the test red without saying anything.
 */
const said = (response: { body: unknown }): string =>
  (response.body as { message?: string }).message ?? '';

const USER_SESSION_COOKIE = 'trefaro_user_session';
const PASSWORD = 'a-long-enough-passphrase';
const BASE_URL = `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}`;

/** Unique per run: a leftover row must not be able to answer an assertion. */
const stamp = Date.now();
const DOMAIN = '@chat.example.org';

/** Real headers, so the server's signature check decides as in production. */
const png = (padding = 64): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding, 0x2a),
  ]);

/** A zip archive's local file header, announced as a PNG (F38). */
const zip = (): Buffer =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);

describe('conversations and messages', () => {
  /** Amina — writes first. */
  let amina = '';
  let aminaId = '';
  /** Bo — answers, and is a stranger to the conversation Amina has with Chen. */
  let bo = '';
  let boId = '';
  /** Chen — seeded, opted in, never logs in. */
  let chenId = '';
  /** Dalia — seeded and **not** opted in. */
  let hiddenId = '';
  let admin = '';

  /** Amina and Bo, and Amina and Chen. */
  let withBo = '';
  let withChen = '';

  const start = (session: string, profileId: string) =>
    api<Conversation>('/api/participant/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: session },
      body: JSON.stringify({ profileId }),
    });

  const conversations = (session: string, query = '') =>
    api<ConversationPage>(`/api/participant/conversations${query}`, {
      headers: { cookie: session },
    });

  const one = (session: string, id: string) =>
    api<Conversation>(`/api/participant/conversations/${id}`, {
      headers: { cookie: session },
    });

  const history = (session: string, id: string, query = '') =>
    api<MessageWindow>(
      `/api/participant/conversations/${id}/messages${query}`,
      { headers: { cookie: session } },
    );

  const say = (session: string, id: string, body: unknown) =>
    api<Message>(`/api/participant/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: session },
      body: JSON.stringify(body),
    });

  const sayWithImage = (
    session: string,
    id: string,
    bytes: Buffer,
    mimeType: string,
    text?: string,
  ) => {
    const form = new FormData();
    if (text !== undefined) form.set('body', text);
    form.set('image', new Blob([new Uint8Array(bytes)], { type: mimeType }));
    return api<Message>(`/api/participant/conversations/${id}/messages`, {
      method: 'POST',
      headers: { cookie: session },
      body: form,
    });
  };

  const markRead = (session: string, id: string) =>
    api(`/api/participant/conversations/${id}/read`, {
      method: 'PUT',
      headers: { cookie: session },
    });

  const fetchImage = async (url: string, session?: string) => {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: session ? { cookie: session } : {},
    });
    return {
      status: response.status,
      headers: response.headers,
      bytes: Buffer.from(await response.arrayBuffer()),
    };
  };

  const setModule = (key: string, enabled: boolean) =>
    api<Module>(`/api/admin/modules/${key}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: admin },
      body: JSON.stringify({ enabled }),
    });

  /** Registers, confirms and logs in — the only way to hold a session (E32). */
  async function account(
    handle: string,
    firstName: string,
    lastName: string,
  ): Promise<{ cookie: string; id: string }> {
    const email = `${handle}-${stamp}${DOMAIN}`;
    await clearMailbox();
    await postJson('/api/user/profiles', {
      email,
      password: PASSWORD,
      firstName,
      lastName,
    });
    await postJson('/api/user/profiles/confirm', {
      token: accountConfirmationTokenFrom(await waitForMailTo(email)),
    });
    const login = await postJson<SessionInfo>('/api/participant/auth/login', {
      email,
      password: PASSWORD,
    });
    const session = cookieFrom(login.headers, USER_SESSION_COOKIE);

    // Both real accounts opt in, because being written to is the same switch
    // as being found (E37, F13).
    await api('/api/participant/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: session },
      body: JSON.stringify({ searchable: true }),
    });

    return { cookie: session, id: login.body.participant.id };
  }

  beforeAll(async () => {
    await waitForMailpit();
    admin = await adminCookie();

    const first = await account('amina', 'Amina', 'Okonkwo');
    amina = first.cookie;
    aminaId = first.id;

    const second = await account('bo', 'Bo', 'Adeyemi');
    bo = second.cookie;
    boId = second.id;

    // Findable, and never logs in: the login budget is shared across suites
    // (E4), and a fixture that is only ever written **to** needs no session.
    chenId = await seedProfile({
      email: `chen-${stamp}${DOMAIN}`,
      firstName: 'Chen',
      lastName: 'Balogun',
      searchable: true,
    });
    // The one that must not be reachable at all.
    hiddenId = await seedProfile({
      email: `dalia-${stamp}${DOMAIN}`,
      firstName: 'Dalia',
      lastName: 'Nkemelu',
      searchable: false,
    });

    withBo = (await start(amina, boId)).body.id;
    withChen = (await start(amina, chenId)).body.id;
  });

  afterAll(async () => {
    // Both are instance-wide and neither cascades from the other: the address
    // is unique (E31), and a membership carries no foreign key on the account
    // it names (E39) — so the conversations have to be named explicitly.
    await deleteConversations([withBo, withChen]);
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  describe('opening one (E37)', () => {
    it('needs a session', async () => {
      const anonymous = await api('/api/participant/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: boId }),
      });

      expect(anonymous.status).toBe(401);
    });

    it('answers with the conversation and names the other side', async () => {
      const opened = await start(amina, boId);

      expect(opened.status).toBe(200);
      expect(opened.body.type).toBe('direct');
      expect(opened.body.topic).toBeNull();
      expect(opened.body.counterparts).toHaveLength(1);
      expect(opened.body.counterparts[0]).toMatchObject({
        profileId: boId,
        name: 'Bo Adeyemi',
      });
    });

    it('gives the same two people the same conversation twice', async () => {
      const again = await start(amina, boId);
      // And from the other side, which is the half a `direct_key` built from
      // one order would get wrong.
      const fromBo = await start(bo, aminaId);

      expect(again.body.id).toBe(withBo);
      expect(fromBo.body.id).toBe(withBo);
    });

    it('refuses a profile that is not findable, and an unknown id the same way', async () => {
      const hidden = await start(amina, hiddenId);
      const unknown = await start(
        amina,
        '00000000-0000-4000-8000-000000000000',
      );

      expect(hidden.status).toBe(403);
      expect(unknown.status).toBe(403);
      expect(said(hidden)).toBe(said(unknown));
    });

    it('refuses one’s own id with a 400 rather than the 403', async () => {
      const self = await start(amina, aminaId);

      // Nothing to hide: the asker knows their own id, and a client sending it
      // has a bug that deserves to be named.
      expect(self.status).toBe(400);
    });

    it('refuses an id that is not a uuid', async () => {
      const nonsense = await start(amina, 'not-a-uuid');

      expect(nonsense.status).toBe(400);
    });
  });

  describe('reading one (AP 8)', () => {
    it('answers with the row the overview draws, for one id', async () => {
      const row = await one(amina, withBo);

      expect(row.status).toBe(200);
      expect(row.body).toMatchObject({ id: withBo, type: 'direct' });
      // Who it is with, because that is what a thread screen has to say — and
      // no address, for the reason the search carries none (F55, F150).
      expect(row.body.counterparts).toHaveLength(1);
      expect(row.body.counterparts[0]).not.toHaveProperty('email');
    });

    it('says the same thing for somebody else’s conversation as for an unknown id', async () => {
      const outsider = await one(bo, withChen);
      const unknown = await one(bo, '00000000-0000-4000-8000-000000000000');

      expect(outsider.status).toBe(404);
      expect(said(outsider)).toBe(said(unknown));
    });

    it('refuses an id that is not a uuid', async () => {
      expect((await one(amina, 'not-a-uuid')).status).toBe(400);
    });

    it('needs a session', async () => {
      expect(
        (await api(`/api/participant/conversations/${withBo}`)).status,
      ).toBe(401);
    });
  });

  describe('saying something (E40)', () => {
    it('refuses a message with neither text nor picture', async () => {
      const empty = await say(amina, withBo, {});
      const blank = await say(amina, withBo, { body: '   ' });

      expect(empty.status).toBe(400);
      expect(blank.status).toBe(400);
    });

    it('refuses an unknown property in the body', async () => {
      const extra = await say(amina, withBo, { body: 'Hi', shout: true });

      expect(extra.status).toBe(400);
    });

    it('accepts text as JSON and hands back the line', async () => {
      const said = await say(amina, withBo, { body: '  Good to meet you  ' });

      expect(said.status).toBe(201);
      expect(said.body).toMatchObject({
        conversationId: withBo,
        senderType: 'user',
        senderId: aminaId,
        body: 'Good to meet you',
        imageUrl: null,
      });
    });

    it('accepts a picture with text, in one multipart request', async () => {
      const sent = await sayWithImage(
        amina,
        withBo,
        png(),
        'image/png',
        'Here we all are',
      );

      expect(sent.status).toBe(201);
      expect(sent.body.body).toBe('Here we all are');
      expect(sent.body.imageUrl).toBe(
        `/api/media/messages/${sent.body.id}/attachment`,
      );
    });

    it('accepts a picture alone', async () => {
      const sent = await sayWithImage(amina, withBo, png(96), 'image/png');

      expect(sent.status).toBe(201);
      expect(sent.body.body).toBeNull();
      expect(sent.body.imageUrl).not.toBeNull();
    });

    it('refuses an archive announced as a PNG (F38)', async () => {
      const refused = await sayWithImage(amina, withBo, zip(), 'image/png');

      expect(refused.status).toBe(400);
    });

    it('refuses a type this instance does not serve', async () => {
      const refused = await sayWithImage(
        amina,
        withBo,
        Buffer.from('%PDF-1.7\n'),
        'application/pdf',
      );

      expect(refused.status).toBe(400);
    });

    it('refuses a body past the maximum', async () => {
      const long = await say(amina, withBo, { body: 'x'.repeat(4001) });

      expect(long.status).toBe(400);
    });
  });

  describe('the history', () => {
    it('reads newest first, from both sides', async () => {
      const answered = await say(bo, withBo, { body: 'Likewise!' });
      expect(answered.status).toBe(201);

      const mine = await history(amina, withBo);
      const theirs = await history(bo, withBo);

      expect(mine.status).toBe(200);
      expect(mine.body.rows[0].body).toBe('Likewise!');
      expect(mine.body.rows[0].senderId).toBe(boId);
      expect(mine.body.rows.map((row) => row.id)).toEqual(
        theirs.body.rows.map((row) => row.id),
      );
    });

    it('pages backwards with a cursor and reports what is behind it', async () => {
      const first = await history(amina, withBo, '?pageSize=2');

      expect(first.body.rows).toHaveLength(2);
      expect(first.body.hasMore).toBe(true);

      const older = await history(
        amina,
        withBo,
        `?pageSize=2&before=${first.body.rows[1].id}`,
      );

      // Strictly older: no line appears in both windows.
      const seen = new Set(first.body.rows.map((row) => row.id));
      expect(older.body.rows.some((row) => seen.has(row.id))).toBe(false);
      expect(
        new Date(older.body.rows[0].createdAt).getTime(),
      ).toBeLessThanOrEqual(new Date(first.body.rows[1].createdAt).getTime());
    });

    it('answers an empty window for a cursor from another conversation', async () => {
      const elsewhere = await history(amina, withChen);
      const seeded = await say(amina, withChen, { body: 'Hello Chen' });
      expect(seeded.status).toBe(201);
      expect(elsewhere.status).toBe(200);

      const wrong = await history(amina, withBo, `?before=${seeded.body.id}`);

      // A stale client, not an attack — and which ids exist elsewhere is not
      // something this answer teaches.
      expect(wrong.status).toBe(200);
      expect(wrong.body.rows).toEqual([]);
      expect(wrong.body.hasMore).toBe(false);
    });

    it('refuses a page size that is not one, and a cursor that is not a uuid', async () => {
      expect((await history(amina, withBo, '?pageSize=0')).status).toBe(400);
      expect((await history(amina, withBo, '?before=nonsense')).status).toBe(
        400,
      );
    });

    it('declares no locale, because nothing in it is translated', async () => {
      expect((await history(amina, withBo, '?locale=de')).status).toBe(400);
    });
  });

  describe('a non-member', () => {
    it('does not get the history', async () => {
      const outsider = await history(bo, withChen);

      // The same 404 an unknown id gets: an id somebody is not in is an id
      // they must not be able to confirm.
      expect(outsider.status).toBe(404);
      const unknown = await history(bo, '00000000-0000-4000-8000-000000000000');
      expect(said(outsider)).toBe(said(unknown));
    });

    it('cannot write into it either', async () => {
      const outsider = await say(bo, withChen, { body: 'Let me in' });

      expect(outsider.status).toBe(404);
    });

    it('cannot mark it as read', async () => {
      expect((await markRead(bo, withChen)).status).toBe(404);
    });

    it('does not see it in their own list', async () => {
      const theirs = await conversations(bo);

      expect(theirs.body.rows.map((row) => row.id)).not.toContain(withChen);
    });

    it('does not get the picture (E40)', async () => {
      const sent = await sayWithImage(amina, withChen, png(128), 'image/png');
      expect(sent.status).toBe(201);
      const url = sent.body.imageUrl as string;

      const member = await fetchImage(url, amina);
      const outsider = await fetchImage(url, bo);
      const anonymous = await fetchImage(url);

      expect(member.status).toBe(200);
      expect(member.headers.get('content-type')).toBe('image/png');
      // The type comes from the file's own first bytes, and nothing may sniff
      // its way past that (F38).
      expect(member.headers.get('x-content-type-options')).toBe('nosniff');
      // Private, because these bytes are content in a conversation.
      expect(member.headers.get('cache-control')).toContain('private');

      expect(outsider.status).toBe(404);
      // No session at all is a 401: the route needs one although its path does
      // not say so (E40).
      expect(anonymous.status).toBe(401);
    });

    it('is not helped by the organizer’s download route', async () => {
      const sent = await sayWithImage(amina, withBo, png(160), 'image/png');
      const attachment = await messageAttachmentId(sent.body.id);
      expect(attachment).not.toBeNull();

      const asOrganizer = await api(`/api/admin/attachments/${attachment}`, {
        headers: { cookie: admin },
      });

      // That route serves the files a registration collected and nothing else.
      // A picture inside a private conversation is reached through the
      // conversation, by a member of it.
      expect(asOrganizer.status).toBe(404);
    });
  });

  describe('the overview and the unread count (E38)', () => {
    it('lists a participant’s own conversations, the one that moved last first', async () => {
      // Written into on purpose rather than relying on what earlier tests
      // happened to say last: the order is the claim, so this test makes it.
      expect((await say(amina, withChen, { body: 'Ordering' })).status).toBe(
        201,
      );

      const mine = await conversations(amina);

      expect(mine.status).toBe(200);
      expect(mine.body.total).toBe(2);
      expect(mine.body.rows.map((row) => row.id)).toEqual([withChen, withBo]);
      expect(mine.body.rows[0].lastMessageAt).not.toBeNull();
    });

    it('counts what somebody else wrote and not one’s own lines', async () => {
      const before = await conversations(bo);
      const unreadBefore =
        before.body.rows.find((row) => row.id === withBo)?.unread ?? 0;
      expect(unreadBefore).toBeGreaterThan(0);

      // Bo writes: their own line must not make their own counter grow.
      expect((await say(bo, withBo, { body: 'One more thing' })).status).toBe(
        201,
      );

      const after = await conversations(bo);
      expect(after.body.rows.find((row) => row.id === withBo)?.unread).toBe(
        unreadBefore,
      );
      // And Amina's counter did move.
      const aminas = await conversations(amina);
      expect(
        aminas.body.rows.find((row) => row.id === withBo)?.unread,
      ).toBeGreaterThan(0);
    });

    it('goes to zero when the conversation is marked as read, and back up afterwards', async () => {
      expect((await markRead(bo, withBo)).status).toBe(204);

      const read = await conversations(bo);
      expect(read.body.rows.find((row) => row.id === withBo)?.unread).toBe(0);

      expect((await say(amina, withBo, { body: 'Still here' })).status).toBe(
        201,
      );

      const again = await conversations(bo);
      expect(again.body.rows.find((row) => row.id === withBo)?.unread).toBe(1);
    });

    it('pages, and reports what it used', async () => {
      const page = await conversations(amina, '?page=1&pageSize=1');

      expect(page.body.rows).toHaveLength(1);
      expect(page.body).toMatchObject({ page: 1, pageSize: 1, total: 2 });

      const second = await conversations(amina, '?page=2&pageSize=1');
      expect(second.body.rows[0].id).not.toBe(page.body.rows[0].id);
    });

    it('refuses a page that is not one', async () => {
      expect((await conversations(amina, '?page=0')).status).toBe(400);
    });

    it('needs a session', async () => {
      const anonymous = await api('/api/participant/conversations');

      expect(anonymous.status).toBe(401);
    });
  });

  describe('the module switch (F53)', () => {
    it('answers 404 everywhere while chat is off', async () => {
      const sent = await sayWithImage(amina, withBo, png(192), 'image/png');
      const imageUrl = sent.body.imageUrl as string;

      try {
        expect((await setModule('chat', false)).status).toBe(200);

        expect((await conversations(amina)).status).toBe(404);
        expect((await one(amina, withBo)).status).toBe(404);
        expect((await start(amina, boId)).status).toBe(404);
        expect((await history(amina, withBo)).status).toBe(404);
        expect((await say(amina, withBo, { body: 'Hello?' })).status).toBe(404);
        expect((await markRead(amina, withBo)).status).toBe(404);
        // Including the picture: a switched-off module has no media route
        // either. The session is checked first — the participant guard is
        // global — so this asks with one and still gets the 404.
        expect((await fetchImage(imageUrl, amina)).status).toBe(404);
      } finally {
        await setModule('chat', true);
      }

      expect((await conversations(amina)).status).toBe(200);
    });
  });
});
