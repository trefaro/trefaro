/**
 * Reading and writing event times in the event's own time zone (E8).
 *
 * Lives next to the model rather than in a client library because both clients
 * need exactly the same interpretation of the same two fields, and a second
 * implementation of "what does 09:00 in Europe/Berlin mean" is a defect waiting
 * for a DST boundary. Framework-free and dependency-free: `Intl` already knows
 * the zone database, so no date library is pulled in for this.
 */

/** The three fields that together describe when an event happens. */
export interface EventPeriod {
  /** Absolute instant, ISO 8601. */
  readonly startsAt: string;
  readonly endsAt: string;
  /** IANA zone, e.g. `Europe/Berlin`. */
  readonly timezone: string;
}

/** Shape of an `<input type="datetime-local">` value: wall-clock, no zone. */
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Whether `Intl` recognizes the string as a time zone. */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The zone the visitor's browser is in — a sensible default for a new event. */
export function localTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * `2027-03-14T09:00` in `Europe/Berlin` → the absolute instant, as ISO 8601.
 *
 * Two passes: the first guesses the offset from the naive reading, the second
 * uses that guess to get the offset actually in force at the resulting instant.
 * Without the second pass an event starting the morning a zone switches to
 * summer time would land an hour off.
 */
export function wallClockToInstant(
  wallClock: string,
  timeZone: string,
): string {
  if (!WALL_CLOCK.test(wallClock)) {
    throw new RangeError(`Not a wall-clock value: "${wallClock}"`);
  }
  const naive = Date.parse(`${wallClock}:00.000Z`);
  const firstGuess = naive - offsetMs(naive, timeZone);
  return new Date(naive - offsetMs(firstGuess, timeZone)).toISOString();
}

/** The inverse: an instant, as the wall clock reads it in that zone. */
export function instantToWallClock(iso: string, timeZone: string): string {
  const instant = Date.parse(iso);
  return new Date(instant + offsetMs(instant, timeZone))
    .toISOString()
    .slice(0, 16);
}

/**
 * When the event happens, spelled out in its own zone and named as such.
 *
 * The zone abbreviation is part of the output on purpose: a participant three
 * time zones away must not have to guess whose 09:00 this is.
 */
export function formatEventPeriod(period: EventPeriod, locale = 'en'): string {
  const start = new Date(period.startsAt);
  const end = new Date(period.endsAt);
  const zone = period.timezone;

  const day = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    dateStyle: 'long',
  });
  const clock = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  return isSameDay(start, end, zone)
    ? `${day.format(start)}, ${clock.format(start)}–${clock.format(end)} ${zoneLabel(period, locale)}`
    : `${day.format(start)}, ${clock.format(start)} – ${day.format(end)}, ${clock.format(end)} ${zoneLabel(period, locale)}`;
}

/**
 * A single instant, spelled out in a given zone.
 *
 * For the timestamps around an event rather than the event itself — when a
 * registration arrived, when an address was confirmed. Both belong in the
 * event's zone (E8): an organizer comparing "registered at" against the
 * programme is comparing two clocks, and they have to be the same one.
 *
 * A short date, because these appear in table cells: the year matters, the
 * weekday does not.
 */
export function formatInstant(
  iso: string,
  timeZone: string,
  locale = 'en',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** `CET`, `GMT+5:30` — whatever the locale calls the zone at that instant. */
export function zoneLabel(period: EventPeriod, locale = 'en'): string {
  const named = new Intl.DateTimeFormat(locale, {
    timeZone: period.timezone,
    timeZoneName: 'short',
  })
    .formatToParts(new Date(period.startsAt))
    .find((part) => part.type === 'timeZoneName')?.value;
  return named ?? period.timezone;
}

/**
 * Whether the event is over (FR 2.3 splits a series into upcoming and past).
 *
 * Keyed on the end, not the start: a conference is not "past" on its second
 * morning. Both values are absolute instants, so no zone enters this comparison.
 */
export function hasEnded(
  period: Pick<EventPeriod, 'endsAt'>,
  now = Date.now(),
): boolean {
  return Date.parse(period.endsAt) < now;
}

/**
 * The calendar day an instant falls on in a given zone, as `YYYY-MM-DD`.
 *
 * A sortable key rather than something to read: the programme timeline groups
 * items by the day they happen on *at the venue*, and two sessions eight hours
 * apart can be the same day there and two different days for the reader.
 *
 * Built from the formatted parts rather than from a locale whose short date
 * happens to look like ISO — an assumption about `en-CA` is not something a
 * grouping key should rest on.
 */
export function dayInZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));

  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** The same day, spelled out for a heading: `14 June 2027`. */
export function formatDayInZone(
  iso: string,
  timeZone: string,
  locale = 'en',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'long',
  }).format(new Date(iso));
}

/**
 * Two instants as a clock range in one zone: `09:00–10:30`.
 *
 * Without the date and without the zone name, because this is for something
 * already grouped under both — a programme item under its day. The day heading
 * names the zone once instead of every row repeating it.
 */
export function formatClockRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  locale = 'en',
): string {
  const clock = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${clock.format(new Date(startsAt))}–${clock.format(new Date(endsAt))}`;
}

/** Offset of the zone from UTC at that instant, in milliseconds. */
function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));

  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return asUtc - instant;
}

function isSameDay(first: Date, second: Date, timeZone: string): boolean {
  // Through the same key the programme groups by, so "one day" cannot mean two
  // different things in two places.
  return (
    dayInZone(first.toISOString(), timeZone) ===
    dayInZone(second.toISOString(), timeZone)
  );
}
