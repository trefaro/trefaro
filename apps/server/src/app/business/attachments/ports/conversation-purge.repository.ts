/**
 * Port for the files inside conversations that are about to disappear
 * (E9, E40, F158).
 *
 * Deleting an **event** cascades through `conversation` to `message`, and a
 * cascade removes rows but no files. Every other parent in this application is
 * handled by {@link AttachmentRepository}, whose deletes are all scoped to
 * rows that *have* a registration — deliberately, so that no caller there can
 * remove a picture out of a conversation. This is the other half, and it is a
 * port of its own for two reasons rather than a widening of that one:
 *
 * - **The order is part of the operation** (F158). The `attachment` row cannot
 *   go first: `FK_message_attachment` is `ON DELETE SET NULL`, and a message
 *   that then has neither text nor picture violates `CHK_message_content`. So
 *   the conversations go, and the now-unowned files are deleted afterwards —
 *   one transaction, three statements, in that order.
 * - **It answers with paths, not with a promise.** Removing bytes is the
 *   caller's job, because there is no transaction across PostgreSQL and a
 *   filesystem: the rows go first and the files after, so a failure leaves an
 *   unreferenced file rather than a row pointing at nothing (E9's direction of
 *   compensation, unchanged).
 *
 * Owned by the attachments module although it reads the chat's tables. That is
 * the module whose job is "a file whose owner is gone", the module the events
 * and series already call before they delete, and — unlike the chat — one that
 * depends on nothing, so no cycle appears (the chat module already imports
 * events; the reverse would close one, which F162 avoided the same way).
 */

/** One file that no message points at any more. */
export interface UnownedFile {
  readonly id: string;
  /** Relative to the upload volume, inside the `messages` area (E19). */
  readonly path: string;
}

export interface ConversationPurgeRepository {
  /**
   * Deletes the conversations of one event and answers the files freed by it.
   *
   * Everything hanging off the event: a group is bound to it, and so is the
   * contact request that was written on its landing page. Called **before**
   * the event is deleted, so the cascade that follows finds nothing left to
   * do.
   */
  purgeForEvent(eventId: string): Promise<readonly UnownedFile[]>;

  /** The same for a series, whose deletion cascades through its events. */
  purgeForSeries(seriesId: string): Promise<readonly UnownedFile[]>;
}

export const CONVERSATION_PURGE_REPOSITORY = Symbol(
  'TREFARO_CONVERSATION_PURGE_REPOSITORY',
);
