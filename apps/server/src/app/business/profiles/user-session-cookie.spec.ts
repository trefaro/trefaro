import {
  USER_SESSION_COOKIE,
  participantSessionFromHeader,
} from './user-session-cookie';

/**
 * Reading the participant session out of a raw cookie header (E34, E41).
 *
 * The five lines that let the WebSocket handshake ask the same question an
 * HTTP route asks. What makes them worth a test is that they run where nothing
 * else does: `cookie-parser` is not in the way of a socket.io handshake, so a
 * mistake here does not look like a parsing bug, it looks like a session that
 * suddenly does not exist over sockets.
 */
describe('participantSessionFromHeader', () => {
  it('finds the token among other cookies', () => {
    expect(
      participantSessionFromHeader(
        `theme=dark; ${USER_SESSION_COOKIE}=abc123; other=1`,
      ),
    ).toBe('abc123');
  });

  it('reads a header that carries nothing else', () => {
    expect(participantSessionFromHeader(`${USER_SESSION_COOKIE}=abc123`)).toBe(
      'abc123',
    );
  });

  it('does not answer with the organizer’s cookie', () => {
    // The whole point of two cookies (E34): neither door opens with the
    // other's key, and a prefix match would have handed one over.
    expect(
      participantSessionFromHeader('trefaro_admin_session=abc123'),
    ).toBeNull();
  });

  it('is not fooled by a name that merely ends in the right word', () => {
    expect(
      participantSessionFromHeader(`not_${USER_SESSION_COOKIE}=abc123`),
    ).toBeNull();
  });

  it('answers null for no header, an empty one and an empty value', () => {
    expect(participantSessionFromHeader(undefined)).toBeNull();
    expect(participantSessionFromHeader('')).toBeNull();
    expect(participantSessionFromHeader(`${USER_SESSION_COOKIE}=`)).toBeNull();
    expect(participantSessionFromHeader('nonsense')).toBeNull();
  });

  it('decodes the value the way Express encoded it', () => {
    expect(participantSessionFromHeader(`${USER_SESSION_COOKIE}=a%20b`)).toBe(
      'a b',
    );
  });

  it('treats a malformed escape as no session', () => {
    // A broken cookie is a broken cookie; throwing here would turn it into a
    // failed handshake nobody can explain.
    expect(
      participantSessionFromHeader(`${USER_SESSION_COOKIE}=%E0%A4%A`),
    ).toBeNull();
  });
});
