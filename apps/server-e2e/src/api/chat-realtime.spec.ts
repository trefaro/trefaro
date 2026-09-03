import { io, type Socket } from 'socket.io-client';
import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';
import {
  closeDatabase,
  deleteConversations,
  deleteProfiles,
  seedProfile,
  seedSession,
} from '../support/database';

/**
 * Contract of AP 7: the chat in real time (FR 4.5, E41).
 *
 * The acceptance criterion of the package, minus the one part no suite here
 * can reach — "through NGINX", which is `tools/spike-verification/`'s job
 * (`verify-chat.mjs`). What is decided here:
 *
 * 1. **A connection without a session is refused**, and refused in the
 *    handshake: `connect_error`, not a socket that connects and then ignores
 *    everything. No cookie, the organizer's cookie and a dead token are one
 *    sentence.
 * 2. **A socket with a valid session cannot join somebody else's room.** Not
 *    an id it invented, and not a real conversation between two other people.
 * 3. **A message reaches both participants without a reload** — and reaches
 *    nobody else.
 * 4. **A read receipt reaches the other side**, with the timestamp that was
 *    stored (E38).
 * 5. **A switched-off `chat` ends the handshake** (F53). The clients' menu is
 *    not what enforces a module.
 *
 * **No logins at all.** The instance allows twenty in five minutes (E4) and
 * the six account suites already use sixteen; this one needs three sessions,
 * which would take it to nineteen. So the sessions are seeded — a session *is*
 * a hashed token in a row, and neither the guard nor the handshake can tell
 * how the row got there. What that gives up is proof that a login issues a
 * usable socket cookie, and `chat.spec.ts` already proves the cookie a login
 * issues is the one the guard accepts.
 */
const USER_SESSION_COOKIE = 'trefaro_user_session';
const BASE_URL = `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}`;
const REALTIME_PATH = '/api/socket.io';
const CHAT_NAMESPACE = '/chat';

/** Unique per run: a leftover row must not be able to answer an assertion. */
const stamp = Date.now();
const DOMAIN = '@realtime.example.org';

/** An id of the right shape that belongs to nothing. */
const NOWHERE = '5f2a6d1e-0000-4000-8000-000000000000';

interface Conversation {
  id: string;
}

interface Message {
  id: string;
  conversationId: string;
  body: string | null;
  senderId: string | null;
}

interface ReadReceipt {
  conversationId: string;
  memberType: string;
  memberId: string;
  at: string;
}

interface Moved {
  conversationId: string;
  at: string;
}

/** What a socket heard, and whether it got in at all. */
interface Listener {
  socket: Socket;
  connected: boolean;
  refusal: string | null;
  messages: Message[];
  reads: ReadReceipt[];
  moved: Moved[];
}

const open = async (cookie?: string): Promise<Listener> => {
  const socket = io(`${BASE_URL}${CHAT_NAMESPACE}`, {
    path: REALTIME_PATH,
    // No polling fallback: a refusal has to be a refusal, not a downgrade.
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
    ...(cookie ? { extraHeaders: { cookie } } : {}),
  });

  const listener: Listener = {
    socket,
    connected: false,
    refusal: null,
    messages: [],
    reads: [],
    moved: [],
  };

  socket.on('chat:message', (event: Message) => listener.messages.push(event));
  socket.on('chat:read', (event: ReadReceipt) => listener.reads.push(event));
  socket.on('chat:conversation', (event: Moved) => listener.moved.push(event));

  await new Promise<void>((resolve) => {
    socket.once('connect', () => {
      listener.connected = true;
      resolve();
    });
    socket.once('connect_error', (error: Error) => {
      listener.refusal = error.message;
      resolve();
    });
    setTimeout(() => {
      listener.refusal ??= 'no answer within 6s';
      resolve();
    }, 6000);
  });

  return listener;
};

const join = (socket: Socket, conversationId: string) =>
  new Promise<{ joined: boolean }>((resolve) => {
    const timer = setTimeout(() => resolve({ joined: false }), 4000);
    socket.emit('chat:join', conversationId, (ack: { joined: boolean }) => {
      clearTimeout(timer);
      resolve(ack ?? { joined: false });
    });
  });

