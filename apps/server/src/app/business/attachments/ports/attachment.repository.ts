/**
 * Port for the files uploaded with a registration (E9, F12).
 *
 * The business layer knows this interface; the data access layer implements it.
 *
 * **It cannot see a message's picture.** Since AP 6 of phase 3 the `attachment`
 * table also holds the pictures sent in a chat (E40), and every statement
 * behind this port carries `registration_id IS NOT NULL` — so `findById`
 * answers `null` for a chat picture and the organizer's download route answers
 * 404 for it without a branch of its own. The rule is in the statement rather
 * than in the callers, for the reason F152 gives: what must not go wrong is
 * made impossible below, not remembered above. A chat picture is reached
 * through the message it is in, by a member of that conversation.
 *
 * Two more things about it are deliberate:
 *
 * - **Every delete answers with the rows it removed.** A file lives in two
 *   places — a row here and bytes in the volume — and only the caller that just
 *   removed the rows knows which bytes are now unreferenced. Returning them is
 *   what makes "no orphan in the volume" achievable without a directory scan.
 * - **There is no `update`.** A file is replaced, not edited: a new submission
 *   of the same form deletes the old row and writes a new one, so the metadata
 *   can never describe bytes other than its own.
 */

/**
 * A registration's stored file in business-layer terms — no ORM types.
 *
 * Both owner fields are non-null here although the columns are nullable: this
 * port only ever sees rows that have a registration, which is what makes the
 * two fields safe to read without a check at every call site.
 */
export interface AttachmentRecord {
  readonly id: string;
  readonly registrationId: string;
  /** The form field that asked for it (F35) — stable across a rewording. */
  readonly fieldKey: string;
  /**
   * Where the bytes are, relative to the upload volume.
   *
   * Relative, never absolute: moving the volume, or mounting it somewhere else
   * in a container, must not invalidate every row.
   */
  readonly path: string;
  /** The name the participant's file had; what a download is called. */
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
}

export interface NewAttachment {
  readonly registrationId: string;
  readonly fieldKey: string;
  readonly path: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface AttachmentRepository {
  findById(id: string): Promise<AttachmentRecord | null>;
  /** One registration's files, in the order their fields are asked. */
  findByRegistration(
    registrationId: string,
  ): Promise<readonly AttachmentRecord[]>;
  create(attachment: NewAttachment): Promise<AttachmentRecord>;
  /** @returns the rows that were removed, so their files can be unlinked. */
  deleteByIds(ids: readonly string[]): Promise<readonly AttachmentRecord[]>;
  deleteByRegistration(
    registrationId: string,
  ): Promise<readonly AttachmentRecord[]>;
  /**
   * Everything uploaded for one event, across its registrations.
   *
   * Needed because deleting an event cascades through `registration` in the
   * database, and a cascade removes rows but no files.
   */
  deleteByEvent(eventId: string): Promise<readonly AttachmentRecord[]>;
  /** The same for a whole series, which cascades through its events. */
  deleteBySeries(seriesId: string): Promise<readonly AttachmentRecord[]>;
}

export const ATTACHMENT_REPOSITORY = Symbol('TREFARO_ATTACHMENT_REPOSITORY');
