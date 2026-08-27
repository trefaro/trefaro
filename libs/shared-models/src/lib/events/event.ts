/**
 * An event inside a series (FR 3.1, FR 3.2, FR 3.9).
 *
 * Deliberately not called `Event`: both clients are browser code, where `Event`
 * is a global DOM type. A domain type of an entirely different shape shadowing
 * it is the kind of collision that costs an afternoon, so the organizer's view
 * is `OrganizerEvent` and the participant's is `PublicEvent`.
 */

/** The three kinds FR 3.9 asks for. */
export type EventType = 'onsite' | 'online' | 'hybrid';

export const EVENT_TYPES: readonly EventType[] = ['onsite', 'online', 'hybrid'];

/**
 * Whether an event is visible to participants.
 *
 * Same three values as a series today, but a separate type: an event is the more
 * likely of the two to grow a `cancelled` state, and sharing one type would make
 * that change ripple through the series as well.
 */
export type EventStatus = 'draft' | 'published' | 'archived';

export const EVENT_STATUSES: readonly EventStatus[] = [
  'draft',
  'published',
  'archived',
];

/** What a participant sees on the landing page, with no login (FR 3.6). */
export interface PublicEvent {
  readonly id: string;
  /** Readable part of the public URL, unique within its series. */
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /** Served by the instance, never an external URL; `null` while none is set. */
  readonly logoUrl: string | null;
  readonly eventType: EventType;
  /** Absolute instant, ISO 8601. Render it in {@link timezone}, not the visitor's. */
  readonly startsAt: string;
  readonly endsAt: string;
  /**
   * IANA zone of the venue, e.g. `Europe/Berlin` (E8).
   *
   * The programme is rendered in the event's zone rather than the reader's: for
   * an organization with an international audience, anything else means two
   * people reading the same page disagree about when a session starts.
   */
  readonly timezone: string;
  /** Set for `onsite` and `hybrid` events. */
  readonly venueName: string | null;
  readonly venueAddress: string | null;
  /** Set for `online` and `hybrid` events. */
  readonly onlineUrl: string | null;
  /** BCP 47 tags of the languages the event is held in. Never empty. */
  readonly languages: readonly string[];
}

/** What an organizer sees, including events that are not public yet. */
export interface OrganizerEvent extends PublicEvent {
  readonly seriesId: string;
  readonly status: EventStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields an organizer may set. `slug` is derived from the name when omitted. */
export interface EventInput {
  readonly name: string;
  readonly description: string;
  readonly slug?: string;
  readonly eventType: EventType;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly venueName?: string | null;
  readonly venueAddress?: string | null;
  readonly onlineUrl?: string | null;
  readonly languages: readonly string[];
  readonly status?: EventStatus;
}
