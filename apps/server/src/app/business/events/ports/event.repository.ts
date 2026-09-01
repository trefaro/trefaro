import type { EventStatus, EventType } from '@trefaro/shared-models';

/**
 * Port for events within a series (FR 3.1, FR 3.2, FR 3.9).
 *
 * The business layer knows this interface; the data access layer implements it.
 * Nothing here decides who may see an event — that rule needs the series' status
 * as well and therefore lives in the service.
 */

/** An event row in business-layer terms — no ORM types. */
export interface EventRecord {
  readonly id: string;
  readonly seriesId: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly logoPath: string | null;
  readonly eventType: EventType;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly venueName: string | null;
  readonly venueAddress: string | null;
  readonly onlineUrl: string | null;
  readonly languages: readonly string[];
  readonly status: EventStatus;
  /** Prose shown after the event has ended (FR 3.6); `null` while none is written. */
  readonly followUpBody: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewEvent {
  readonly seriesId: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly eventType: EventType;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly venueName: string | null;
  readonly venueAddress: string | null;
  readonly onlineUrl: string | null;
  readonly languages: readonly string[];
  readonly status: EventStatus;
  readonly followUpBody: string | null;
}

/** Only the fields actually given are written. */
export interface EventChanges {
  readonly slug?: string;
  readonly name?: string;
  readonly description?: string;
  readonly eventType?: EventType;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
  readonly timezone?: string;
  readonly venueName?: string | null;
  readonly venueAddress?: string | null;
  readonly onlineUrl?: string | null;
  readonly languages?: readonly string[];
  readonly status?: EventStatus;
  readonly followUpBody?: string | null;
}

/** Raised when a slug is already taken within the same series. */
export class EventSlugTakenError extends Error {
  constructor(
    readonly seriesId: string,
    readonly slug: string,
  ) {
    super(`This series already has an event at the address "${slug}"`);
    this.name = 'EventSlugTakenError';
  }
}

export interface EventRepository {
  /** Every event of one series in date order, whatever its status. */
  findBySeries(seriesId: string): Promise<readonly EventRecord[]>;
  /** Only the published ones, in date order. */
  findPublishedBySeries(seriesId: string): Promise<readonly EventRecord[]>;
  findById(id: string): Promise<EventRecord | null>;
  findBySlug(seriesId: string, slug: string): Promise<EventRecord | null>;
  /** @throws EventSlugTakenError */
  create(event: NewEvent): Promise<EventRecord>;
  /** `null` when no event has that id. @throws EventSlugTakenError */
  update(id: string, changes: EventChanges): Promise<EventRecord | null>;
  /**
   * Points the row at a stored logo file, or at none (FR 3.1).
   *
   * A method of its own rather than a field of `EventChanges`, and that is the
   * decision `setBrandingImage` made for `app_config`: a storage path is not
   * something an organizer types, while `EventChanges` is the body of the edit
   * form. One column that both a form and an upload can write is a column a form
   * can blank by accident — and the blanking would leave a file nothing points
   * at.
   *
   * @returns the row as it now stands, so the caller can build the public URL
   * from the `updated_at` this write moved (see `logo-url.ts`). `null` when no
   * row has that id, which is how the 404 gets made.
   */
  setLogoPath(
    id: string,
    storedPath: string | null,
  ): Promise<EventRecord | null>;
  /** False when the event was already gone. */
  delete(id: string): Promise<boolean>;
}

export const EVENT_REPOSITORY = Symbol('TREFARO_EVENT_REPOSITORY');
