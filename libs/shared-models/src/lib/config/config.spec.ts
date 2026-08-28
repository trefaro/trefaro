import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_FONT_FAMILY_KEY,
  FONT_FAMILIES,
  FONT_FAMILY_KEYS,
  fontFamilyStack,
  isFontFamilyKey,
} from './fonts';
import { isHexColor } from './theme';

describe('isHexColor', () => {
  it('accepts the two notations an organization may store (E17)', () => {
    for (const value of ['#123456', '#abc', '#ABCDEF', '#FFF']) {
      expect(isHexColor(value)).toBe(true);
    }
  });

  it('refuses everything readableTextColor cannot weigh', () => {
    // Each of these is valid CSS and would render — which is the danger: the
    // text colour on top of it would silently be the wrong one.
    for (const value of [
      'red',
      'rgba(0, 0, 0, .5)',
      'rgb(31, 111, 92)',
      'oklch(55% 0.1 160)',
      '#1f6f5c80',
      '1f6f5c',
      '#12345',
      '#1f6f5c ',
      '',
    ]) {
      expect(isHexColor(value)).toBe(false);
    }
  });

  it('refuses values that are not strings at all', () => {
    for (const value of [null, undefined, 16711680, {}]) {
      expect(isHexColor(value)).toBe(false);
    }
  });
});

describe('the font catalogue (E18)', () => {
  it('has a unique key per family, because the key is what gets stored', () => {
    expect(new Set(FONT_FAMILY_KEYS).size).toBe(FONT_FAMILIES.length);
  });

  it('offers the family that needs no download first, and by default', () => {
    expect(FONT_FAMILIES[0].key).toBe(DEFAULT_FONT_FAMILY_KEY);
    expect(fontFamilyStack(DEFAULT_FONT_FAMILY_KEY)).not.toContain("'");
  });

  it('ends every stack in a generic family, so a missing file still renders', () => {
    for (const font of FONT_FAMILIES) {
      expect(font.stack).toMatch(/(sans-serif|serif|monospace)$/);
    }
  });

  it('falls back rather than throwing for a key that is no longer known', () => {
    expect(fontFamilyStack('a-family-we-withdrew')).toBe(
      fontFamilyStack(DEFAULT_FONT_FAMILY_KEY),
    );
    expect(isFontFamilyKey('a-family-we-withdrew')).toBe(false);
  });

  /**
   * The catalogue and the stylesheet are two files that have to agree, and
   * nothing but this test makes them. A family offered in the design settings
   * whose `@font-face` is missing renders as the fallback — a bug that looks
   * like an opinion about typography.
   */
  it('declares every family it offers in the bundled stylesheet', () => {
    const stylesheet = readFileSync(
      join(__dirname, '../../../../shared-theming/assets/fonts.css'),
      'utf8',
    );

    for (const font of FONT_FAMILIES) {
      if (font.key === DEFAULT_FONT_FAMILY_KEY) continue;

      const quoted = font.stack.split(',')[0].trim();
      expect(stylesheet).toContain(`font-family: ${quoted};`);
    }
  });
});
