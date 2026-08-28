import type { Theme } from '@trefaro/shared-models';
import { deriveThemeVariables, readableTextColor } from './theme-variables';

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
