import type { EventPeriod } from '@trefaro/shared-models';

/**
 * A notification as the business layer describes it.
 *
 * Deliberately small: participants get told that something they registered for
 * changed, with a link into the app — not a copy of the change itself. The
 * payload is encrypted for the one browser it is addressed to, so a push
 * service cannot read it; what a lock screen shows to whoever is holding the
 * phone is the reason it stays short all the same (NFR 7).
 */
export interface PushNotification {
  readonly title: string;
  readonly body: string;
  /** In-app path to open on click, e.g. `/series/spring/events/kickoff`. */
  readonly url?: string;
}

/** Outcome of one delivery attempt to an audience. */
export interface PushDeliveryReport {
  readonly delivered: number;
  readonly failed: number;
  /** Endpoints the push service reported as gone; removed from storage. */
  readonly expired: number;
}

/**
 * What can be worth notifying about an event, and nothing else (F176).
 *
 * Three, because these are the three that break a plan somebody already made:
 * the event is at another time, it is somewhere else, or it is not happening.
 * A new description, a renamed venue contact, a translated title — those are
 * changes to a page, and a page is read when somebody looks at it.
 */
export type EventChange = 'time' | 'place' | 'withdrawn';

/**
 * One event's change, as its audience needs it (FR 3.15).
 *
 * The **caller** decides that something happened and hands over the facts; the
 * push module decides who hears about it and in which words. The path comes
 * along rather than being composed here because composing it needs the series'
 * address, which the events module has and this one has no business asking for.
 */
export interface EventChangeNotice {
  /** Whose audience this is — the devices are read by this id (E43). */
  readonly eventId: string;
  readonly name: string;
  /** In-app path of the public landing page — where a click lands. */
  readonly path: string;
  readonly changes: readonly EventChange[];
  /** The event as it now stands, for the line that names the new time (E8). */
  readonly period: EventPeriod;
  /** The venue, when there is one to name — an online event has none. */
  readonly place: string | null;
}

/**
 * A new message, for the member who was not there to see it (E44).
 *
 * No sender, no subject, no first line: what a notification carries here is
 * "there is something for you, and this is where", because the alternative is
 * a lock screen showing a stranger a private conversation. Whoever wrote it is
 * on the screen the click opens.
 */
export interface MessageNotice {
  /** In-app path of the conversation. */
  readonly path: string;
}
