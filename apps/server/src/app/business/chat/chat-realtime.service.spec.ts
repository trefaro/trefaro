import {
  CHAT_CONVERSATION,
  CHAT_MESSAGE,
  CHAT_READ,
  type ChatMessage,
} from '@trefaro/shared-models';
import {
  ChatRealtimeService,
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

function recorder(options: { throws?: boolean } = {}): {
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
});
