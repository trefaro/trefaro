import { MAX_SLUG_LENGTH, isSlug, slugify } from './slug';

describe('slugify', () => {
  it('lowercases and joins words with hyphens', () => {
    expect(slugify('Climate Conference 2027')).toBe('climate-conference-2027');
  });

  it('transliterates German rather than stripping it', () => {
    // "brgerrte" would be the result of dropping the umlauts, and it is useless.
    expect(slugify('Bürgerräte für Europa')).toBe('buergerraete-fuer-europa');
    expect(slugify('Straße der Demokratie')).toBe('strasse-der-demokratie');
  });

  it('drops other diacritics the conventional way', () => {
    expect(slugify('Café Européen')).toBe('cafe-europeen');
  });

  it('collapses punctuation and trims the edges', () => {
    expect(slugify('  --Democracy: now! (2027)--  ')).toBe(
      'democracy-now-2027',
    );
  });

  it('never ends on a hyphen, even when the cut lands on one', () => {
    const slug = slugify(`${'a'.repeat(MAX_SLUG_LENGTH - 1)} bcd`);

    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns nothing usable rather than guessing for a non-Latin name', () => {
    expect(slugify('Демократия')).toBe('');
  });
});

describe('isSlug', () => {
  it.each(['climate-2027', 'a', 'a1-b2-c3'])('accepts "%s"', (value) => {
    expect(isSlug(value)).toBe(true);
  });

  it.each([
    '',
    '-leading',
    'trailing-',
    'double--hyphen',
    'Upper',
    'has space',
    'ü',
  ])('rejects "%s"', (value) => {
    expect(isSlug(value)).toBe(false);
  });
});
