import { clock, day, when } from './when';

const ISO = '2027-06-14T07:05:00.000Z';

/**
 * Instants in the reader's language and their own zone.
 *
 * Three shapes for three screens — a date alone (a proposal was handed in on
 * a day), date and time (a post in a conversation), a time alone (a slot in a
 * room plan). None of them is the exception to E8 it looks like: E8 is about
 * an event's times, which have a place; when somebody wrote something has
 * none, and a room plan's slots are rendered next to the event's own times.
 */
describe('formatting an instant', () => {
  it('renders date and time in the given language', () => {
    expect(when('de', ISO)).toMatch(/14\.06\.2027/);
    expect(when('de', ISO)).toMatch(/\d{2}:\d{2}/);
  });

  it('renders the day alone, and the clock alone', () => {
    expect(day('en-GB', ISO)).toBe('14 Jun 2027');
    expect(clock('en-GB', ISO)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('does not empty a row for a language tag Intl refuses', () => {
    // A misconfigured instance must not make every timestamp vanish.
    expect(when('not a tag', ISO)).toBe('2027-06-14 07:05');
    expect(day('not a tag', ISO)).toBe('2027-06-14');
    expect(clock('not a tag', ISO)).toBe('07:05');
  });

  describe("in an event's own zone (E69)", () => {
    // 07:05 UTC is 09:05 in Berlin and 03:05 in Toronto. Whoever reads it,
    // a session of a Berlin event runs at 09:05 (E8).
    it('renders the clock of the zone it is handed, not the machine’s', () => {
      expect(clock('en-GB', ISO, 'Europe/Berlin')).toBe('09:05');
      expect(clock('en-GB', ISO, 'America/Toronto')).toBe('03:05');
    });

    it('moves the day with the zone, which is what a day heading needs', () => {
      const lateEvening = '2027-06-14T22:30:00.000Z';
      expect(day('en-GB', lateEvening, 'Europe/Berlin')).toBe('15 Jun 2027');
      expect(day('en-GB', lateEvening, 'America/Toronto')).toBe('14 Jun 2027');
    });

    it('carries the zone through date and time together', () => {
      expect(when('en-GB', ISO, 'Europe/Berlin')).toMatch(/09:05/);
    });

    it('keeps the reader’s own clock when no zone is handed over', () => {
      // The three bundles that draw *when something happened* pass none, and
      // that stays right: a post in a conversation has no venue.
      expect(clock('en-GB', ISO)).toMatch(/^\d{2}:\d{2}$/);
    });

    it('falls back to the plain instant rather than to a wrong clock', () => {
      // An unknown zone is a broken instance, and the honest answer is the
      // instant as written. Silently dropping the zone would draw the
      // reader's clock — the very bug this parameter exists against.
      expect(clock('en-GB', ISO, 'Mars/Olympus')).toBe('07:05');
      expect(day('en-GB', ISO, 'Mars/Olympus')).toBe('2027-06-14');
      expect(when('en-GB', ISO, 'Mars/Olympus')).toBe('2027-06-14 07:05');
    });
  });
});
