/**
 * Messages — text, picture or both, never nothing (FR 4.5, E40).
 *
 * The image exchange is part of the chat from the first migration on, and that
 * was a deliberate call: a second pass through data model and gateway to add
 * pictures later would have cost more than carrying them from the start. What
 * gets reused is what already exists — the `attachment` row, the signature
 * check (F38) and the size accounting — so a chat picture is not a second file
 * mechanism, only a second kind of owner.
 */

import type { MessageSenderType } from './conversations';

/**
 * One line of a conversation.
 *
 * `body` and `imageUrl` are both optional and not both absent: the database
 * says so with a `CHECK`, and the endpoint refuses it with a 400 before the
 * `CHECK` ever has to. An empty message is not a message — the alternative is a
 * conversation that can be filled with blank lines.
 */
export interface ChatMessage {
  readonly id: string;
  readonly conversationId: string;
  /** Which side wrote it (E39) — `guest` carries no {@link senderId}. */
  readonly senderType: MessageSenderType;
  /**
   * The account or organizer behind it, or `null` for a guest.
   *
   * For a participant this is the profile id, which is what lets a client tell
   * its own lines from the other side's without comparing names.
   */
  readonly senderId: string | null;
  readonly body: string | null;
  /**
   * Where the picture is, or `null`.
   *
   * Addressed by the **message**, not by the attachment: the picture of a
   * private conversation may only be served to a member, and membership is a
   * property of the conversation the message is in. An attachment id in the
   * URL would be an id whose owner the route would have to look up anyway —
   * and one that names a file rather than a place in a conversation.
   *
   * No `?v=` here, unlike an avatar: a message cannot be edited (E14), so its
   * picture never changes and the URL never has to.
   */
  readonly imageUrl: string | null;
  readonly createdAt: string;
}

/**
 * A window of a conversation's history, newest first.
 *
 * **A cursor rather than a page number**, and it is the one list of this
 * application that deviates from that convention. The reason is what the list
 * is: messages arrive at the end while it is being read, so "page 2" means
 * something different a second later — a reader scrolling back would see one
 * line twice and miss another. A cursor names a line instead of a count, and
 * survives everything that arrives after it.
 *
 * There is no `total` for the same reason there is no page number: nothing
 * shows a message count, and counting every line of a long conversation on
 * every scroll would be a query nobody reads. {@link hasMore} is what a client
 * actually needs.
 */
export interface MessageHistory {
  readonly rows: readonly ChatMessage[];
  /** Whether older messages exist behind the oldest row of this window. */
  readonly hasMore: boolean;
}

/**
 * What a history request may say.
 *
 * Both optional: without a cursor this is the newest window, which is what a
 * conversation opens with.
 */
export interface MessageHistoryQuery {
  /**
   * Read strictly older than this message.
   *
   * An id, not a timestamp: two messages can share a millisecond, and a
   * timestamp cursor would drop one of them or repeat it. An id that is not in
   * this conversation yields an empty window rather than an error — it is a
   * stale client, not an attack, and telling it which ids exist elsewhere is
   * not this endpoint's job.
   */
  readonly before?: string;
  readonly pageSize?: number;
}

/** What sending a message says, beside the optional picture. */
export interface SendMessageInput {
  readonly body?: string;
}

/**
 * The multipart part that carries the picture.
 *
 * Part of the contract rather than of either side, like
 * `BRANDING_IMAGE_PART`. Unlike a registration with a file (F39) there is **no
 * `payload` part**: F39 needs one because a registration's fields are a nested
 * object and multipart cannot express one. A message has a single text field,
 * so it travels as an ordinary form field and the endpoint accepts plain JSON
 * for a message without a picture.
 */
export const MESSAGE_IMAGE_PART = 'image';

/**
 * The longest message this application stores.
 *
 * Generous for a chat line and far short of an essay: the field is one line
 * that grows, not a document editor, and a bound is what keeps one message
 * from being a megabyte in a conversation everybody in it loads.
 */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * The most a message's picture may weigh.
 *
 * Eight times the ceiling for a logo or an avatar (`MAX_BRANDING_BYTES`), and
 * well under `MAX_UPLOAD_BYTES`. The difference in kind is what justifies the
 * difference in number: a logo is chrome that every visitor downloads before
 * the first paint, whereas this is a photograph somebody took at an event and
 * is sending to the people who were there. Refusing every unretouched phone
 * picture would make the feature ornamental.
 *
 * The endpoint behind it needs a session, so this is not the bound on what a
 * stranger can make the server read; it is what a participant gets told in
 * words instead of watching a proxy refuse a body.
 */
export const MAX_MESSAGE_IMAGE_BYTES = 4 * 1024 * 1024;

/** How many messages a window holds — one screenful and a bit on a phone. */
export const DEFAULT_MESSAGE_PAGE_SIZE = 30;

/** The most a client may ask for at once. */
export const MAX_MESSAGE_PAGE_SIZE = 100;
