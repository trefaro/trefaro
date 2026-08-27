import {
  formatEventPeriod,
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
