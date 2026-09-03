import {
  BRANDING_MIME_TYPES,
  MAX_BRANDING_BYTES,
  MAX_UPLOAD_BYTES,
} from '../..';
import {
  CONVERSATION_MEMBER_TYPES,
  CONVERSATION_TYPES,
  MESSAGE_SENDER_TYPES,
} from './conversations';
import {
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_IMAGE_BYTES,
  MAX_MESSAGE_PAGE_SIZE,
} from './messages';
import {
  ORGANIZER_CONVERSATION_TYPES,
  ORGANIZER_MESSAGES_PATH,
  awaitsAnswer,
  organizerConversationPath,
} from './organizer-conversations';
import {
  CHAT_CONVERSATION,
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MESSAGE,
  CHAT_NAMESPACE,
  CHAT_READ,
  REALTIME_PATH,
} from './realtime';

/**
 * The numbers and sets of the chat (FR 4.5 — E39, E40).
 *
 * Not a test of arithmetic but of the relations between limits that were
 * argued for in prose and could drift apart silently. The picture in a message
 * is the first upload of this application with a ceiling of its own, and what
 * makes that defensible is exactly where it sits: above a logo, because a
 * photograph off a phone is content rather than chrome, and well below what a
 * public unauthenticated endpoint has to bound.
 */
describe('the chat’s limits and sets', () => {
  it('lets a message’s picture be larger than a logo and smaller than an upload', () => {
    expect(MAX_MESSAGE_IMAGE_BYTES).toBeGreaterThan(MAX_BRANDING_BYTES);
    expect(MAX_MESSAGE_IMAGE_BYTES).toBeLessThan(MAX_UPLOAD_BYTES);
  });

  it('accepts no type an avatar or a logo would not', () => {
    // A chat picture goes through the same service and the same signature
    // check (F38), so the accepted set is the images this instance serves —
    // and an SVG is refused wherever it is offered, because it can carry
    // script and would be served from the client's own origin.
    expect([...BRANDING_MIME_TYPES]).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);
  });

  it('names the three kinds of conversation and the three kinds of sender', () => {
    // The values the check constraints allow, and the reason they live here:
    // the server writes them and both clients read them (E39).
    expect([...CONVERSATION_TYPES]).toEqual([
      'direct',
      'group',
      'organizer_contact',
    ]);
    expect([...MESSAGE_SENDER_TYPES]).toEqual(['admin', 'user', 'guest']);
  });

  it('keeps a window a window', () => {
    expect(DEFAULT_MESSAGE_PAGE_SIZE).toBeLessThanOrEqual(
      MAX_MESSAGE_PAGE_SIZE,
    );
  });

  it('lets everybody but a guest be a member', () => {
    // The difference between the two lists is the decision, so it is asserted
    // as a difference rather than as a second literal (E39).
    expect([...CONVERSATION_MEMBER_TYPES]).toEqual(
      MESSAGE_SENDER_TYPES.filter((sender) => sender !== 'guest'),
    );
  });

  it('puts the socket inside the path the session cookie is issued for', () => {
    // The whole argument of the address in one assertion: the cookie carries
    // `Path=/api`, so a handshake outside it arrives without a session and
    // E41 cannot hold. If this ever fails, the reverse proxy and both clients
    // are already wrong too.
    expect(REALTIME_PATH.startsWith('/api/')).toBe(true);
  });

  it('lets the organization read two kinds and not the third (F173)', () => {
    // The subset is the access rule of the overview, written as a subset so it
    // cannot grow the one kind it must never contain: what two participants
    // write to each other is not the organization's to read.
    expect([...ORGANIZER_CONVERSATION_TYPES]).toEqual(
      CONVERSATION_TYPES.filter((kind) => kind !== 'direct'),
    );
  });

  it('reads "waiting for an answer" from who wrote last (F133)', () => {
    const row = {
      id: 'c1',
      type: 'organizer_contact' as const,
      topic: null,
      event: null,
      guest: { name: null, email: 'amina@example.org' },
      memberCount: 0,
      lastMessageAt: '2026-09-03T09:00:00.000Z',
      preview: null,
    };

    // Nobody has written: not waiting for anything. A group is created empty,
    // and an empty group in a "waiting" state would put a badge on every one
    // of them the moment it exists.
    expect(awaitsAnswer(row)).toBe(false);
    // Somebody else wrote last: nobody here has answered.
    expect(
      awaitsAnswer({
        ...row,
        preview: {
          senderType: 'guest',
          text: 'Is it accessible?',
          hasImage: false,
        },
      }),
    ).toBe(true);
    expect(
      awaitsAnswer({
        ...row,
        preview: {
          senderType: 'user',
          text: 'When is the bus?',
          hasImage: false,
        },
      }),
    ).toBe(true);
    // The organization wrote last, so it is answered — which is the question
    // that replaces the unread count it has nowhere to keep.
    expect(
      awaitsAnswer({
        ...row,
        preview: { senderType: 'admin', text: 'Yes, it is.', hasImage: false },
      }),
    ).toBe(false);
  });

  it('spells the organizer client’s conversation address once (F172)', () => {
    // The mail about a contact request links this path, and the organizer
    // client routes it. Two spellings would mean a notification pointing at
    // nothing the day the route is renamed.
    expect(organizerConversationPath('conversation-1')).toBe(
      `${ORGANIZER_MESSAGES_PATH}/conversation-1`,
    );
  });

  it('names every event once, and all of them in one family', () => {
    const events = [
      CHAT_JOIN,
      CHAT_LEAVE,
      CHAT_MESSAGE,
      CHAT_READ,
      CHAT_CONVERSATION,
    ];

    expect(new Set(events).size).toBe(events.length);
    // A prefix rather than a namespace's worth of bare words: a socket carries
    // more than one feature's traffic the moment a second gateway exists.
    expect(events.every((event) => event.startsWith('chat:'))).toBe(true);
    expect(CHAT_NAMESPACE).toBe('/chat');
  });
});
