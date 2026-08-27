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
 * Path of the self-service page in the participant client.
 *
 * Here rather than in the server's mail templates, so the address the link
 * points at and the route that answers it cannot drift apart.
 */
export const SELF_SERVICE_PATH = '/registrations/me';
