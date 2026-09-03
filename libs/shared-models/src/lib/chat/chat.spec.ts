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
