import type { PublicProgramItem } from './program';
import {
  formatProgramTime,
  groupProgramByDay,
  isWithinPeriod,
  overlappingProgramItems,
  sortProgram,
} from './program';

/**
 * The programme helpers (FR 3.7, F40, F41).
 *
 * Both clients render the same timeline from these, so what is asserted here is
 * what the acceptance criterion of AP 8 means by "in the event's zone": the day
 * an item is grouped under and the clock it shows are the venue's, not the
 * reader's.
 */
const item = (
  id: string,
  startsAt: string,
  endsAt: string,
): PublicProgramItem => ({
  id,
  title: id,
  description: null,
  speaker: null,
  startsAt,
  endsAt,
});

describe('sortProgram', () => {
  it('orders by start, then by end, then by id', () => {
    const later = item(
      'b',
      '2027-06-14T10:00:00.000Z',
      '2027-06-14T11:00:00.000Z',
    );
    const shorter = item(
      'c',
      '2027-06-14T09:00:00.000Z',
      '2027-06-14T09:30:00.000Z',
    );
    const longer = item(
      'a',
      '2027-06-14T09:00:00.000Z',
      '2027-06-14T10:00:00.000Z',
    );

    expect(
      sortProgram([later, longer, shorter]).map((entry) => entry.id),
    ).toEqual(['c', 'a', 'b']);
  });

  it('breaks a full tie by id, so two reads agree', () => {
    const second = item(
      'z',
      '2027-06-14T09:00:00.000Z',
      '2027-06-14T10:00:00.000Z',
    );
    const first = item(
      'a',
      '2027-06-14T09:00:00.000Z',
      '2027-06-14T10:00:00.000Z',
    );

    expect(sortProgram([second, first]).map((entry) => entry.id)).toEqual([
      'a',
      'z',
    ]);
    expect(sortProgram([first, second]).map((entry) => entry.id)).toEqual([
      'a',
      'z',
    ]);
  });

  it('leaves the input untouched', () => {
    const items = [
      item('b', '2027-06-14T10:00:00.000Z', '2027-06-14T11:00:00.000Z'),
      item('a', '2027-06-14T09:00:00.000Z', '2027-06-14T10:00:00.000Z'),
    ];
    sortProgram(items);
    expect(items.map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('groupProgramByDay', () => {
  it('counts days at the venue, not at the reader', () => {
    // 23:30 in Cologne on the 14th is 21:30 UTC — a reader in UTC would call
    // this the same evening, and a reader in Tokyo the next morning.
    const days = groupProgramByDay(
      [item('night', '2027-06-14T21:30:00.000Z', '2027-06-14T22:30:00.000Z')],
      'Europe/Berlin',
    );

    expect(days).toHaveLength(1);
    expect(days[0].key).toBe('2027-06-14');
  });

  it('splits an event that runs over two days at the venue', () => {
    const days = groupProgramByDay(
      [
        item('evening', '2027-06-14T20:00:00.000Z', '2027-06-14T21:00:00.000Z'),
        item('morning', '2027-06-15T07:00:00.000Z', '2027-06-15T08:00:00.000Z'),
      ],
      'Europe/Berlin',
    );

    expect(days.map((day) => day.key)).toEqual(['2027-06-14', '2027-06-15']);
    expect(days[1].items.map((entry) => entry.id)).toEqual(['morning']);
  });

  it('names the zone in the heading, once per day', () => {
    const days = groupProgramByDay(
      [item('talk', '2027-06-14T07:00:00.000Z', '2027-06-14T08:00:00.000Z')],
      'Europe/Berlin',
    );

    expect(days[0].label).toContain('June 14, 2027');
    expect(days[0].label).toContain('GMT+2');
  });

  it('keeps a session that runs past midnight on the day it began', () => {
    const days = groupProgramByDay(
      [item('party', '2027-06-14T21:00:00.000Z', '2027-06-14T23:30:00.000Z')],
      'Europe/Berlin',
    );

    // 23:00 to 01:30 local — one day, the one somebody looked it up under.
    expect(days).toHaveLength(1);
    expect(days[0].key).toBe('2027-06-14');
  });

  it('orders the days chronologically whatever order the items arrive in', () => {
    const days = groupProgramByDay(
      [
        item(
          'second-day',
          '2027-06-15T07:00:00.000Z',
          '2027-06-15T08:00:00.000Z',
        ),
        item(
          'first-day',
          '2027-06-14T07:00:00.000Z',
          '2027-06-14T08:00:00.000Z',
        ),
      ],
      'Europe/Berlin',
    );

    expect(days.map((day) => day.key)).toEqual(['2027-06-14', '2027-06-15']);
  });

  it('is empty for an event with no programme yet', () => {
    expect(groupProgramByDay([], 'Europe/Berlin')).toEqual([]);
  });
});

describe('formatProgramTime', () => {
  it('reads the clock in the event zone', () => {
    expect(
      formatProgramTime(
        item('talk', '2027-06-14T07:00:00.000Z', '2027-06-14T08:30:00.000Z'),
        'Europe/Berlin',
      ),
    ).toBe('09:00–10:30');
  });

  it('is the venue clock even for a reader far away', () => {
    expect(
      formatProgramTime(
        item('talk', '2027-06-14T07:00:00.000Z', '2027-06-14T08:30:00.000Z'),
        'America/New_York',
      ),
    ).toBe('03:00–04:30');
  });
});

describe('overlappingProgramItems', () => {
  it('finds both sides of a clash', () => {
    const clashing = overlappingProgramItems([
      item('keynote', '2027-06-14T07:00:00.000Z', '2027-06-14T08:00:00.000Z'),
      item('workshop', '2027-06-14T07:30:00.000Z', '2027-06-14T09:00:00.000Z'),
    ]);

    expect([...clashing].sort()).toEqual(['keynote', 'workshop']);
  });

  it('does not call touching edges an overlap', () => {
    const clashing = overlappingProgramItems([
      item('first', '2027-06-14T07:00:00.000Z', '2027-06-14T08:00:00.000Z'),
      item('second', '2027-06-14T08:00:00.000Z', '2027-06-14T09:00:00.000Z'),
    ]);

    expect(clashing.size).toBe(0);
  });

  it('finds an item fully inside another', () => {
    const clashing = overlappingProgramItems([
      item('all-day', '2027-06-14T07:00:00.000Z', '2027-06-14T15:00:00.000Z'),
      item('lunch', '2027-06-14T10:00:00.000Z', '2027-06-14T11:00:00.000Z'),
    ]);

    expect([...clashing].sort()).toEqual(['all-day', 'lunch']);
  });

  it('leaves a session that neither touches nor is touched alone', () => {
    const clashing = overlappingProgramItems([
      item('a', '2027-06-14T07:00:00.000Z', '2027-06-14T08:00:00.000Z'),
      item('b', '2027-06-14T07:30:00.000Z', '2027-06-14T08:30:00.000Z'),
      item('c', '2027-06-14T12:00:00.000Z', '2027-06-14T13:00:00.000Z'),
    ]);

    expect(clashing.has('c')).toBe(false);
    expect(clashing.size).toBe(2);
  });
});

describe('isWithinPeriod', () => {
  const event = {
    startsAt: '2027-06-14T06:00:00.000Z',
    endsAt: '2027-06-14T16:00:00.000Z',
  };

  it('accepts an item that fills the event exactly', () => {
    expect(isWithinPeriod(item('x', event.startsAt, event.endsAt), event)).toBe(
      true,
    );
  });

  it('refuses one that starts before the event', () => {
    expect(
      isWithinPeriod(
        item('early', '2027-06-14T05:59:00.000Z', '2027-06-14T07:00:00.000Z'),
        event,
      ),
    ).toBe(false);
  });

  it('refuses one that ends after the event', () => {
    expect(
      isWithinPeriod(
        item('late', '2027-06-14T15:00:00.000Z', '2027-06-14T16:01:00.000Z'),
        event,
      ),
    ).toBe(false);
  });
});
