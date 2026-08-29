/**
 * An event series — the unit an organization plans in (FR 2.1, FR 2.2).
 *
 * "Trefaro" is named after it: a collection of meetings. A series holds the
 * events, and it is what the participant start page lists.
 */

/**
 * Whether a series is visible to participants.
 *
 * `archived` rather than deleted for a series an organization has finished with:
 * its events and their registrations are records, and throwing them away to tidy
 * a list would be the wrong trade (E14 of the phase 1 plan).
 */
export type EventSeriesStatus = 'draft' | 'published' | 'archived';

export const EVENT_SERIES_STATUSES: readonly EventSeriesStatus[] = [
  'draft',
  'published',
  'archived',
];

/**
 * The catalogue key that names a status to a person.
 *
 * `draft` is a database word, and the organizer client used to print it into a
 * table cell — the same slip {@link registrationStatusKey} was written for. Its
 * own key space rather than the event's, for the reason the two types are
 * separate: an event may grow a state a series never has, and one shared set of
 * keys would make that a change to both.
 */
export function eventSeriesStatusKey(status: EventSeriesStatus): string {
  return `eventSeriesStatus.${status}`;
}

/** What a participant sees, with no login (UC 08 start page). */
export interface PublicEventSeries {
  readonly id: string;
  /** Readable part of the public URL, unique across the instance. */
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /** Served by the instance, never an external URL; `null` while none is set. */
  readonly logoUrl: string | null;
  readonly websiteUrl: string | null;
  readonly contactEmail: string | null;
}

/** What an organizer sees, including series that are not public yet. */
export interface EventSeries extends PublicEventSeries {
  readonly status: EventSeriesStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields an organizer may set. `slug` is derived from the name when omitted. */
export interface EventSeriesInput {
  readonly name: string;
  readonly description: string;
  readonly slug?: string;
  readonly websiteUrl?: string | null;
  readonly contactEmail?: string | null;
  readonly status?: EventSeriesStatus;
}
