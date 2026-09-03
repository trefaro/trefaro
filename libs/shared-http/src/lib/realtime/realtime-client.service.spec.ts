import { TestBed } from '@angular/core/testing';
import {
  CHAT_CONVERSATION,
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MESSAGE,
  CHAT_NAMESPACE,
  CHAT_READ,
  REALTIME_PATH,
  type ChatMessage,
} from '@trefaro/shared-models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient } from './realtime-client.service';

/**
 * The chat socket as a client holds it (FR 4.5, E41).
 *
 * Three claims, and all three are about what happens to a screen rather than
 * about socket.io:
 *
 * - **It connects to the namespace under the API path**, because that is where
 *   the session cookie is sent and the handshake authenticates on it.
 * - **A refused handshake is a sentence, not a silence.** The server's own
 *   wording reaches {@link RealtimeClient.error} — a page can say "log in"
 *   rather than "something went wrong".
 * - **A reconnect rejoins what was being followed.** A new socket is in no
 *   rooms, so without this a conversation stops updating and nothing says so.
 */
type Handler = (payload?: unknown, ack?: (answer: unknown) => void) => void;

interface FakeSocket {
  connected: boolean;
  handlers: Map<string, Handler>;
  emitted: { event: string; payload: unknown }[];
  io: { engine: { transport: { name: string } } };
  on(event: string, handler: Handler): void;
  emit(event: string, payload?: unknown, ack?: (answer: unknown) => void): void;
  disconnect(): void;
  /** Answers the next join with this. */
  joinAnswer: unknown;
  fire(event: string, payload?: unknown): void;
}

const options: { last: Record<string, unknown> | undefined; url?: string } = {
  last: undefined,
};

let socket: FakeSocket;

function fakeSocket(): FakeSocket {
  const handlers = new Map<string, Handler>();
  const emitted: { event: string; payload: unknown }[] = [];
  return {
    connected: true,
    handlers,
    emitted,
    joinAnswer: { joined: true },
    io: { engine: { transport: { name: 'websocket' } } },
    on(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload, ack) {
      emitted.push({ event, payload });
      if (event === CHAT_JOIN && ack) ack(this.joinAnswer);
    },
    disconnect() {
      this.connected = false;
    },
    fire(event, payload) {
      handlers.get(event)?.(payload);
    },
  };
}

vi.mock('socket.io-client', () => ({
  io: (url: string, given: Record<string, unknown>) => {
    options.url = url;
    options.last = given;
    return socket;
  },
}));

describe('RealtimeClient', () => {
  let client: RealtimeClient;

  beforeEach(() => {
    socket = fakeSocket();
    options.last = undefined;
    options.url = undefined;
    TestBed.configureTestingModule({});
    client = TestBed.inject(RealtimeClient);
  });

  it('connects to the chat namespace under the API path', () => {
    client.connect();

    expect(options.url).toBe(CHAT_NAMESPACE);
    expect(options.last).toMatchObject({
      path: REALTIME_PATH,
      // No long-polling: a proxy that drops the upgrade has to fail visibly.
      transports: ['websocket'],
      withCredentials: true,
      // Sooner than socket.io's own twenty seconds: a screen that says
      // "connecting" for that long is hiding a failure.
      timeout: 8_000,
    });
  });

  it('opens one socket however often it is asked', () => {
    client.connect();
    client.connect();

    expect(client.status()).toBe('connecting');
  });

  it('reports the transport once connected', () => {
    client.connect();

    socket.fire('connect');

    expect(client.isConnected()).toBe(true);
    expect(client.transport()).toBe('websocket');
  });

  it('carries the server’s own refusal', () => {
    client.connect();

    socket.fire(
      'connect_error',
      new Error('A participant session is required'),
    );

    expect(client.status()).toBe('error');
    expect(client.error()).toContain('session');
  });

  it('hands on a message, a receipt and a moved conversation', () => {
    const message = { id: 'm1', conversationId: 'c1' } as ChatMessage;
    const seen: unknown[] = [];
    client.connect();
    client.messages.subscribe((value) => seen.push(value));
    client.reads.subscribe((value) => seen.push(value));
    client.conversations.subscribe((value) => seen.push(value));

    socket.fire(CHAT_MESSAGE, message);
    socket.fire(CHAT_READ, { conversationId: 'c1' });
    socket.fire(CHAT_CONVERSATION, { conversationId: 'c1' });

    expect(seen).toEqual([
      message,
      { conversationId: 'c1' },
      { conversationId: 'c1' },
    ]);
  });

  describe('following a conversation', () => {
    it('resolves true when the server admits it', async () => {
      client.connect();

      await expect(client.join('c1')).resolves.toBe(true);
      expect(socket.emitted).toEqual([{ event: CHAT_JOIN, payload: 'c1' }]);
    });

    it('resolves false when the server refuses', async () => {
      client.connect();
      socket.joinAnswer = { joined: false };

      await expect(client.join('c1')).resolves.toBe(false);
    });

    it('resolves false without a socket, rather than throwing', async () => {
      // A screen shows the conversation either way; it only stops updating.
      await expect(client.join('c1')).resolves.toBe(false);
    });

    it('rejoins after a reconnect', async () => {
      client.connect();
      await client.join('c1');
      socket.emitted.length = 0;

      socket.fire('connect');

      expect(socket.emitted).toEqual([{ event: CHAT_JOIN, payload: 'c1' }]);
    });

    it('does not rejoin one the server refused', async () => {
      client.connect();
      socket.joinAnswer = { joined: false };
      await client.join('c1');
      socket.emitted.length = 0;

      socket.fire('connect');

      expect(socket.emitted).toEqual([]);
    });

    it('forgets one that was left', async () => {
      client.connect();
      await client.join('c1');

      client.leave('c1');
      socket.emitted.length = 0;
      socket.fire('connect');

      expect(socket.emitted).toEqual([]);
    });

    it('forgets everything when the socket is closed', async () => {
      client.connect();
      await client.join('c1');

      client.disconnect();
      client.connect();
      socket.emitted.length = 0;
      socket.fire('connect');

      expect(socket.emitted).toEqual([]);
    });
  });

  it('says leave on the socket', async () => {
    client.connect();
    await client.join('c1');
    socket.emitted.length = 0;

    client.leave('c1');

    expect(socket.emitted).toEqual([{ event: CHAT_LEAVE, payload: 'c1' }]);
  });
});
