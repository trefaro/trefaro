import type { PublicEvent } from '../events';
import type { PublicProgramItem } from '../program';
import type { CustomFieldValues, RegistrationStatus } from '../registrations';

/**
 * What a participant can do with their own registration in phase 1 (E11).
 *
 * FR 3.10 — signing up for individual programme items — is P1, while the
 * participant login is P2 and arrives in phase 3. The gap is bridged by the
 * signed link in the confirmation receipt: it speaks for exactly one
 * registration, it grants exactly what is on this page, and phase 3 puts the
 * login in front of it without changing any of it.
 *
 * Two properties of these types follow from that:
 *
 * 1. **Only the reader's own data.** No participant list, no other person's
 *    sign-ups — a link that reached the wrong inbox must not turn into a view of
 *    the attendee list.
 * 2. **The whole view comes back from every call.** Signing up returns the same
 *    shape as reading, because a seat can be taken between the two — the page
 *    that just claimed the last seat has to be able to say so.
 */

/** One programme item, plus whether this participant has claimed a seat. */
export interface MyProgramItem extends PublicProgramItem {
  readonly signedUp: boolean;
}

/** The participant's own registration, as the self-service page reads it. */
export interface MyRegistration {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly status: RegistrationStatus;
  readonly registeredAt: string;
  readonly confirmedAt: string | null;
  /** The answers this person gave to the event's own questions (F12). */
  readonly customFields: CustomFieldValues;
  /** Both slugs, so the page can link back to where the registration began. */
  readonly seriesSlug: string;
  readonly event: PublicEvent;
  /** The full programme, in the order it happens, with sign-up state. */
  readonly program: readonly MyProgramItem[];
}

/**
 * One of the registrations an account's address holds (FR 4.7, E31).
 *
 * The row of the list a logged-in participant sees, and no more than a row: the
 * event to name it, the state to explain it, and the id to open it. Neither the
 * answers nor the programme travel here — a list that carried the whole view
 * per row would be one query per row on the server and a page nobody reads to
 * the end in the browser.
 *
 * Every state is listed, `pending` and `cancelled` included. What the list is
 * for is answering "am I registered for this?", and leaving out the two states
 * that make somebody ask would be leaving out the answer.
 */
export interface MyRegistrationSummary {
  readonly id: string;
  readonly status: RegistrationStatus;
  readonly registeredAt: string;
  readonly confirmedAt: string | null;
  /** Both slugs, so a row can link to the event's public page. */
  readonly seriesSlug: string;
  readonly event: PublicEvent;
}

/**
 * One page of them, the event that starts last first.
 *
 * Paginated like every list of this application, although a person rarely has
 * more than a handful: what is unbounded is not this reader's patience but the
 * number of events an instance runs, and a participant of a weekly series is
 * exactly the reader for whom "everything" grows without end.
 *
 * Descending by start, so the next event is at the top and the archive below
 * it. An event has a date, so this order is the same in every language — unlike
 * a series list, which is ordered by a name that translations move (F96).
 */
export interface MyRegistrationPage {
  readonly rows: readonly MyRegistrationSummary[];
  /** How many registrations the address has in total — what the pages divide. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Enough for everybody's first page, and one request for most people. */
export const DEFAULT_MY_REGISTRATION_PAGE_SIZE = 10;

/** The ceiling a client cannot ask past, whatever it sends. */
export const MAX_MY_REGISTRATION_PAGE_SIZE = 50;

/**
 * Path of the self-service page in the participant client.
 *
 * Here rather than in the server's mail templates, so the address the link
 * points at and the route that answers it cannot drift apart.
 */
export const SELF_SERVICE_PATH = '/registrations/me';
