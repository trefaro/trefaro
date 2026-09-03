import { initialsOf } from './initials';

/**
 * The stand-in for a missing picture (F138).
 *
 * Four screens draw it, so what it does with the awkward inputs belongs in one
 * place: an empty field, a name of one word, more fields than letters.
 */
describe('initialsOf', () => {
  it('takes one letter from each of the first two fields', () => {
    expect(initialsOf(['Amina', 'Okonkwo'], 'en')).toBe('AO');
  });

  it('skips an empty field rather than leaving a gap', () => {
    expect(initialsOf(['', 'Okonkwo'], 'en')).toBe('O');
    expect(initialsOf(['   ', ' Bo '], 'en')).toBe('B');
  });

  it('keeps a two-word field to one letter', () => {
    // What makes the fields the argument rather than one joined string: the
    // second letter belongs to the family name, not to a middle name.
    expect(initialsOf(['Mary Jane', 'Smith'], 'en')).toBe('MS');
  });

  it('never grows past two letters', () => {
    expect(initialsOf(['Anna', 'Bo', 'Chen'], 'en')).toBe('AB');
  });

  it('answers nothing for a name nobody filled in', () => {
    expect(initialsOf([], 'en')).toBe('');
    expect(initialsOf([''], 'en')).toBe('');
  });

  it('uppercases in the reader’s language, not in English', () => {
    // Turkish dotless i: `toUpperCase()` would answer `I`.
    expect(initialsOf(['irem'], 'tr')).toBe('İ');
  });

  it('counts a character, not a code unit', () => {
    // An emoji or a surrogate pair must not be cut in half.
    expect(initialsOf(['😀manda'], 'en')).toBe('😀');
  });
});