/** Waits for something to land, so an assertion does not race the socket. */
async function settle(
  condition: () => boolean,
  timeoutMs = 4000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

describe('the chat in real time', () => {
  /** Amina and Bo hold the conversation under test. */
  let amina = '';
  let aminaId = '';
  let bo = '';
  let boId = '';
  /** Chen holds a conversation with Bo that Amina has no business in. */
  let chen = '';
  let chenId = '';
  let admin = '';

  let theirs = '';
  let elsewhere = '';

  /** Every socket a test opened, so none of them keeps Jest alive. */
  const listeners: Listener[] = [];

  const listen = async (cookie?: string): Promise<Listener> => {
    const listener = await open(cookie);
    listeners.push(listener);
    return listener;
  };

  const cookieOf = (token: string) => `${USER_SESSION_COOKIE}=${token}`;

  const start = (session: string, profileId: string) =>
    api<Conversation>('/api/participant/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: session },
      body: JSON.stringify({ profileId }),
    });

  const say = (session: string, id: string, body: string) =>
    api<Message>(`/api/participant/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: session },
      body: JSON.stringify({ body }),
    });

  const markRead = (session: string, id: string) =>
    api(`/api/participant/conversations/${id}/read`, {
      method: 'PUT',
      headers: { cookie: session },
    });

  const setModule = (key: string, enabled: boolean) =>
    api(`/api/admin/modules/${key}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: admin },
      body: JSON.stringify({ enabled }),
    });

  beforeAll(async () => {
    admin = await adminCookie();

    // Seeded accounts with seeded sessions: everything this suite asserts is
    // about the socket, and a login would only spend a budget (E4).
    aminaId = await seedProfile({
      email: `amina-${stamp}${DOMAIN}`,
      firstName: 'Amina',
      lastName: 'Okonkwo',
      searchable: true,
    });
    boId = await seedProfile({
      email: `bo-${stamp}${DOMAIN}`,
      firstName: 'Bo',
      lastName: 'Adeyemi',
      searchable: true,
    });
    chenId = await seedProfile({
      email: `chen-${stamp}${DOMAIN}`,
      firstName: 'Chen',
      lastName: 'Balogun',
      searchable: true,
    });

    amina = cookieOf(await seedSession(aminaId));
    bo = cookieOf(await seedSession(boId));
    chen = cookieOf(await seedSession(chenId));

    theirs = (await start(amina, boId)).body.id;
    elsewhere = (await start(bo, chenId)).body.id;
  });

  afterAll(async () => {
    for (const listener of listeners) listener.socket.disconnect();
    // The conversations first: a membership carries no foreign key on the
    // account it names (E39), so deleting the accounts would leave them.
    await deleteConversations([theirs, elsewhere]);
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  describe('the handshake (E41)', () => {
    it('refuses a socket without a cookie', async () => {
      const anonymous = await listen();

      expect(anonymous.connected).toBe(false);
      expect(anonymous.refusal).toContain('session');
    });

    it('says the same thing for a dead token and the organizer’s cookie', async () => {
      const anonymous = await listen();
      const stale = await listen(cookieOf('not-a-session'));
      const organizer = await listen(admin);

      expect(stale.refusal).toBe(anonymous.refusal);
      // Two cookies, and neither door opens with the other's key (E34).
      expect(organizer.refusal).toBe(anonymous.refusal);
    });

    it('admits a socket that carries a session, on a real upgrade', async () => {
      const listener = await listen(amina);

      expect(listener.connected).toBe(true);
      expect(listener.socket.io.engine.transport.name).toBe('websocket');
    });
  });

  describe('the rooms', () => {
    it('lets a member follow their own conversation', async () => {
      const listener = await listen(amina);

      await expect(join(listener.socket, theirs)).resolves.toEqual({
        joined: true,
      });
    });

    it('refuses a conversation between two other people', async () => {
      // A real conversation, with a real id, that this account is not in.
      const listener = await listen(amina);

      await expect(join(listener.socket, elsewhere)).resolves.toEqual({
        joined: false,
      });
    });

    it('refuses an id that belongs to nothing, and one that is not an id', async () => {
      const listener = await listen(amina);

      await expect(join(listener.socket, NOWHERE)).resolves.toEqual({
        joined: false,
      });
      await expect(join(listener.socket, 'not-a-uuid')).resolves.toEqual({
        joined: false,
      });
    });
  });

  describe('a message', () => {
    it('arrives at both participants without a reload', async () => {
      const hers = await listen(amina);
      const his = await listen(bo);
      await join(hers.socket, theirs);
      await join(his.socket, theirs);

      const sent = await say(amina, theirs, 'Arrived without a reload');

      expect(sent.status).toBe(201);
      expect(
        await settle(() => hers.messages.length > 0 && his.messages.length > 0),
      ).toBe(true);
      // The same object the endpoint answered with: one shape to render.
      expect(his.messages[0]).toEqual(sent.body);
      expect(hers.messages[0].senderId).toBe(aminaId);
    });

    it('tells both of them that their conversation moved', async () => {
      const hers = await listen(amina);
      const his = await listen(bo);
      await join(hers.socket, theirs);

      // His socket deliberately joins nothing: the list has to learn about a
      // conversation nobody has open, which is what the member room is for.
      await say(amina, theirs, 'For the list');

      expect(
        await settle(
          () =>
            hers.moved.some((event) => event.conversationId === theirs) &&
            his.moved.some((event) => event.conversationId === theirs),
        ),
      ).toBe(true);
      expect(his.messages).toEqual([]);
    });

    it('reaches nobody outside the conversation', async () => {
      const outsider = await listen(chen);
      const hers = await listen(amina);
      await join(hers.socket, theirs);

      await say(amina, theirs, 'Not for Chen');
      await settle(() => hers.messages.length > 0);

      expect(outsider.messages).toEqual([]);
      expect(
        outsider.moved.filter((event) => event.conversationId === theirs),
      ).toEqual([]);
    });
  });

  describe('a read receipt (E38)', () => {
    it('reaches the other side with the reader’s own id', async () => {
      const hers = await listen(amina);
      const his = await listen(bo);
      await join(hers.socket, theirs);
      await join(his.socket, theirs);
      await say(amina, theirs, 'Please read this');
      await settle(() => his.messages.length > 0);

      const marked = await markRead(bo, theirs);

      expect(marked.status).toBe(204);
      expect(await settle(() => hers.reads.length > 0)).toBe(true);
      expect(hers.reads[0]).toMatchObject({
        conversationId: theirs,
        memberType: 'user',
        memberId: boId,
      });
      // A timestamp, not a promise of one.
      expect(Number.isNaN(Date.parse(hers.reads[0].at))).toBe(false);
    });

    it('moves the reader’s own list and not the other side’s', async () => {
      const hers = await listen(amina);
      const his = await listen(bo);
      await say(amina, theirs, 'One more');
      // Both signals have to have landed before the counters are cleared, or
      // a straggler from this line would look like an answer to the next one.
      await settle(() => hers.moved.length > 0 && his.moved.length > 0);
      hers.moved.length = 0;
      his.moved.length = 0;

      await markRead(bo, theirs);

      expect(await settle(() => his.moved.length > 0)).toBe(true);
      // Her unread count did not change, so her list has nothing to re-read.
      expect(hers.moved).toEqual([]);
    });
  });

  describe('the module switch (F53)', () => {
    it('ends the handshake while messaging is off', async () => {
      await setModule('chat', false);
      try {
        const listener = await listen(amina);

        expect(listener.connected).toBe(false);
        expect(listener.refusal).toContain('switched off');
      } finally {
        await setModule('chat', true);
      }
    });

    it('admits again once it is back on', async () => {
      const listener = await listen(amina);

      expect(listener.connected).toBe(true);
    });
  });
});
