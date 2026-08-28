import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { FALLBACK_THEME, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    root = TestBed.inject(DOCUMENT).documentElement;
  });

  afterEach(() => root.removeAttribute('style'));

  it('starts on the fallback theme so the first paint is never unstyled', () => {
    expect(service.theme()).toEqual(FALLBACK_THEME);
    expect(service.hasLogo()).toBe(false);
  });

  it('writes the derived custom properties onto the document root', () => {
    service.apply({
      primaryColor: '#123456',
      accentColor: '#abcdef',
      logoUrl: null,
      fontFamily: 'Inter',
    });

    expect(root.style.getPropertyValue('--trefaro-color-primary')).toBe(
      '#123456',
    );
    expect(root.style.getPropertyValue('--trefaro-font-family')).toBe('Inter');
    expect(
      root.style.getPropertyValue('--trefaro-color-primary-soft'),
    ).toContain('color-mix');
  });

  it('reports a logo once one is configured', () => {
    service.apply({
      ...FALLBACK_THEME,
      logoUrl: '/api/media/branding/logo?v=1787790100000',
    });

    expect(service.hasLogo()).toBe(true);
    expect(root.style.getPropertyValue('--trefaro-logo-url')).toBe(
      'url("/api/media/branding/logo?v=1787790100000")',
    );
  });

  it('replaces the previous theme when applied again', () => {
    service.apply({ ...FALLBACK_THEME, primaryColor: '#111111' });
    service.apply({ ...FALLBACK_THEME, primaryColor: '#222222' });

    expect(root.style.getPropertyValue('--trefaro-color-primary')).toBe(
      '#222222',
    );
  });
});
