/**
 * Port for the lines of a conversation (FR 4.5 — E40).
 *
 * Two properties worth naming:
 *
 * - **Appending a message moves its conversation.** One method, one
 *   transaction: `last_message_at` is what the overview sorts by, and a
 *   service that wrote the message and then the timestamp would leave a
 *   conversation out of order whenever the second write failed.
 * - **The attachment id never leaves this layer.** A message says *whether* it
 *   has a picture; the address of that picture is built from the **message**
 *   id, because that is what membership can be decided from. An attachment id
 *   in a URL would name a file and say nothing about who may see it.
 *
 * There is no `update` and no `delete`, and that is not an omission: a message
 * cannot be edited or withdrawn (E14), so a port that could do either would be
 * a capability waiting for a caller.
 */

import type { MessageSenderType } from '@trefaro/shared-models';

/** A message on its way into a conversation. */
export interface NewMessage {
  readonly conversationId: string;
  readonly senderType: MessageSenderType;
  /** `null` only for a guest, who has no account (E39). */
  readonly senderId: string | null;
  readonly body: string | null;
  /**
   * The picture, or `null` — metadata only, the bytes are already stored.
   *
   * The `attachment` row is written **here**, in the same transaction as the
   * message, rather than by the caller beforehand: an attachment row that no
   * message points at is exactly the leak `CHK_attachment_owner` cannot catch,
   * and one transaction is the only way to rule it out. What the caller does
   * first is write the bytes, so a failed append leaves an unreferenced file
   * rather than a row pointing at nothing — the direction of compensation E9
   * chose for registration files, unchanged.
   */
  readonly image: NewMessageImage | null;
}

/** What the `attachment` row of a message's picture says (E40). */
export interface NewMessageImage {
  /** Relative to the upload volume, inside the `messages` area (E19). */
  readonly path: string;
  /**
   * The name the file arrived under.
   *
   * Nothing shows it — a message's picture is drawn, never downloaded by name.
   * It is kept because the column requires it and because it is what an
   * operator matching a file in the volume to a line in a conversation has.
   */
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/** A message in business-layer terms — no ORM types, and no stored path. */
export interface MessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly senderType: MessageSenderType;
  readonly senderId: string | null;
  readonly body: string | null;
  /** Whether there is a picture. Its address is built from {@link id}. */
  readonly hasImage: boolean;
  readonly createdAt: Date;
}

/** Where the bytes of one message's picture are, and which conversation it is in. */
export interface MessageImageRecord {
  readonly conversationId: string;
  /** Relative to the upload volume, inside the `messages` area (E19). */
  readonly path: string;
}

export interface MessageRepository {
  /** Appends a message and moves its conversation's `last_message_at`. */
  append(message: NewMessage): Promise<MessageRecord>;

  /**
   * One window of a conversation's history, newest first.
   *
   * `before` is a message id to read strictly older than, or `null` for the
   * newest window. An id that is not in this conversation yields an empty
   * window rather than an error: it is a stale client, and which ids exist
   * elsewhere is not something this answer teaches.
   */
  history(
    conversationId: string,
    before: string | null,
    limit: number,
  ): Promise<readonly MessageRecord[]>;

  /**
   * The picture of one message, or `null`.
   *
   * Answers for a message that has one, whoever is asking — the membership
   * check belongs to the caller, because "not a member" and "no such message"
   * have to end up as the same sentence and only the caller knows both.
   */
  findImage(messageId: string): Promise<MessageImageRecord | null>;
}

export const MESSAGE_REPOSITORY = Symbol('TREFARO_MESSAGE_REPOSITORY');
