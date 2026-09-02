import type { CustomFieldValues } from './field';
import type { RegistrationStatus } from './registration';
import type { AttachmentSummary } from './upload';

/**
 * The participant overview (FR 3.3, UC 08) — the highest rated function of the
 * survey (3,86/4).
 *
 * Two properties of these types carry decisions rather than data:
 *
 * 1. **The e-mail address is a field of the row**, not something behind a click.
 *    It is the single correction the usability test of the thesis produced, and
 *    the reason is mundane: an organizer's next step after looking someone up is
 *    almost always writing to them.
 * 2. **A page knows its unfiltered counts.** Otherwise a filtered view cannot
 *    say what it is a subset of, and "3 participants" would be a lie told to an
 *    organizer looking at a list of 400.
 */

/** One row of the participant table (E13). */
export interface ParticipantRow {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  /** In the table, never behind a click — the thesis' usability correction. */
  readonly email: string;
  readonly phone: string | null;
  readonly origin: string | null;
  readonly status: RegistrationStatus;
  readonly newsletterOptIn: boolean;
  /** The participant asked not to be invited to later events again (E15). */
  readonly contactOptOut: boolean;
  /**
   * Whether this address has a confirmed participant account (FR 3.3, E31).
   *
   * The profile column phase 1 left out, because a column that always says "no
   * profile" is worse than no column (E13). A yes/no and nothing else: the
   * organizer learns that this person can log in, not who they are on their
   * profile — that would mean handing out an id, and an id is a picture (F124).
   *
   * Confirmed only. An account whose double opt-in is still outstanding cannot
   * be logged into (E32), so calling it a profile would promise the organizer
   * something they cannot rely on.
   */
  readonly hasProfile: boolean;
  /** When the form was submitted, ISO 8601. */
  readonly registeredAt: string;
  /**
   * When the address was confirmed, ISO 8601 — kept even after a cancellation.
   *
   * That somebody once confirmed is a fact and stays one; it is also what tells
   * a cancelled registration apart from one that was never completed, which
   * decides whether reinstating it may restore `confirmed`.
   */
  readonly confirmedAt: string | null;
  /**
   * The answers to this event's configurable fields (F12), keyed by field key.
   *
   * Part of the row rather than of the detail view alone: it is one JSONB column
   * of the same query, and the detail panel would otherwise need a second
   * request to show what somebody actually answered.
   *
   * May hold keys no field defines any more. Deleting a definition does not
   * delete the answers people gave (F34), and the overview says so rather than
   * hiding them.
   */
  readonly customFields: CustomFieldValues;
}

/** How many registrations an event has, by status — the whole event, unfiltered. */
export interface RegistrationCounts {
  readonly total: number;
  readonly pending: number;
  readonly confirmed: number;
  readonly cancelled: number;
}

/** Columns the table can be ordered by. */
export type ParticipantSort = 'name' | 'email' | 'status' | 'registeredAt';

export const PARTICIPANT_SORTS: readonly ParticipantSort[] = [
  'name',
  'email',
  'status',
  'registeredAt',
];

export type SortDirection = 'asc' | 'desc';

/** Newest first: the arrival an organizer has not seen yet is the interesting one. */
export const DEFAULT_PARTICIPANT_SORT: ParticipantSort = 'registeredAt';
export const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

/**
 * Fits a laptop screen without scrolling and keeps one query small.
 *
 * Paging is not a nicety here: the risk table of the phase plan names the
 * participant overview as the function that fails first at volume, which is why
 * it is paged from the first line of code rather than from phase 5.
 */
export const DEFAULT_PARTICIPANT_PAGE_SIZE = 25;

/** An organizer exporting a whole event still must not ask for one huge page. */
export const MAX_PARTICIPANT_PAGE_SIZE = 200;

/** What the table asks for. Every field optional — the defaults above apply. */
export interface ParticipantQuery {
  /**
   * Free text over first name, last name and e-mail.
   *
   * Split on whitespace; every word has to match one of the three, so "amina
   * okonkwo" and "okonkwo amina" both find the same person.
   */
  readonly search?: string;
  readonly status?: RegistrationStatus;
  readonly sort?: ParticipantSort;
  readonly direction?: SortDirection;
  /** One-based, because it appears in the interface and in a URL. */
  readonly page?: number;
  readonly pageSize?: number;
}

/** One page of the table, with everything the surrounding interface needs. */
export interface ParticipantPage {
  readonly rows: readonly ParticipantRow[];
  /** Rows matching the filter — what the pagination divides. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  /** Of the whole event, so a filtered view can still say what it filtered. */
  readonly counts: RegistrationCounts;
}

/** One bar of the weekly registration graph (mockup 5.6, FR 3.8). */
export interface RegistrationWeek {
  /**
   * The Monday the week starts on, as `YYYY-MM-DD`.
   *
   * A calendar date, not an instant: weeks are counted in the event's own time
   * zone (E8), and a date carries that without inviting a second conversion in
   * the client.
   */
  readonly weekStart: string;
  readonly total: number;
  readonly confirmed: number;
}

/** The registration curve of one event. */
export interface RegistrationStatistics {
  /** Consecutive weeks, oldest first — gaps filled, so the graph is honest. */
  readonly weeks: readonly RegistrationWeek[];
  readonly counts: RegistrationCounts;
  /** The zone the weeks were cut in, so the graph can say so (E8). */
  readonly timezone: string;
}

/** One registration on its own, with the event it belongs to. */
export interface ParticipantDetail extends ParticipantRow {
  readonly eventId: string;
  readonly eventName: string;
  /**
   * The files uploaded with this registration (E9), in form order.
   *
   * On the detail rather than on the row, like the answers are shown in the
   * detail panel: the table has to stay readable and fast at two thousand rows,
   * and a file is something an organizer opens one at a time anyway.
   */
  readonly attachments: readonly AttachmentSummary[];
}

/** What an organizer may change about a registration (E14). */
export interface RegistrationStatusChange {
  readonly status: RegistrationStatus;
}

/** Total pages for a result, at least one — an empty table still has a page 1. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}
