import {
  dayInZone,
  formatClockRange,
  formatDayInZone,
  formatEventPeriod,
  formatInstant,
  hasEnded,
  instantToWallClock,
  isTimeZone,
  wallClockToInstant,
} from './event-time';

/**
 * The time helper both clients render events with (E8).
 *
 * The cases that matter are the ones a manual test never hits: the two days a
 * year a zone changes its offset, and an event that spans one of them.
 */
describe('event time', () => {
  describe('wallClockToInstant', () => {
    it('reads a winter time as CET', () => {
      expect(wallClockToInstant('2027-01-14T09:00', 'Europe/Berlin')).toBe(
        '2027-01-14T08:00:00.000Z',
      );
    });

    it('reads a summer time as CEST', () => {
      expect(wallClockToInstant('2027-07-14T09:00', 'Europe/Berlin')).toBe(
        '2027-07-14T07:00:00.000Z',
      );
    });

    it('gets the morning of the switch to summer time right', () => {
      // Europe/Berlin springs forward at 02:00 on 28 March 2027. An event that
      // starts at 09:00 that morning is already on CEST — a single-pass offset
      // guess would put it an hour out.
      expect(wallClockToInstant('2027-03-28T09:00', 'Europe/Berlin')).toBe(
        '2027-03-28T07:00:00.000Z',
      );
    });

    it('handles a zone with a half-hour offset', () => {
      expect(wallClockToInstant('2027-03-14T09:00', 'Asia/Kolkata')).toBe(
        '2027-03-14T03:30:00.000Z',
      );
    });

    it('rejects anything that is not a wall-clock value', () => {
      expect(() => wallClockToInstant('2027-03-14', 'UTC')).toThrow(RangeError);
    });

    it('round-trips through instantToWallClock', () => {
      const wall = '2027-10-31T02:30';
      const instant = wallClockToInstant(wall, 'Europe/Berlin');

      expect(instantToWallClock(instant, 'Europe/Berlin')).toBe(wall);
    });
  });

  describe('formatEventPeriod', () => {
    it('collapses a single-day event to one date and two times', () => {
      const text = formatEventPeriod({
        startsAt: '2027-03-14T08:00:00.000Z',
        endsAt: '2027-03-14T16:00:00.000Z',
        timezone: 'Europe/Berlin',
      });

      expect(text).toBe('March 14, 2027, 09:00–17:00 GMT+1');
    });

    it('names both days when an event spans several', () => {
      const text = formatEventPeriod({
        startsAt: '2027-03-14T08:00:00.000Z',
        endsAt: '2027-03-16T15:00:00.000Z',
        timezone: 'Europe/Berlin',
      });

      expect(text).toBe('March 14, 2027, 09:00 – March 16, 2027, 16:00 GMT+1');
    });

    it('renders in the event zone, not the reader zone', () => {
      const period = {
        startsAt: '2027-03-14T08:00:00.000Z',
        endsAt: '2027-03-14T16:00:00.000Z',
        timezone: 'America/New_York',
      };

      // Same instant as the CET case above, four hours earlier on the clock.
      expect(formatEventPeriod(period)).toContain('04:00–12:00');
    });
  });

  describe('hasEnded', () => {
    const period = { endsAt: '2027-03-14T16:00:00.000Z' };

    it('is false while the event is still running', () => {
      expect(hasEnded(period, Date.parse('2027-03-14T09:00:00.000Z'))).toBe(
        false,
      );
    });

    it('is true once the end has passed', () => {
      expect(hasEnded(period, Date.parse('2027-03-14T16:00:01.000Z'))).toBe(
        true,
      );
    });
  });

  describe('formatInstant', () => {
    it("reads a registration's timestamp in the event's zone, not the reader's", () => {
      const arrived = '2026-08-24T22:30:00.000Z';

      // Half past midnight on the 25th in Berlin, half past one in the morning
      // on the 25th in Nairobi — and still the 24th in New York. The organizer
      // is entitled to the event's clock (E8).
      expect(formatInstant(arrived, 'Europe/Berlin')).toContain('25');
      expect(formatInstant(arrived, 'America/New_York')).toContain('24');
    });

    it('spells out date and time without a weekday', () => {
      expect(formatInstant('2026-08-24T09:30:00.000Z', 'UTC')).toBe(
        'Aug 24, 2026, 09:30',
      );
    });
  });

  describe('dayInZone', () => {
    it('gives a sortable key in the venue’s reckoning', () => {
      expect(dayInZone('2027-06-14T21:30:00.000Z', 'Europe/Berlin')).toBe(
        '2027-06-14',
      );
    });

    it('is the next day already where the venue is far enough east', () => {
      // 23:30 UTC is half past eight the following morning in Tokyo — the day a
      // programme item is grouped under has to be the venue’s (E8).
      expect(dayInZone('2027-06-14T23:30:00.000Z', 'Asia/Tokyo')).toBe(
        '2027-06-15',
      );
    });

    it('pads the parts, so the key sorts as a string', () => {
      expect(dayInZone('2027-01-05T12:00:00.000Z', 'UTC')).toBe('2027-01-05');
    });
  });

  describe('formatDayInZone', () => {
    it('spells the day out for a heading', () => {
      expect(formatDayInZone('2027-06-14T07:00:00.000Z', 'Europe/Berlin')).toBe(
        'June 14, 2027',
      );
    });
  });

  describe('formatClockRange', () => {
    it('reads both ends in the given zone', () => {
      expect(
        formatClockRange(
          '2027-06-14T07:00:00.000Z',
          '2027-06-14T08:30:00.000Z',
          'Europe/Berlin',
        ),
      ).toBe('09:00–10:30');
    });

    it('stays on a 24-hour clock, whatever the locale prefers', () => {
      expect(
        formatClockRange(
          '2027-06-14T12:00:00.000Z',
          '2027-06-14T13:00:00.000Z',
          'UTC',
          'en-US',
        ),
      ).toBe('12:00–13:00');
    });

    it('crosses midnight without pretending it did not', () => {
      // A session running into the small hours reads 23:00–01:30; the day it
      // belongs to is decided by `dayInZone`, not by this.
      expect(
        formatClockRange(
          '2027-06-14T21:00:00.000Z',
          '2027-06-14T23:30:00.000Z',
          'Europe/Berlin',
        ),
      ).toBe('23:00–01:30');
    });
  });

  describe('isTimeZone', () => {
    it('accepts an IANA zone', () => {
      expect(isTimeZone('Europe/Berlin')).toBe(true);
      expect(isTimeZone('UTC')).toBe(true);
    });

    it('rejects a made-up one', () => {
      expect(isTimeZone('Europe/Atlantis')).toBe(false);
      expect(isTimeZone('')).toBe(false);
    });
  });
});
