/**
 * Instants in the reader's language and their own zone.
 *
 * Not the exception to E8 it looks like: E8 is about an *event's* times, which
 * have a place and are rendered in the event's zone by the host. When somebody
 * wrote something has no place; and a plug-in's slot is handed no zone, so
 * the reader's is the one it has. An unknown language tag must not empty a
 * row — `Intl` throws on one, and the fallback is the ISO text cut to size.
 */

/** Date and time — a post in a conversation needs a clock. */
export function when(locale: string, iso: string): string {
  return format(locale, iso, { dateStyle: 'medium', timeStyle: 'short' }, () =>
    iso.slice(0, 16).replace('T', ' '),
  );
}

/** The day alone — a proposal was handed in on a day, not at an hour. */
export function day(locale: string, iso: string): string {
  return format(locale, iso, { dateStyle: 'medium' }, () => iso.slice(0, 10));
}

/** The time alone — a slot in a room plan, next to the day it belongs to. */
export function clock(locale: string, iso: string): string {
  return format(locale, iso, { timeStyle: 'short' }, () => iso.slice(11, 16));
}

function format(
  locale: string,
  iso: string,
  options: Intl.DateTimeFormatOptions,
  fallback: () => string,
): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(iso));
  } catch {
    return fallback();
  }
}
