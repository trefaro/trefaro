import type { Theme } from '@trefaro/shared-models';
import {
  MIN_DERIVED_TEXT_CONTRAST,
  MIN_SURFACE_CONTRAST,
  MIN_TEXT_CONTRAST,
  PAGE_BACKGROUND_COLOR,
  contrastRatio,
  deriveThemeVariables,
  readableTextColor,
} from './theme-variables';

const theme: Theme = {
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
  logoUrl: '/api/media/branding/logo?v=1787790100000',
  fontFamily: "'Inter', sans-serif",
};

describe('deriveThemeVariables', () => {
  it('publishes both brand colours unchanged', () => {
    const variables = deriveThemeVariables(theme);

    expect(variables['--trefaro-color-primary']).toBe('#1f6f5c');
    expect(variables['--trefaro-color-accent']).toBe('#e8a33d');
  });

  it('derives shades from the variable, so changing the base updates them all', () => {
    const variables = deriveThemeVariables(theme);

    for (const key of [
      '--trefaro-color-primary-soft',
      '--trefaro-color-primary-muted',
      '--trefaro-color-primary-strong',
    ]) {
      expect(variables[key]).toContain('var(--trefaro-color-primary)');
      expect(variables[key]).toContain('in oklab');
    }
  });

  it('wraps a logo in url() and uses none when there is no logo', () => {
    expect(deriveThemeVariables(theme)['--trefaro-logo-url']).toBe(
      'url("/api/media/branding/logo?v=1787790100000")',
    );
    expect(
      deriveThemeVariables({ ...theme, logoUrl: null })['--trefaro-logo-url'],
    ).toBe('none');
  });
});

describe('readableTextColor', () => {
  it('puts white text on dark brand colours', () => {
    for (const dark of ['#1f6f5c', '#000000', '#123', 'rgb(20, 30, 40)']) {
      expect(readableTextColor(dark)).toBe('#ffffff');
    }
  });

  it('puts black text on light brand colours', () => {
    for (const light of ['#ffffff', '#e8a33d', '#ffe', 'rgb(250, 240, 100)']) {
      expect(readableTextColor(light)).toBe('#000000');
    }
  });

  it('reads shorthand hex the same as its long form', () => {
    expect(readableTextColor('#fff')).toBe(readableTextColor('#ffffff'));
    expect(readableTextColor('#036')).toBe(readableTextColor('#003366'));
  });

  it('ignores an alpha channel, which does not change perceived text contrast here', () => {
    expect(readableTextColor('#ffffff80')).toBe('#000000');
    expect(readableTextColor('rgba(0, 0, 0, 0.5)')).toBe('#ffffff');
  });

  it('accepts percentage rgb channels', () => {
    expect(readableTextColor('rgb(100%, 100%, 100%)')).toBe('#000000');
  });

  it('falls back to white for a notation it cannot parse', () => {
    for (const unparsable of [
      'rebeccapurple',
      'oklch(70% 0.1 200)',
      '',
      'nope',
    ]) {
      expect(readableTextColor(unparsable)).toBe('#ffffff');
    }
  });

  it('is case insensitive', () => {
    expect(readableTextColor('#FFFFFF')).toBe('#000000');
  });
});

describe('contrastRatio', () => {
  it('spans the WCAG range', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('does not care which colour is named first', () => {
    expect(contrastRatio('#1f6f5c', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#1f6f5c'),
      10,
    );
  });

  it('agrees with the published ratio of a known pair', () => {
    // #767676 on white is the canonical "just passes 4.5:1" grey.
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(MIN_TEXT_CONTRAST);
  });

  it('reads a colour it cannot parse as the worst case, so a hint appears', () => {
    // 1 is "identical colours", which is what every threshold compares as a
    // failure. An accessibility hint that errs has to err towards being shown.
    expect(contrastRatio('rebeccapurple', '#ffffff')).toBe(1);
    expect(contrastRatio('#ffffff', 'oklch(70% 0.1 200)')).toBe(1);
  });
});

describe('the contrast the theme guarantees', () => {
  /**
   * The point of {@link MIN_DERIVED_TEXT_CONTRAST}: no brand colour can produce
   * unreadable text *on* itself, because the text colour is picked at the
   * crossover point. This is what makes a "text on your colour is too pale"
   * hint on the design page unreachable — and therefore a hint that must not be
   * written as if it could fire.
   */
  it('never puts text below 4.5:1 on a brand colour, whatever the colour', () => {
    expect(MIN_DERIVED_TEXT_CONTRAST).toBeGreaterThan(MIN_TEXT_CONTRAST);

    // A sweep rather than a handful of samples: the minimum sits at one exact
    // luminance, and a few favourite colours would step right over it.
    for (let step = 0; step <= 255; step += 1) {
      const grey = `#${step.toString(16).padStart(2, '0').repeat(3)}`;
      expect(
        contrastRatio(grey, readableTextColor(grey)),
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }

    for (const colour of [
      '#1f6f5c',
      '#e8a33d',
      '#ffe066',
      '#7d7d7d',
      '#767676',
      '#787878',
      '#0000ff',
      '#00ff00',
    ]) {
      expect(
        contrastRatio(colour, readableTextColor(colour)),
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  /**
   * And the point of {@link MIN_SURFACE_CONTRAST}: what the theme cannot decide
   * for an organization is whether the coloured surface is distinguishable from
   * the page it sits on. A near-white primary makes the sidebar and every
   * button vanish, and no derived text colour can repair that.
   */
  it('leaves a pale brand colour indistinguishable from the page', () => {
    expect(contrastRatio('#f2f2f2', PAGE_BACKGROUND_COLOR)).toBeLessThan(
      MIN_SURFACE_CONTRAST,
    );
    expect(
      contrastRatio('#1f6f5c', PAGE_BACKGROUND_COLOR),
    ).toBeGreaterThanOrEqual(MIN_SURFACE_CONTRAST);
  });
});
