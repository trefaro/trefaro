/**
 * When a message was written, as its reader sees it (FR 4.5).
 *
 * **In the browser's own zone**, and that is a deliberate break with E8. An
 * event is spelled out in the zone it happens in, because everybody comparing
 * two sessions of a programme has to be comparing one clock. A message happens
 * where its reader is: it belongs to no event, and "18:40" means the time on
 * the phone that is showing it.
 *
 * No "today" or "yesterday" either, although every messenger has them. They
 * would need two catalogue keys and a notion of the current day that goes
 * stale while a screen is open — and the day heading below already answers the
 * question those words answer, in a form that is the same on every row.
 */

/** The clock of one message: `18:40`. */
export function messageClock(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** The day of one message, for the heading between two of them. */
export function messageDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(
    new Date(iso),
  );
}

/**
 * When a conversation last moved, for one row of the list.
 *
 * The clock while it was today, the date once it was not — which is what makes
 * the list readable at a glance: everything with a time in it happened since
 * this morning.
 */
export function conversationTime(
  iso: string,
  locale: string,
  now: Date = new Date(),
): string {
  const at = new Date(iso);
  return sameDay(at, now)
    ? messageClock(iso, locale)
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(at);
}

/**
 * Whether two instants fall on the same local day.
 *
 * Compared field by field rather than by dividing the timestamps: a day is not
 * 24 hours long everywhere, and the two dates a reader is looking at are the
 * ones their own browser draws.
 */
export function sameDay(one: Date, other: Date): boolean {
  return (
    one.getFullYear() === other.getFullYear() &&
    one.getMonth() === other.getMonth() &&
    one.getDate() === other.getDate()
  );
}
