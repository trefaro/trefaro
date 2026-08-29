import { BadRequestException } from '@nestjs/common';
import { LocaleQueryPipe } from './locale-query.pipe';

describe('LocaleQueryPipe', () => {
  const pipe = new LocaleQueryPipe();

  it('reads an absent parameter as “the originals”', () => {
    // Query parameters arrive as `undefined` whatever a client's default says.
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform('')).toBeUndefined();
  });

  it('lower-cases, so de-AT and de-at reach one set of rows', () => {
    expect(pipe.transform('de-AT')).toBe('de-at');
    expect(pipe.transform('  de  ')).toBe('de');
  });

  it('passes a language nobody has translated into', () => {
    // Not an error: a link somebody shared last year has to keep working, and a
    // language that is not offered any more renders the originals.
    expect(pipe.transform('fr')).toBe('fr');
  });

  it('refuses something that is not a language tag', () => {
    // Nothing but a broken caller produces these, and answering with the
    // English page would hide the bug behind a page that looks right.
    for (const value of ['de_DE', 'deutsch bitte', '!', 'x'.repeat(40)]) {
      expect(() => pipe.transform(value)).toThrow(BadRequestException);
    }
  });
});
