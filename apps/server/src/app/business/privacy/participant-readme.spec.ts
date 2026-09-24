import { README_KEYS, participantReadme } from './participant-readme';

const CATALOGUE = Object.fromEntries(
  README_KEYS.map((key) => [key, `[${key}]`]),
);

/**
 * The one piece of prose an archive contains (E22, AP 6 of phase 5).
 *
 * What is worth a test here is the order — a letter is read top to bottom —
 * and the one paragraph that is not always there: what the optional modules of
 * this instance store is a sentence only an instance with modules switched on
 * can say (AP 11 of phase 5).
 */
describe('the archive readme', () => {
  it('writes every paragraph, in the order somebody reads them', () => {
    const text = participantReadme(CATALOGUE, { modules: 'Forum' });

    expect(text.trimEnd().split('\n\n')).toEqual(
      README_KEYS.map((key) => `[${key}]`),
    );
  });

  it('fills the values a paragraph names', () => {
    const text = participantReadme(
      {
        ...CATALOGUE,
        'privacy.export.readme.exportedAt': 'On {{at}}, {{name}}.',
      },
      { at: '2026-09-24', name: 'Alex Nwosu', modules: 'Forum' },
    );

    expect(text).toContain('On 2026-09-24, Alex Nwosu.');
  });

  it('leaves the modules paragraph out when none is switched on', () => {
    // A sentence that names no module would be a paragraph about nothing —
    // and the reader would look for a list that does not exist.
    const text = participantReadme(CATALOGUE, { modules: '' });

    expect(text).not.toContain('[privacy.export.readme.modules]');
    expect(text.trimEnd().split('\n\n')).toHaveLength(README_KEYS.length - 1);
  });

  it('falls back to the key rather than to a gap in the letter', () => {
    // The catalogue handed in has already filled its gaps with English; a key
    // missing even there is a bug, and a visible one beats a silent one.
    const text = participantReadme({}, { modules: 'Forum' });

    expect(text).toContain('privacy.export.readme.heading');
  });
});
