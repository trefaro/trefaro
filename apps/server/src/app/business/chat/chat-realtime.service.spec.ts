import {
  CHAT_CONVERSATION,
  CHAT_MESSAGE,
  CHAT_READ,
  type ChatMessage,
} from '@trefaro/shared-models';
import {
  ChatRealtimeService,
  PARTICIPANT_SOCKET_DATA,
  conversationRoom,
  memberRoom,
  type ChatRoomHost,
} from './chat-realtime.service';
import type { ConversationMemberRef } from './ports/conversation.repository';

/**
 * Delivery (FR 4.5, E41) — AP 7.
 *
 * Four claims:
 *
 * - **A message reaches the conversation, a signal reaches every member.** The
 *   two are not the same event and not the same room: one is for a thread
 *   somebody is looking at, the other for a list that has to show a badge for
 *   a conversation nobody has open.
 * - **A read receipt reaches the conversation and only the reader's own room.**
 *   Nobody else's unread count moved.
 * - **A room name cannot be mistaken for a socket id.** Socket.io makes every
 *   socket a room named after its id; an unprefixed uuid would share that
 *   namespace.
 * - **Nothing that happens here can fail a request.** Publishing before a
 *   gateway exists is silence, and a throwing namespace is a log line — the
 *   message is already stored.
 */
const CREATED = '2026-09-03T10:15:00.000Z';
const ME: ConversationMemberRef = { memberType: 'user', memberId: 'me-0000' };
const OTHER: ConversationMemberRef = {
  memberType: 'user',
  memberId: 'other-111',
};

const message: ChatMessage = {
  id: 'm1',
  conversationId: 'c1',
  senderType: 'user',
  senderId: ME.memberId,
  body: 'Hello',
  imageUrl: null,
  createdAt: CREATED,
};

interface Sent {
  room: string;
  event: string;
  payload: unknown;
}

/**
 * A stand-in namespace: what was emitted, and who is in which room.
 *
 * `occupants` is keyed by room and holds the socket `data` objects the gateway
 * parks a participant id in — which is the shape `watchersOf` reads, and the
 * reason the key for it is a constant both files share.
 */
function recorder(
  options: {
    throws?: boolean;
    occupants?: Record<string, readonly Record<string, unknown>[]>;
    fetchThrows?: boolean;
  } = {},
): {
  host: ChatRoomHost;
  sent: Sent[];
} {
  const sent: Sent[] = [];
  return {
    sent,
    host: {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          if (options.throws) throw new Error('the namespace is closed');
          sent.push({ room, event, payload });
          return true;
        },
      }),
      in: (room: string) => ({
        fetchSockets: async () => {
          if (options.fetchThrows) {
            throw new Error('the namespace is closed');
          }
          return (options.occupants?.[room] ?? []).map((data) => ({ data }));
        },
      }),
    },
  };
}

