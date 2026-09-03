import { CHAT_MODULE_KEY } from '@trefaro/shared-models';
import type { Namespace, Socket } from 'socket.io';
import type { CoreModuleRegistryService } from '../config';
import { USER_SESSION_COOKIE, type UserSessionService } from '../profiles';
import type { ChatRealtimeService } from './chat-realtime.service';
import { ChatGateway } from './chat.gateway';
import type { ConversationsService } from './conversations.service';

/**
 * The door and the rooms (FR 4.5, E41) — AP 7.
 *
 * Four claims, and the first three are the acceptance criterion of the
 * package:
 *
 * - **A socket without a valid session never connects.** No cookie, the
 *   organizer's cookie, and a token no session answers for are one refusal,
 *   and it happens in the handshake — not on the first message, which would
 *   mean an unauthenticated socket sitting on the server.
 * - **A switched-off module ends the handshake too** (F53). That a client does
 *   not offer a chat is not an assurance; a socket is the one part of this
 *   application reachable without loading a page of it.
 * - **A member joins one conversation, a stranger joins none.** The room is
 *   the only thing between a socket and somebody else's messages, and "not
 *   yours" and "no such thing" are one answer (F157).
 * - **An admitted socket lands in its own member room**, so a badge can reach
 *   a conversation nobody has open.
 */
const ME = 'me-0000';
const TOKEN = 'a-session-token';
const MINE = '5f2a6d1e-0000-4000-8000-000000000001';
const THEIRS = '5f2a6d1e-0000-4000-8000-000000000002';

const withSession = `${USER_SESSION_COOKIE}=${TOKEN}`;

/** What a socket did, so a test can read it without holding the socket. */
interface Sink {
  joined: string[];
  left: string[];
  dropped: boolean;
}

const sink = (): Sink => ({ joined: [], left: [], dropped: false });

/** A socket as socket.io hands one to the middleware. */
function socket(cookie: string | undefined, into: Sink = sink()): Socket {
  return {
    id: 'socket-1',
    data: {} as Record<string, unknown>,
    handshake: { headers: cookie === undefined ? {} : { cookie } },
    conn: { transport: { name: 'websocket' } },
    join: async (room: string) => {
      into.joined.push(room);
    },
    leave: async (room: string) => {
      into.left.push(room);
    },
    disconnect: () => {
      into.dropped = true;
    },
  } as unknown as Socket;
}

function fake(
  options: {
    enabled?: boolean;
    /** The conversations this participant is a member of. */
    memberOf?: readonly string[];
  } = {},
): {
  gateway: ChatGateway;
  /** Runs the handshake middleware; the refusal, or `null` for admitted. */
  admit(client: Socket): Promise<Error | null>;
  attached: number;
} {
  let middleware: (
    client: Socket,
    next: (error?: Error) => void,
  ) => void = () => undefined;
  let attached = 0;

  const sessions = {
    async resolve(token: string) {
      return token === TOKEN ? { profile: { id: ME } } : null;
    },
  } as unknown as UserSessionService;

  const modules = {
    isEnabled: (key: string) =>
      key === CHAT_MODULE_KEY ? (options.enabled ?? true) : false,
  } as unknown as CoreModuleRegistryService;

  const conversations = {
    async membershipOf(_viewerId: string, conversationId: string) {
      return (options.memberOf ?? [MINE]).includes(conversationId)
        ? { conversation: { id: conversationId }, lastReadAt: null }
        : null;
    },
  } as unknown as ConversationsService;

  const realtime = {
    attach: () => {
      attached += 1;
    },
  } as unknown as ChatRealtimeService;

  const gateway = new ChatGateway(sessions, modules, conversations, realtime);
  gateway.afterInit({
    use: (handler: (client: Socket, next: (error?: Error) => void) => void) => {
      middleware = handler;
    },
  } as unknown as Namespace);

  return {
    gateway,
    get attached() {
      return attached;
    },
    admit: (client: Socket) =>
      new Promise<Error | null>((resolve) => {
        middleware(client, (error) => resolve(error ?? null));
      }),
  };
}

