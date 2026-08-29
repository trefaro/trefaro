import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { FALLBACK_THEME, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let root: HTMLElement;
  let head: HTMLHeadElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    const document = TestBed.inject(DOCUMENT);
    root = document.documentElement;
    head = document.head;
  });

  afterEach(() => {
    root.removeAttribute('style');
    head.querySelector('meta[name="theme-color"]')?.remove();
  });

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

  it('paints the browser chrome in the primary colour too (AP 12)', () => {
    service.apply({
      primaryColor: '#123456',
      accentColor: '#abcdef',
      logoUrl: null,
      fontFamily: 'Inter',
    });

    // The one part of the brand that is outside the document: without it a
    // branded instance has the organization's colour on the page and Trefaro's
    // around it.
    expect(
      head
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.getAttribute('content'),
    ).toBe('#123456');
  });

  it('reuses the meta tag rather than adding one per change', () => {
    service.apply({ ...FALLBACK_THEME, primaryColor: '#111111' });
    service.apply({ ...FALLBACK_THEME, primaryColor: '#222222' });

    const tags = head.querySelectorAll('meta[name="theme-color"]');
    expect(tags).toHaveLength(1);
    expect(tags[0].getAttribute('content')).toBe('#222222');
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
