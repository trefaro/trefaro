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
  /** Several series by id, in no promised order — for a list of events (FR 4.7). */
  findByIds(ids: readonly string[]): Promise<readonly EventSeriesRecord[]>;
  findBySlug(slug: string): Promise<EventSeriesRecord | null>;
  /** @throws EventSeriesSlugTakenError */
  create(series: NewEventSeries): Promise<EventSeriesRecord>;
  /** `null` when no series has that id. @throws EventSeriesSlugTakenError */
  update(
    id: string,
    changes: EventSeriesChanges,
  ): Promise<EventSeriesRecord | null>;
  /**
   * Points the row at a stored logo file, or at none (FR 2.1).
   *
   * A method of its own rather than a field of `EventSeriesChanges`, and that is the
   * decision `setBrandingImage` made for `app_config`: a storage path is not
   * something an organizer types, while `EventSeriesChanges` is the body of the edit
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
  ): Promise<EventSeriesRecord | null>;
  /** False when the series was already gone. */
  delete(id: string): Promise<boolean>;
}

export const EVENT_SERIES_REPOSITORY = Symbol(
  'TREFARO_EVENT_SERIES_REPOSITORY',
);
