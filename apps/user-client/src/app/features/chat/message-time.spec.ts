import {
  conversationTime,
  messageClock,
  messageDay,
  sameDay,
} from './message-time';

/**
 * When a message was written (FR 4.5, F78).
 *
 * The assertions are deliberately about shape and about difference rather
 * than about exact strings: the formatted output depends on the zone the test
 * process runs in, and pinning "18:40" would be a test about a CI machine's
 * `TZ`. What has to hold is that a clock is a clock, that a day is a day, and
 * that both follow the reader's language.
 */
describe('message time', () => {
  const iso = '2026-06-15T16:40:00.000Z';

  it('writes a clock without an am/pm, in every language', () => {
    // `hourCycle: 'h23'`, like every other time in this application.
    expect(messageClock(iso, 'en')).toMatch(/^\d{1,2}:\d{2}$/);
    expect(messageClock(iso, 'de')).toMatch(/^\d{1,2}:\d{2}$/);
  });

  it('writes a day that names its year', () => {
    expect(messageDay(iso, 'en')).toContain('2026');
  });

  it('says the day in the reader’s language, not in English', () => {
    // Format is not translation (F78): the same instant, two languages, two
    // spellings — and the zone stays the reader's own, because a message
    // belongs to no event (E8 is about events).
    expect(messageDay(iso, 'de')).not.toBe(messageDay(iso, 'en'));
  });

  describe('conversationTime', () => {
    it('shows the clock while the conversation moved today', () => {
      const now = new Date(iso);

      expect(conversationTime(iso, 'en', now)).toBe(messageClock(iso, 'en'));
    });

    it('shows a date once it did not', () => {
      const later = new Date('2026-06-20T09:00:00.000Z');

      const shown = conversationTime(iso, 'en', later);
      expect(shown).not.toBe(messageClock(iso, 'en'));
      expect(shown).toContain('2026');
    });
  });

  describe('sameDay', () => {
    it('is true across the hours of one local day', () => {
      expect(
        sameDay(new Date(2026, 5, 15, 0, 1), new Date(2026, 5, 15, 23, 59)),
      ).toBe(true);
    });

    it('is false one minute later', () => {
      // Compared field by field rather than by dividing timestamps: a local day
      // is not always 24 hours long.
      expect(
        sameDay(new Date(2026, 5, 15, 23, 59), new Date(2026, 5, 16, 0, 0)),
      ).toBe(false);
    });

    it('does not confuse the same day of two months or years', () => {
      expect(sameDay(new Date(2026, 5, 15), new Date(2026, 6, 15))).toBe(false);
      expect(sameDay(new Date(2025, 5, 15), new Date(2026, 5, 15))).toBe(false);
    });
  });
});
