import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_FONT_FAMILY_KEY,
  FONT_FAMILIES,
  FONT_FAMILY_KEYS,
  fontFamilyStack,
  isFontFamilyKey,
} from './fonts';
import { ICON_NAMES, isIconName } from './icons';
import { pluginCataloguePrefix, pluginElementId } from './plugin-descriptor';
import { isTranslationKey } from '../i18n/catalogue';
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
import { MIN_INSTALLABLE_ICON_PX, isInstallableAppIcon } from './pwa';
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

describe('an app icon a browser can install from (F105, F224)', () => {
  it('takes a square image at or above the floor', () => {
    expect(isInstallableAppIcon({ width: 512, height: 512 })).toBe(true);
    expect(
      isInstallableAppIcon({
        width: MIN_INSTALLABLE_ICON_PX,
        height: MIN_INSTALLABLE_ICON_PX,
      }),
    ).toBe(true);
  });

  it('refuses the letterhead logo, whatever its size', () => {
    // The case the design page has to explain: a wide logo is what an
    // organization has, and a home screen crops it to a square.
    expect(isInstallableAppIcon({ width: 500, height: 120 })).toBe(false);
    expect(isInstallableAppIcon({ width: 2000, height: 1999 })).toBe(false);
  });

  it('refuses a square image below the floor', () => {
    expect(
      isInstallableAppIcon({
        width: MIN_INSTALLABLE_ICON_PX - 1,
        height: MIN_INSTALLABLE_ICON_PX - 1,
      }),
    ).toBe(false);
    expect(isInstallableAppIcon({ width: 64, height: 64 })).toBe(false);
  });

  it('refuses an image nobody measured', () => {
    // A header that says nothing (F106) is not a small icon and not a wide
    // one — it is an unanswered question, and the manifest keeps the shipped
    // icons for it exactly as it does for a refused one.
    expect(isInstallableAppIcon(null)).toBe(false);
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

describe('the icon catalogue (E49)', () => {
  it('offers each name once, because a name is what a descriptor writes', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  it('uses the upstream spelling, which is what the glyph files are named', () => {
    // `snake_case`, as Material Symbols writes it. Not a style preference: the
    // names were copied out of the package together with the path data, and a
    // name spelled our way would be one nobody could look up.
    for (const name of ICON_NAMES) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('answers for a name it does not draw instead of assuming', () => {
    for (const name of ICON_NAMES) {
      expect(isIconName(name)).toBe(true);
    }
    // A withdrawn glyph, a typo in a descriptor, a name from a newer image —
    // all the same answer, and all of them reach this from outside TypeScript.
    for (const value of ['meeting-room', 'MEETING_ROOM', '', null, 42, {}]) {
      expect(isIconName(value)).toBe(false);
    }
  });

  /**
   * The other half of "no entry without its glyph".
   *
   * `ICON_PATHS` is typed as a complete record over `IconName`, so the compiler
   * already refuses a missing or a surplus name — but nothing type-checks the
   * *content*, and an empty string would be a name that draws nothing while
   * looking declared. Read as a file rather than imported, because this library
   * may not depend on `shared-theming` (models pull in nothing).
   */
  it('has real path data behind every name it offers', () => {
    const paths = readFileSync(
      join(__dirname, '../../../../shared-theming/src/lib/icon-paths.ts'),
      'utf8',
    );

    // `M` or `m`: a path starts with a moveto, and whether the optimizer made
    // it absolute or relative is not this test's business — `close` arrived
    // in AP 7 of phase 5 with a relative one, and the glyphs are vendored
    // unmodified.
    for (const name of ICON_NAMES) {
      const declaration = new RegExp(`\\b${name}:\\s*\\n?\\s*'[Mm]`);
      expect(declaration.test(paths)).toBe(true);
    }
  });
});

describe('a plug-in key and the words that belong to it', () => {
  it('gives every plug-in a catalogue prefix of its own (E48)', () => {
    expect(pluginCataloguePrefix('forum')).toBe('plugins.forum.');
    expect(pluginCataloguePrefix('room-planning')).toBe(
      'plugins.roomPlanning.',
    );
    expect(pluginCataloguePrefix('program-proposals')).toBe(
      'plugins.programProposals.',
    );
  });

  it('produces a legal translation key, which a dashed key would not', () => {
    // The reason the prefix is camelCased at all (F70): `plugins.room-planning.`
    // is not a key this application can store, translate or export.
    for (const key of ['forum', 'room-planning', 'qr-checkin']) {
      expect(isTranslationKey(`${pluginCataloguePrefix(key)}title`)).toBe(true);
    }
  });

  it('keeps the jump target and the prefix independent of each other', () => {
    // Two derived strings from one key, and they are deliberately not the same
    // shape: the element id is a DOM id (dashes allowed), the prefix is a
    // catalogue key (dashes not).
    expect(pluginElementId('room-planning')).toBe('plugin-room-planning');
  });
});
