import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import {
  provideTranslationsForTest,
  TranslationService,
} from '@trefaro/shared-i18n';
import type {
  AppConfig,
  EventSeriesTranslation,
  EventSeriesTranslations,
} from '@trefaro/shared-models';
import { ContentTranslationsAdminService } from '../../features/content-translations/content-translations-admin.service';
import { SeriesTranslationsPage } from './series-translations-page';

/**
 * Translating a series in the organizer client (FR 3.12) — AP 11.
 *
 * What is asserted is what the page is for: that the original stands beside the
 * boxes, that a save writes the language of the chosen tab, that a removal is
 * offered only where there is something to remove, and that a screen is read
 * back afterwards — because a save may have deleted the row that put the tab
 * there.
 */
class FakeTranslationsAdmin {
  written: { locale: string; value: EventSeriesTranslation }[] = [];
  removed: string[] = [];

  constructor(private screen: EventSeriesTranslations) {}

  async series(): Promise<EventSeriesTranslations> {
    return this.screen;
  }

  async writeSeries(
    _id: string,
    locale: string,
    value: EventSeriesTranslation,
  ): Promise<EventSeriesTranslation> {
    this.written.push({ locale, value });
    this.screen = {
      ...this.screen,
      translations: { ...this.screen.translations, [locale]: value },
    };
    return value;
  }

  async removeSeries(_id: string, locale: string): Promise<void> {
    this.removed.push(locale);
    const translations = { ...this.screen.translations };
    delete translations[locale];
    this.screen = { ...this.screen, translations };
  }
}

const SCREEN: EventSeriesTranslations = {
  id: 'series-1',
  source: {
    name: 'Climate Conference 2027',
    description: 'Three days on citizen participation.',
  },
  translations: {},
};

describe('SeriesTranslationsPage', () => {
  function render(
    screen: EventSeriesTranslations = SCREEN,
    locales: readonly string[] = ['en', 'de'],
  ) {
    const admin = new FakeTranslationsAdmin(screen);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({
          'admin.translations.title': 'Translations',
          'admin.translations.original': 'Original',
          'admin.translations.save': 'Save translation',
          'admin.translations.remove': 'Remove translation',
          'admin.translations.saved': 'Saved.',
          'admin.translations.noLanguages': 'Only one language here.',
          'admin.series.name': 'Name',
          'admin.series.description': 'Description',
        }),
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            languageName: (tag: string) =>
              tag === 'de' ? 'German' : tag === 'fr' ? 'French' : tag,
          },
        },
        { provide: ContentTranslationsAdminService, useValue: admin },
        {
          provide: AppConfigService,
          useValue: {
            config: () =>
              ({
                defaultLocale: 'en',
                availableLocales: locales,
              }) as AppConfig,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(SeriesTranslationsPage);
    fixture.componentRef.setInput('id', 'series-1');
    fixture.detectChanges();

    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };

    return {
      fixture,
      admin,
      settle,
      text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
      buttons: () =>
        [
          ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ] as HTMLButtonElement[],
      boxes: () =>
        [
          ...(fixture.nativeElement as HTMLElement).querySelectorAll(
            'input, textarea',
          ),
        ] as (HTMLInputElement | HTMLTextAreaElement)[],
    };
  }

  it('shows the original beside every box', async () => {
    const page = render();
    await page.settle();

    // The original stands next to the box rather than inside it as a
    // placeholder: a placeholder disappears exactly when a translator wants to
    // compare, and an empty box has to keep meaning "no translation".
    expect(page.text()).toContain('Climate Conference 2027');
    expect(page.text()).toContain('Three days on citizen participation.');
    expect(page.boxes().every((box) => box.value === '')).toBe(true);
  });

  it('offers a tab per target language, never for the default one', async () => {
    const page = render(SCREEN, ['en', 'de', 'fr']);
    await page.settle();

    const tabs = page
      .buttons()
      .filter((button) => button.getAttribute('role') === 'tab')
      .map((button) => button.textContent?.trim());

    expect(tabs).toEqual(['German', 'French']);
  });

  it('says so when there is no language to translate into', async () => {
    const page = render(SCREEN, ['en']);
    await page.settle();

    expect(page.text()).toContain('Only one language here.');
  });

  it('writes what was typed, in the language of the chosen tab', async () => {
    const page = render();
    await page.settle();

    const [name] = page.boxes();
    name.value = 'Klimakonferenz 2027';
    name.dispatchEvent(new Event('input'));
    page.fixture.detectChanges();

    page
      .buttons()
      .find((button) => button.textContent?.includes('Save translation'))
      ?.click();
    await page.settle();

    // Sent as typed, empty box and all: what counts as "no translation" is the
    // server's rule (E25), and a client that trimmed first would be a second
    // opinion about it.
    expect(page.admin.written).toEqual([
      { locale: 'de', value: { name: 'Klimakonferenz 2027', description: '' } },
    ]);
  });

  it('offers no removal while there is nothing to remove', async () => {
    const page = render();
    await page.settle();

    expect(
      page.buttons().some((b) => b.textContent?.includes('Remove translation')),
    ).toBe(false);
  });

  it('reads the screen back after a save, so the tabs follow', async () => {
    const page = render();
    await page.settle();

    const [name] = page.boxes();
    name.value = 'Klimakonferenz 2027';
    name.dispatchEvent(new Event('input'));
    page.fixture.detectChanges();
    page
      .buttons()
      .find((button) => button.textContent?.includes('Save translation'))
      ?.click();
    await page.settle();

    expect(page.text()).toContain('Saved.');
    // The row now exists, so removing it is offered — which is only true
    // because the screen was re-read rather than patched in place.
    expect(
      page.buttons().some((b) => b.textContent?.includes('Remove translation')),
    ).toBe(true);
  });

  it('removes the language of the chosen tab', async () => {
    const page = render({
      ...SCREEN,
      translations: { de: { name: 'Klimakonferenz', description: null } },
    });
    await page.settle();

    page
      .buttons()
      .find((button) => button.textContent?.includes('Remove translation'))
      ?.click();
    await page.settle();

    expect(page.admin.removed).toEqual(['de']);
  });
});