describe('ChatRealtimeService', () => {
  describe('a new message', () => {
    it('sends the line to the conversation and a signal to every member', () => {
      const service = new ChatRealtimeService();
      const { host, sent } = recorder();
      service.attach(host);

      service.publishMessage(message, [ME, OTHER]);

      expect(sent).toEqual([
        { room: 'conversation:c1', event: CHAT_MESSAGE, payload: message },
        {
          room: 'member:user:me-0000',
          event: CHAT_CONVERSATION,
          payload: { conversationId: 'c1', at: CREATED },
        },
        {
          room: 'member:user:other-111',
          event: CHAT_CONVERSATION,
          payload: { conversationId: 'c1', at: CREATED },
        },
      ]);
    });

    it('signals the sender too', () => {
      // Their list moved as much as anybody's: the conversation they just
      // wrote in belongs at the top of it.
      const service = new ChatRealtimeService();
      const { host, sent } = recorder();
      service.attach(host);

      service.publishMessage(message, [ME]);

      expect(sent.map((entry) => entry.room)).toContain('member:user:me-0000');
    });
  });

  describe('a read receipt', () => {
    it('reaches the conversation and the reader’s own room', () => {
      const service = new ChatRealtimeService();
      const { host, sent } = recorder();
      service.attach(host);
      const at = new Date(CREATED);

      service.publishRead('c1', ME, at);

      expect(sent).toEqual([
        {
          room: 'conversation:c1',
          event: CHAT_READ,
          payload: {
            conversationId: 'c1',
            memberType: 'user',
            memberId: 'me-0000',
            at: CREATED,
          },
        },
        {
          room: 'member:user:me-0000',
          event: CHAT_CONVERSATION,
          payload: { conversationId: 'c1', at: CREATED },
        },
      ]);
      // And nobody else's room: their count did not change.
      expect(sent.map((entry) => entry.room)).not.toContain(
        'member:user:other-111',
      );
    });
  });

  describe('the room names', () => {
    it('cannot be mistaken for a socket id', () => {
      const id = '5f2a6d1e-0000-4000-8000-000000000000';

      expect(conversationRoom(id)).not.toBe(id);
      expect(memberRoom({ memberType: 'user', memberId: id })).not.toBe(id);
      // And the two families cannot collide with each other either.
      expect(conversationRoom(id)).not.toBe(
        memberRoom({ memberType: 'user', memberId: id }),
      );
    });

    it('tells the two sides of a membership apart', () => {
      expect(memberRoom({ memberType: 'admin', memberId: 'x' })).not.toBe(
        memberRoom({ memberType: 'user', memberId: 'x' }),
      );
    });
  });

  describe('when there is nothing to deliver to', () => {
    it('says nothing before a gateway has initialised', () => {
      const service = new ChatRealtimeService();

      expect(() => service.publishMessage(message, [ME])).not.toThrow();
    });

    it('swallows a throwing namespace', () => {
      // The message is stored; a failed delivery must not turn a written
      // message into a 500.
      const service = new ChatRealtimeService();
      service.attach(recorder({ throws: true }).host);

      expect(() => service.publishMessage(message, [ME])).not.toThrow();
      expect(() =>
        service.publishRead('c1', ME, new Date(CREATED)),
      ).not.toThrow();
    });
  });
  describe('who is watching a conversation (E44)', () => {
    it('names the members with a socket in the conversation’s room', async () => {
      const service = new ChatRealtimeService();
      service.attach(
        recorder({
          occupants: {
            'conversation:c1': [
              { [PARTICIPANT_SOCKET_DATA]: ME.memberId },
              { [PARTICIPANT_SOCKET_DATA]: OTHER.memberId },
            ],
          },
        }).host,
      );

      const watching = await service.watchersOf('c1');

      expect([...watching].sort()).toEqual(
        [ME.memberId, OTHER.memberId].sort(),
      );
    });

    it('counts one member once, however many tabs they have open', async () => {
      const service = new ChatRealtimeService();
      service.attach(
        recorder({
          occupants: {
            'conversation:c1': [
              { [PARTICIPANT_SOCKET_DATA]: ME.memberId },
              { [PARTICIPANT_SOCKET_DATA]: ME.memberId },
            ],
          },
        }).host,
      );

      expect(await service.watchersOf('c1')).toEqual(new Set([ME.memberId]));
    });

    it('answers about the conversation’s room and not about the connection', async () => {
      const service = new ChatRealtimeService();
      service.attach(
        recorder({
          // Connected — the member room is joined at the handshake (F166) —
          // but not looking at this conversation. That is exactly the person
          // E44 wants notified.
          occupants: {
            'member:user:me-0000': [{ [PARTICIPANT_SOCKET_DATA]: ME.memberId }],
          },
        }).host,
      );

      expect(await service.watchersOf('c1')).toEqual(new Set());
    });

    it('says nobody when no gateway has initialised', async () => {
      expect(await new ChatRealtimeService().watchersOf('c1')).toEqual(
        new Set(),
      );
    });

    it('says nobody when the namespace refuses to answer', async () => {
      const service = new ChatRealtimeService();
      service.attach(recorder({ fetchThrows: true }).host);

      // Erring towards "nobody is watching" means a notification too many
      // rather than a message nobody hears about.
      expect(await service.watchersOf('c1')).toEqual(new Set());
    });
  });
});
