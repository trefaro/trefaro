import {
  isEmptyTranslation,
  translatedText,
  type EventTranslation,
} from './content';

describe('translatedText', () => {
  it('trims, because a translation is a text and not its whitespace', () => {
    expect(translatedText('  Klimakonferenz  ')).toBe('Klimakonferenz');
  });

  it('reads an emptied box as “no translation”, not as an empty text', () => {
    // The same rule the interface catalogue follows (F74). Otherwise "I cleared
    // this" and "I never filled this in" would be two states with one visible
    // result, and every list that counts languages would count a row that says
    // nothing.
    expect(translatedText('')).toBeNull();
    expect(translatedText('   ')).toBeNull();
    expect(translatedText(null)).toBeNull();
    expect(translatedText(undefined)).toBeNull();
  });
});

describe('isEmptyTranslation', () => {
  const nothing: EventTranslation = {
    name: null,
    description: null,
    venueName: null,
    followUpBody: null,
  };

  it('is true when every field says “use the original”', () => {
    expect(isEmptyTranslation(nothing)).toBe(true);
  });

  it('is false as soon as one field says something', () => {
    expect(isEmptyTranslation({ ...nothing, venueName: 'Rathaus' })).toBe(
      false,
    );
  });
});