describe('ChatGateway', () => {
  describe('the handshake (E41)', () => {
    it('admits a socket that carries a valid session', async () => {
      expect(await fake().admit(socket(withSession))).toBeNull();
    });

    it('hands the namespace to the publisher once', () => {
      expect(fake().attached).toBe(1);
    });

    it('refuses a socket without a cookie', async () => {
      const refusal = await fake().admit(socket(undefined));

      expect(refusal?.message).toContain('session');
    });

    it('says the same thing for no cookie, the wrong cookie and a dead token', async () => {
      const harness = fake();

      const missing = await harness.admit(socket(undefined));
      // The organizer's cookie is not the participant's (E34).
      const organizer = await harness.admit(
        socket(`trefaro_admin_session=${TOKEN}`),
      );
      const stale = await harness.admit(
        socket(`${USER_SESSION_COOKIE}=expired`),
      );

      expect(organizer?.message).toBe(missing?.message);
      expect(stale?.message).toBe(missing?.message);
    });

    it('refuses when the module is switched off', async () => {
      const refusal = await fake({ enabled: false }).admit(socket(withSession));

      expect(refusal?.message).toContain('switched off');
    });

    it('asks for the session before the module, like the HTTP side', async () => {
      // An anonymous request to a switched-off module's endpoint answers 401,
      // because the participant guard is global and runs first. A socket must
      // not answer a different question first.
      const refusal = await fake({ enabled: false }).admit(socket(undefined));

      expect(refusal?.message).toContain('session');
    });
  });

  describe('the connection', () => {
    it('puts an admitted socket into its own member room', async () => {
      const harness = fake();
      const into = sink();
      const client = socket(withSession, into);

      await harness.admit(client);
      harness.gateway.handleConnection(client);

      expect(into.joined).toEqual([`member:user:${ME}`]);
    });

    it('drops a socket that arrived without being admitted', () => {
      // Unreachable through socket.io, and checked anyway: the alternative is
      // a socket in nobody's room that looks like a working connection.
      const into = sink();

      fake().gateway.handleConnection(socket(withSession, into));

      expect(into.dropped).toBe(true);
      expect(into.joined).toEqual([]);
    });
  });

  describe('joining a conversation', () => {
    it('lets a member follow one', async () => {
      const harness = fake({ memberOf: [MINE] });
      const into = sink();
      const client = socket(withSession, into);
      await harness.admit(client);

      expect(await harness.gateway.join(MINE, client)).toEqual({
        joined: true,
      });
      expect(into.joined).toContain(`conversation:${MINE}`);
    });

    it('refuses a conversation that is not the asker’s', async () => {
      const harness = fake({ memberOf: [MINE] });
      const into = sink();
      const client = socket(withSession, into);
      await harness.admit(client);

      expect(await harness.gateway.join(THEIRS, client)).toEqual({
        joined: false,
      });
      expect(into.joined).not.toContain(`conversation:${THEIRS}`);
    });

    it('refuses anything that is not a conversation id, without asking', async () => {
      const harness = fake();
      const client = socket(withSession);
      await harness.admit(client);

      // A query with a non-uuid would be a database error, which is what
      // `ParseUUIDPipe` keeps off the REST routes (E33).
      for (const nonsense of ['', 'not-a-uuid', 42, null, { id: MINE }]) {
        expect(await harness.gateway.join(nonsense, client)).toEqual({
          joined: false,
        });
      }
    });

    it('refuses a socket that was never admitted', async () => {
      expect(await fake().gateway.join(MINE, socket(withSession))).toEqual({
        joined: false,
      });
    });
  });

  describe('leaving a conversation', () => {
    it('leaves the room without asking anything', async () => {
      const harness = fake({ memberOf: [] });
      const into = sink();

      await harness.gateway.leave(MINE, socket(withSession, into));

      // Not a member, and it still let go: refusing would strand a client in
      // a conversation it was just removed from.
      expect(into.left).toEqual([`conversation:${MINE}`]);
    });

    it('ignores anything that is not a conversation id', async () => {
      const into = sink();

      await fake().gateway.leave('nonsense', socket(withSession, into));

      expect(into.left).toEqual([]);
    });
  });
});
