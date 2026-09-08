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
});
