/**
 * Instants in the reader's language, and in the zone they belong to.
 *
 * Two kinds of time travel through a plug-in, and they are formatted
 * differently on purpose:
 *
 * - **When something happened** — a proposal was handed in, a post was
 *   written, somebody walked through a door. It has no place, so it is drawn
 *   in the reader's own clock and these functions are called without a zone.
 * - **When something is scheduled** — a session in a room plan, an entry in a
 *   personal programme. It happens at a venue, and E8 says the venue's clock
 *   is the one it is read in. Since plug-in API 1.3.0 the host's programme
 *   port stamps that zone on every session (E69), so these functions take it
 *   as a third argument and the two bundles that draw a timetable pass it.
 *
 * Until 1.3.0 a plug-in was handed no zone at all, and the second kind was
 * drawn like the first: a room plan read from Toronto disagreed with the
 * programme above it on the same page. That is the whole reason the parameter
 * exists, which is also why an unusable zone falls back to the plain instant
 * rather than to the reader's clock — the second would be the bug again, and
 * silent. An unknown language tag must not empty a row either: `Intl` throws
 * on one, and the fallback is the ISO text cut to size.
 */

/** Date and time — a post in a conversation needs a clock. */
export function when(locale: string, iso: string, timeZone?: string): string {
  return format(
    locale,
    iso,
    { dateStyle: 'medium', timeStyle: 'short' },
    timeZone,
    () => iso.slice(0, 16).replace('T', ' '),
  );
}

/** The day alone — a proposal was handed in on a day, not at an hour. */
export function day(locale: string, iso: string, timeZone?: string): string {
  return format(locale, iso, { dateStyle: 'medium' }, timeZone, () =>
    iso.slice(0, 10),
  );
}

/** The time alone — a slot in a room plan, next to the day it belongs to. */
export function clock(locale: string, iso: string, timeZone?: string): string {
  return format(locale, iso, { timeStyle: 'short' }, timeZone, () =>
    iso.slice(11, 16),
  );
}

function format(
  locale: string,
  iso: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string | undefined,
  fallback: () => string,
): string {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
      new Date(iso),
    );
  } catch {
    return fallback();
  }
}
