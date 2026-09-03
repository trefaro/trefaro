/**
 * The real-time side of the chat: where the socket lives, and what travels
 * over it (FR 4.5, E41).
 *
 * Everything here is the **contract** between the gateway and both clients,
 * which is why it sits in a shared library rather than in either of them: an
 * event name spelled in two places is one that gets renamed in one of them.
 *
 * Two shapes matter for reading the rest:
 *
 * - **The handshake is the door, not the event** (E41). A socket authenticates
 *   when it connects — session cookie and the `chat` flag, both checked before
 *   the connection exists — so nothing below has to ask again. A refused
 *   handshake arrives at a client as `connect_error`, never as a socket that
 *   looks connected and answers nothing.
 * - **Two rooms, two questions.** The room of a conversation carries its
 *   lines, and is joined only by a member who asks (E41). The room of a member
 *   carries "one of your conversations moved", and a socket is put into its
 *   own at the handshake — no client has to ask to be told about itself.
 */

import type { ConversationMemberType } from './conversations';

/**
 * Where the socket.io endpoint is, for the server, both clients and the
 * reverse proxy.
 *
 * **Under `/api`, not at the default `/socket.io`** — and the reason is the
 * session cookie. It is issued with `Path=/api` so that it stays off requests
 * for static assets, which means a browser does not attach it to a handshake
 * anywhere else. A socket that authenticates on the cookie (E41) therefore has
 * to be reachable inside that path: the door has to stand where the key fits.
 *
 * The alternatives were both worse. Widening the cookie to `Path=/` would send
 * the session with every image and script of both clients, and it would
 * weaken the participant cookie **and** the organizer's, which are deliberately
 * identical (E34). Handing the token to the client so it could be sent as a
 * query parameter would mean it was readable by JavaScript, which is the one
 * property `HttpOnly` exists to deny.
 *
 * What this costs is a line in the reverse proxy: `/api/socket.io/` needs its
 * own location with the `Upgrade` and `Connection` headers, and it has to sit
 * beside `/api/` rather than inside it — see `infra/nginx/trefaro-locations.conf`.
 */
export const REALTIME_PATH = '/api/socket.io';

/**
 * The namespace the chat speaks on.
 *
 * A namespace rather than the default one, because it is where the handshake
 * check belongs: socket.io runs namespace middleware while the connection is
 * still being established, so a refusal there is a refused handshake rather
 * than a disconnect a moment later. It also keeps a future gateway — the
 * organizer's inbox of AP 10, say — from inheriting the participant's door.
 */
export const CHAT_NAMESPACE = '/chat';

/**
 * A member asks to follow one conversation.
 *
 * Acknowledged with {@link ChatJoinAck}, and refused for a conversation the
 * asker is not a member of: the room is the only thing between a socket and
 * somebody else's messages, so joining is the one place membership is decided
 * (E41). Refused the way the REST history refuses — "not yours" and "does not
 * exist" are one answer.
 */
export const CHAT_JOIN = 'chat:join';

/** Stops following a conversation. Needs no check: leaving is always allowed. */
export const CHAT_LEAVE = 'chat:leave';

/**
 * A new line in a conversation, delivered to the room of that conversation.
 *
 * The payload is the {@link ChatMessage} the REST endpoint would have
 * answered, deliberately: a client that renders one from a socket and one from
 * a request has one shape to render, and a message that arrives twice — sent
 * by this very client, then delivered — is recognised by its id.
 */
export const CHAT_MESSAGE = 'chat:message';

/**
 * Somebody has read a conversation up to a point in time (E38).
 *
 * Delivered to the conversation's room, the reader included: a person reading
 * on their phone should see the same conversation stop shouting on their
 * laptop.
 */
export const CHAT_READ = 'chat:read';

/**
 * One of the reader's conversations moved — delivered to their own room.
 *
 * The list's signal, and it is deliberately not the message: the overview
 * shows who wrote last and how much is unread, and both of those are answers
 * the server computes (E38). So this says *that* something happened and lets
 * the client re-read the row, rather than carrying half a summary a client
 * would have to assemble the rest of.
 *
 * It is what makes a badge appear on a conversation nobody has open, which is
 * exactly the case the room of a conversation cannot cover: a socket only
 * joins the conversations it is showing.
 */
export const CHAT_CONVERSATION = 'chat:conversation';

/** What {@link CHAT_JOIN} answers. */
export interface ChatJoinAck {
  /**
   * `false` for a conversation that is not the asker's — and for one that does
   * not exist, said the same way (F157).
   */
  readonly joined: boolean;
}

/** The payload of {@link CHAT_READ}. */
export interface ChatReadEvent {
  readonly conversationId: string;
  /** Which side read it — a participant account or an organizer (E39). */
  readonly memberType: ConversationMemberType;
  /** The reader's account id. A client only ever compares it with its own. */
  readonly memberId: string;
  readonly at: string;
}

/** The payload of {@link CHAT_CONVERSATION}. */
export interface ChatConversationEvent {
  readonly conversationId: string;
  /** When it moved, so a client can order two signals that arrive together. */
  readonly at: string;
}
