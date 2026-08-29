import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_FONT_FAMILY_KEY,
  FONT_FAMILIES,
  FONT_FAMILY_KEYS,
  fontFamilyStack,
  isFontFamilyKey,
} from './fonts';
import { canonicalLocaleTag, isLocaleTag } from './app-config';
import {
  BRANDING_IMAGE_KINDS,
  BRANDING_MIME_TYPES,
  BRANDING_TYPES,
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
  isBrandingImageKind,
} from './branding';
import { UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from '../registrations/upload';
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

describe('branding images', () => {
  it('offers exactly the two kinds the configuration has columns for', () => {
    expect([...BRANDING_IMAGE_KINDS]).toEqual(['logo', 'app-icon']);

    for (const kind of BRANDING_IMAGE_KINDS) {
      expect(isBrandingImageKind(kind)).toBe(true);
    }
    for (const value of ['favicon', 'logo.png', '', null, 1]) {
      expect(isBrandingImageKind(value)).toBe(false);
    }
  });

  it('accepts only raster images a browser renders as a picture', () => {
    expect([...BRANDING_MIME_TYPES]).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);
  });

  /**
   * The one entry whose absence is a decision rather than an omission.
   *
   * An SVG is a document that may carry script, and a logo is served from the
   * origin of the client that displays it — an uploaded one would be that
   * client's own code. It is also absent from `UPLOAD_TYPES`, for the same
   * reason, and both lists have to stay that way.
   */
  it('does not accept SVG anywhere', () => {
    expect(BRANDING_MIME_TYPES).not.toContain('image/svg+xml');
    expect(UPLOAD_MIME_TYPES).not.toContain('image/svg+xml');
  });

  it('is a list of its own, not the registration form catalogue', () => {
    // The two answer different questions: what a participant may attach to a
    // form, and what may be rendered as this instance's brand. A PDF belongs in
    // the first and would be a nonsensical logo.
    expect(UPLOAD_MIME_TYPES).toContain('application/pdf');
    expect(BRANDING_MIME_TYPES).not.toContain('application/pdf');
  });

  it('gives every type a file picker filter and a name to read', () => {
    for (const type of BRANDING_TYPES) {
      expect(type.label.length).toBeGreaterThan(0);
      expect(type.extensions.length).toBeGreaterThan(0);
      for (const extension of type.extensions) {
        expect(extension.startsWith('.')).toBe(true);
      }
    }
    expect(brandingTypeSummary()).toBe('PNG, JPEG, WebP');
  });

  it('is bounded far below what a registration may carry', () => {
    // Not about disk: this image is fetched before the first paint of a
    // mobile-first client, and it is the one picture on the page that is not
    // content.
    expect(MAX_BRANDING_BYTES).toBeLessThan(MAX_UPLOAD_BYTES / 10);
  });
});

describe('canonicalLocaleTag', () => {
  it('is the one spelling everything else compares against', () => {
    // `de-AT` and `de-at` are one language: two spellings would be two sets of
    // rows for one translation and two tabs for one tab.
    expect(canonicalLocaleTag('de-AT')).toBe('de-at');
    expect(canonicalLocaleTag('  DE  ')).toBe('de');
    expect(canonicalLocaleTag('pt-BR')).toBe('pt-br');
  });

  it('answers null for anything that is not a language tag', () => {
    for (const value of ['de_DE', 'deutsch', '', ' ', '!', 42, null]) {
      expect(canonicalLocaleTag(value)).toBeNull();
    }
  });

  it('accepts exactly what isLocaleTag accepts', () => {
    for (const value of ['en', 'de', 'de-AT', 'pt-BR', 'de_DE', 'x']) {
      expect(canonicalLocaleTag(value) === null).toBe(!isLocaleTag(value));
    }
  });
});
