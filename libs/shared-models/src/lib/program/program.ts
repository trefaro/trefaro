import {
  dayInZone,
  formatClockRange,
  formatDayInZone,
  zoneLabel,
} from '../events/event-time';

/**
 * The programme of one event (FR 3.7, UC 11).
 *
 * FR 3.6 named the programme as part of the highest-rated participant feature
 * of the survey (3,74) — what somebody has to be able to read before deciding
 * to come. FR 3.7 is the organizer's side of the same thing.
 *
 * Three properties of these types carry decisions rather than data:
 *
 * 1. **No room** (F21). The schema draft gave a programme item a `room_id`; the
 *    room plug-in owns that link in a join table of its own, because a plug-in
 *    does not touch a core table. Nothing here knows a room exists.
 * 2. **No position of its own** (F40). A programme is ordered by the clock. A
 *    `sort` column beside `startsAt` would be a second ordering that can
 *    disagree with the first, and there is no third thing to break the tie
 *    between parallel sessions that a stable `(startsAt, endsAt, id)` does not
 *    already break.
 * 3. **Overlaps are data, not errors** (F41). Two sessions at the same time are
 *    what a two-track conference *is*. The organizer's view marks them; it does
 *    not refuse them. What is refused is an item outside its event's period —
 *    that one cannot be rendered on any timeline the event has.
 */

/** What a participant reads on the landing page. */
export interface PublicProgramItem {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  /** Who holds the session — a name, not an account (no user login in phase 1). */
  readonly speaker: string | null;
  /**
   * Absolute instant, ISO 8601.
   *
   * Read in the *event's* zone, never the reader's (E8). A programme item does
   * not carry a zone of its own: it happens where the event happens, and two
   * items of one event that disagreed about the zone would be unreadable.
   */
  readonly startsAt: string;
  readonly endsAt: string;
}

/** What an organizer manages. */
export interface ProgramItem extends PublicProgramItem {
  readonly eventId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Fields an organizer may set. */
export interface ProgramItemInput {
  readonly title: string;
  readonly description?: string | null;
  readonly speaker?: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
}

/**
 * Changing a programme item: any of its fields.
 *
 * Unlike a registration field, nothing here is fixed after creation. A
 * programme item has no key anything else refers to, so a session that moves an
 * hour and gets a new speaker is one edit.
 */
export type ProgramItemChange = Partial<ProgramItemInput>;

/**
 * As many items as a week-long conference with parallel tracks needs.
 *
 * A bound at all, because the endpoint that lists them is public and unbounded
 * lists are how a landing page becomes slow for everybody.
 */
export const MAX_PROGRAM_ITEMS = 300;

export const MAX_PROGRAM_TITLE_LENGTH = 200;
export const MAX_PROGRAM_DESCRIPTION_LENGTH = 2_000;
export const MAX_PROGRAM_SPEAKER_LENGTH = 200;

/**
 * One day of the programme, as a timeline renders it.
 *
 * Generic over the item, so grouping an organizer's programme does not throw
 * away what the organizer's view needs and the participant's does not.
 */
export interface ProgramDay<T extends PublicProgramItem = PublicProgramItem> {
  /** `YYYY-MM-DD` in the event's zone — sortable, not for reading. */
  readonly key: string;
  /** `14 June 2027 · CEST` — the zone named once per day, not per row. */
  readonly label: string;
  /** The items of that day, in the order they happen. */
  readonly items: readonly T[];
}

/**
 * The programme split into days as they are counted at the venue (E8).
 *
 * Here rather than in either client, because both render the same timeline and
 * a second implementation of "which day is this session on" is a defect waiting
 * for an evening session and a reader one zone to the east.
 *
 * Keyed on the start: a session that runs past midnight belongs to the day it
 * began on, which is the day somebody looked it up under.
 */
export function groupProgramByDay<T extends PublicProgramItem>(
  items: readonly T[],
  timeZone: string,
  locale = 'en',
): readonly ProgramDay<T>[] {
  const days = new Map<string, T[]>();
  for (const item of sortProgram(items)) {
    const key = dayInZone(item.startsAt, timeZone);
    const day = days.get(key);
    if (day) day.push(item);
    else days.set(key, [item]);
  }

  return [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, dayItems]) => ({
      key,
      label: `${formatDayInZone(dayItems[0].startsAt, timeZone, locale)} · ${zoneLabel(
        {
          startsAt: dayItems[0].startsAt,
          endsAt: dayItems[0].endsAt,
          timezone: timeZone,
        },
        locale,
      )}`,
      items: dayItems,
    }));
}

/**
 * The clock range of one item, in the event's zone: `09:00–10:30`.
 *
 * A thin wrapper, and worth having: every caller would otherwise have to
 * remember that the zone comes from the event and not from the item.
 */
export function formatProgramTime(
  item: PublicProgramItem,
  timeZone: string,
  locale = 'en',
): string {
  return formatClockRange(item.startsAt, item.endsAt, timeZone, locale);
}

/**
 * Which items share their time with at least one other (F41).
 *
 * For the organizer's view: parallel sessions are legitimate and a clash is
 * not, and only a person can tell the two apart. Marking them is what lets an
 * organizer notice that the keynote and the workshop were both put at 09:00 by
 * mistake — without a rule that would make a two-track programme impossible.
 *
 * Touching at the edges is not an overlap: a session ending at 10:30 and the
 * next starting at 10:30 is a programme, not a clash.
 */
export function overlappingProgramItems(
  items: readonly PublicProgramItem[],
): ReadonlySet<string> {
  const sorted = sortProgram(items);
  const clashing = new Set<string>();

  for (let index = 0; index < sorted.length; index += 1) {
    for (let other = index + 1; other < sorted.length; other += 1) {
      // Sorted by start, so once one item starts at or after this one ends, no
      // later item can overlap it either.
      if (
        Date.parse(sorted[other].startsAt) >= Date.parse(sorted[index].endsAt)
      ) {
        break;
      }
      clashing.add(sorted[index].id);
      clashing.add(sorted[other].id);
    }
  }
  return clashing;
}

/**
 * Whether an item lies inside the period it is supposed to happen in.
 *
 * The rule the server enforces on write, in the clients' hands as well: an
 * organizer who shifts an event by a day leaves items behind outside it, and
 * the programme view has to be able to say which ones (F41).
 */
export function isWithinPeriod(
  item: Pick<PublicProgramItem, 'startsAt' | 'endsAt'>,
  period: { readonly startsAt: string; readonly endsAt: string },
): boolean {
  return (
    Date.parse(item.startsAt) >= Date.parse(period.startsAt) &&
    Date.parse(item.endsAt) <= Date.parse(period.endsAt)
  );
}

/**
 * The programme in the order it happens.
 *
 * `(startsAt, endsAt, id)` — the id last, the same tiebreaker every other list
 * in this application uses, so two parallel sessions never swap between two
 * reads (F40).
 */
export function sortProgram<T extends PublicProgramItem>(
  items: readonly T[],
): readonly T[] {
  return [...items].sort(
    (left, right) =>
      Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
      Date.parse(left.endsAt) - Date.parse(right.endsAt) ||
      left.id.localeCompare(right.id),
  );
}
