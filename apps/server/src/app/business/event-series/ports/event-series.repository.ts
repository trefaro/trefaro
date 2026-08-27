import type { EventSeriesStatus } from '@trefaro/shared-models';

/**
 * Port for event series (FR 2.1, FR 2.2).
 *
 * The business layer knows this interface; the data access layer implements it.
 */

/** A series row in business-layer terms — no ORM types. */
export interface EventSeriesRecord {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /** Path inside the upload volume, or `null` while no logo is set. */
  readonly logoPath: string | null;
  readonly websiteUrl: string | null;
  readonly contactEmail: string | null;
  readonly status: EventSeriesStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewEventSeries {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly websiteUrl: string | null;
  readonly contactEmail: string | null;
  readonly status: EventSeriesStatus;
}

/** Only the fields actually given are written. */
export interface EventSeriesChanges {
  readonly slug?: string;
  readonly name?: string;
  readonly description?: string;
  readonly websiteUrl?: string | null;
  readonly contactEmail?: string | null;
  readonly status?: EventSeriesStatus;
}

/** Raised when a slug is already taken — uniqueness is a domain rule here. */
export class EventSeriesSlugTakenError extends Error {
  constructor(readonly slug: string) {
    super(`An event series with the address "${slug}" already exists`);
    this.name = 'EventSeriesSlugTakenError';
  }
}

export interface EventSeriesRepository {
  /** Every series, whatever its status — the organizer's list. */
  findAll(): Promise<readonly EventSeriesRecord[]>;
  /** Only what participants may see. */
  findPublished(): Promise<readonly EventSeriesRecord[]>;
  findById(id: string): Promise<EventSeriesRecord | null>;
  findBySlug(slug: string): Promise<EventSeriesRecord | null>;
  /** @throws EventSeriesSlugTakenError */
  create(series: NewEventSeries): Promise<EventSeriesRecord>;
  /** `null` when no series has that id. @throws EventSeriesSlugTakenError */
  update(
    id: string,
    changes: EventSeriesChanges,
  ): Promise<EventSeriesRecord | null>;
  /** False when the series was already gone. */
  delete(id: string): Promise<boolean>;
}

export const EVENT_SERIES_REPOSITORY = Symbol(
  'TREFARO_EVENT_SERIES_REPOSITORY',
);
