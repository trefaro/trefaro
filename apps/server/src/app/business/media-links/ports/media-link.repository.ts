import type { MediaLinkKind } from '@trefaro/shared-models';

/**
 * Port for the external media links of an event (FR 3.6, F10).
 *
 * The business layer knows this interface; the data access layer implements it.
 * Two things are deliberately not here:
 *
 * - **No reorder.** The kind is the order and within a kind it is the order they
 *   were added (F52), so there is no position to write — the same reasoning that
 *   left `sort` off `program_item` (F40).
 * - **No "links of one session" read.** A landing page renders the whole event
 *   and groups the links itself; two reads for one page would be a request per
 *   session on a three-day programme.
 *
 * Whether a link's session belongs to the link's event is not this port's word
 * to keep: the migration declares a composite foreign key, so the pair cannot be
 * written at all. The service checks it too, to answer 400 instead of letting a
 * constraint violation become a 500.
 */

/** A media link in business-layer terms — no ORM types. */
export interface MediaLinkRecord {
  readonly id: string;
  readonly eventId: string;
  /** `null` for a link that belongs to the event as a whole. */
  readonly programItemId: string | null;
  readonly kind: MediaLinkKind;
  readonly title: string;
  readonly url: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewMediaLink {
  readonly eventId: string;
  readonly programItemId: string | null;
  readonly kind: MediaLinkKind;
  readonly title: string;
  readonly url: string;
}

/** Only the fields actually given are written. */
export interface MediaLinkChanges {
  readonly programItemId?: string | null;
  readonly kind?: MediaLinkKind;
  readonly title?: string;
  readonly url?: string;
}

export interface MediaLinkRepository {
  /**
   * Every link of one event, oldest first.
   *
   * `(created_at, id)` — the id last, so two links added in the same
   * millisecond never swap between two reads. The kind's order is applied above
   * this port, where the list of kinds lives.
   */
  findByEvent(eventId: string): Promise<readonly MediaLinkRecord[]>;
  findById(id: string): Promise<MediaLinkRecord | null>;
  create(link: NewMediaLink): Promise<MediaLinkRecord>;
  /** `null` when no link has that id. */
  update(
    id: string,
    changes: MediaLinkChanges,
  ): Promise<MediaLinkRecord | null>;
  /** False when the link was already gone. */
  delete(id: string): Promise<boolean>;
}

export const MEDIA_LINK_REPOSITORY = Symbol('TREFARO_MEDIA_LINK_REPOSITORY');
