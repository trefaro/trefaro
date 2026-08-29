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

/** The catalogue key that names a status to a person — see the series' own. */
export function eventStatusKey(status: EventStatus): string {
  return `eventStatus.${status}`;
}

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
  /**
   * What the organizer wants read once the event is over (FR 3.6, UC 10).
   *
   * `null` while the event has not ended — and withheld by the *server*, not
   * hidden by the page (F50). A text that is in the payload is a text anybody
   * can read, whatever the client chooses to draw; a follow-up that names the
   * next date or thanks the people who came must not be readable three weeks
   * before it is true.
   */
  readonly followUpBody: string | null;
}

/**
 * What an organizer sees, including events that are not public yet.
 *
 * Here {@link PublicEvent.followUpBody} carries whatever is stored, whenever it
 * was written: the organizer is the person writing it, so withholding it from
 * them would hide the field from the only view that can fill it.
 */
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
  /** Prepared before the event and shown after it (FR 3.6, F50). */
  readonly followUpBody?: string | null;
}

/**
 * How long a follow-up text may be.
 *
 * Room for a few paragraphs and the links that belong with them, not for a
 * report: the material itself is a media link (F10), and a landing page that
 * scrolls for ten screens after the fact is not read.
 */
export const MAX_FOLLOW_UP_LENGTH = 5000;

/**
 * How long the texts a name and a description may be, on a series and an event
 * alike.
 *
 * The numbers were the columns' since phase 1 and sat in two private copies in
 * two DTO files; they are here because AP 11 gives every one of these fields a
 * second, translated value that has to fit the same column and the same layout.
 * One bound per column, read by the form, the request and the translation.
 */
export const MAX_CONTENT_NAME_LENGTH = 200;
export const MAX_CONTENT_DESCRIPTION_LENGTH = 5_000;
export const MAX_VENUE_NAME_LENGTH = 200;

/**
 * The public address of an event, relative to the participant client.
 *
 * In one place because the shape is a decision (F28): slugs are unique per
 * parent, so a public address has to carry both — the series first, the event
 * inside it. Three callers build this path (the confirmation mail, the
 * organizer's dashboard, the participant client's router), and a fourth spelling
 * of it would be a link that works everywhere except in one mail.
 */
export function publicEventPath(seriesSlug: string, eventSlug: string): string {
  return `/series/${seriesSlug}/events/${eventSlug}`;
}
