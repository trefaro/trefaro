import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppConfigService } from '@trefaro/shared-config';
import { describe, expect, it } from 'vitest';
import { provideTrefaroTitles } from './provide-trefaro-titles';
import { TranslationService } from './translation.service';

@Component({ standalone: true, template: '' })
class BlankPage {}

/**
 * Reproduces the one property of `TranslocoService.translate` that matters here:
 * it is a plain lookup with no signal behind it, so anything that must follow a
 * language change has to read `locale()` itself (F72). A fake that recomputed on
 * its own would make the test pass for a reason the real service does not have.
 */
class FakeTranslations {
  readonly language = signal('en');
  readonly locale = this.language.asReadonly();

  private readonly catalogues: Record<string, Record<string, string>> = {
    en: { 'admin.series.title': 'Event series' },
    de: { 'admin.series.title': 'Veranstaltungsreihen' },
  };

  translate(key: string): string {
    return this.catalogues[this.language()]?.[key] ?? key;
  }
}

describe('TrefaroTitleStrategy', () => {
  function setUp(organizationName = 'Democracy International') {
    const translations = new FakeTranslations();
    const name = signal(organizationName);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: BlankPage },
          {
            path: 'series',
            component: BlankPage,
            title: 'admin.series.title',
          },
          {
            path: 'unknown',
            component: BlankPage,
            title: 'admin.nothing.here',
          },
        ]),
        provideTrefaroTitles(),
        { provide: TranslationService, useValue: translations },
        { provide: AppConfigService, useValue: { organizationName: name } },
      ],
    });

    return { title: TestBed.inject(Title), translations, name };
  }

  it('names the page and the organization, not the product', async () => {
    const { title } = setUp();

    await (await RouterTestingHarness.create()).navigateByUrl('/series');

    expect(title.getTitle()).toBe('Event series — Democracy International');
  });

  it('leaves the organization alone on a route with no title', async () => {
    const { title } = setUp();

    await (await RouterTestingHarness.create()).navigateByUrl('/');

    expect(title.getTitle()).toBe('Democracy International');
  });

  it('follows a language change without a navigation', async () => {
    const { title, translations } = setUp();
    await (await RouterTestingHarness.create()).navigateByUrl('/series');

    translations.language.set('de');
    TestBed.tick();

    expect(title.getTitle()).toBe(
      'Veranstaltungsreihen — Democracy International',
    );
  });

  it('follows a rename without a navigation', async () => {
    const { title, name } = setUp();
    await (await RouterTestingHarness.create()).navigateByUrl('/series');

    name.set('Mehr Demokratie');
    TestBed.tick();

    expect(title.getTitle()).toBe('Event series — Mehr Demokratie');
  });

  it('shows the key when the catalogue has no word for it', async () => {
    const { title } = setUp();

    await (await RouterTestingHarness.create()).navigateByUrl('/unknown');

    // The same honesty as everywhere else: a missing key renders as itself
    // rather than as an empty tab that looks like a broken page.
    expect(title.getTitle()).toBe(
      'admin.nothing.here — Democracy International',
    );
  });
});
