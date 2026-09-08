import { wordsOf } from './words';

/**
 * A plug-in's words, out of what the host handed over (E48).
 *
 * What a bundle receives is a flat map of its own catalogue keys with the
 * prefix stripped; what it must show for a key the host has nothing for is
 * the full key — the same thing a missing translation looks like everywhere
 * else in this application.
 */
describe('wordsOf', () => {
  const { word, statusWord } = wordsOf('room-planning');

  it('reads a word the host handed over', () => {
    expect(word({ title: 'Raumplan' }, 'title')).toBe('Raumplan');
  });

  it('falls back to the full catalogue key, prefix derived from the plug-in key', () => {
    // A host older than plug-in API 1.2.0 assigns no strings at all; the
    // bundle then says what it is missing instead of rendering empty boxes.
    expect(word({}, 'title')).toBe('plugins.roomPlanning.title');
  });

  it('turns a status into its word, one key per state (E51)', () => {
    const strings = { statusPending: 'Ausstehend', statusApproved: 'Frei' };

    expect(statusWord(strings, 'pending')).toBe('Ausstehend');
    expect(statusWord(strings, 'approved')).toBe('Frei');
    expect(statusWord(strings, 'rejected')).toBe(
      'plugins.roomPlanning.statusRejected',
    );
  });
});
