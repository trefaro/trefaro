import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  LocaleCatalogueDetail,
  LocaleOverview,
  LocaleSettings,
  LocaleSummary,
  TranslationEntry,
  TranslationWriteResult,
} from '@trefaro/shared-models';
import { ConfigAdminService } from '../../features/config/config-admin.service';
import { TranslationsAdminService } from '../../features/i18n/translations-admin.service';
import { LanguagesPage } from './languages-page';

/**
 * The language administration in the client (chapter 4) — AP 7.
 *
 * The assertions are about the three things this page decides that the server
 * cannot: that a field holds the language's *own* text rather than the effective
 * one (an English pre-fill would make every key look translated), that the
 * offered set is written as a whole rather than per checkbox, and that every
 * edited field travels in one request. Everything else — what a write means, how
 * far a language has got — comes back from the server and is only displayed.
 */
class FakeTranslations {
  readonly locale = signal('en');

  languageName(locale: string): string {
    return { en: 'English', de: 'German', fr: 'French' }[locale] ?? locale;
  }
}

class FakeTranslationsAdmin {
  readonly writes: { locale: string; entries: Record<string, string> }[] = [];
  readonly resets: { locale: string; key: string }[] = [];
  detailFor: LocaleCatalogueDetail | null = null;

  constructor(private current: LocaleOverview) {}

  async overview(): Promise<LocaleOverview> {
    return this.current;
  }

  async detail(locale: string): Promise<LocaleCatalogueDetail> {
    return (
      this.detailFor ?? {
        ...summary(locale, { total: 0, translated: 0 }),
        entries: [],
      }
    );
  }

  async write(
    locale: string,
    entries: Record<string, string>,
  ): Promise<TranslationWriteResult> {
    this.writes.push({ locale, entries });
    return {
      locale,
      written: Object.keys(entries).length,
      reset: 0,
      unchanged: 0,
      ignored: [],
      summary: summary(locale, { total: 2, translated: 2 }),
    };
  }

  async reset(locale: string, key: string): Promise<TranslationWriteResult> {
    this.resets.push({ locale, key });
    return {
      locale,
      written: 0,
      reset: 1,
      unchanged: 0,
      ignored: [],
      summary: summary(locale, { total: 2, translated: 1 }),
    };
  }
}

function summary(
  locale: string,
  over: Partial<LocaleSummary> = {},
): LocaleSummary {
  return {
    locale,
    shipped: locale === 'en' || locale === 'de',
    active: locale === 'en' || locale === 'de',
    isDefault: locale === 'en',
    total: 2,
    translated: locale === 'en' ? 2 : 1,
    overrides: 0,
    ...over,
  };
}

function entry(
  key: string,
  over: Partial<TranslationEntry> = {},
): TranslationEntry {
  return {
    key,
    english: `English ${key}`,
    shipped: null,
    override: null,
    value: `English ${key}`,
    state: 'missing',
    ...over,
  };
}

describe('LanguagesPage', () => {
  function render(options: {
    overview?: LocaleOverview;
    detail?: LocaleCatalogueDetail | null;
  }) {
    const overview: LocaleOverview = options.overview ?? {
      defaultLocale: 'en',
      locales: [summary('en'), summary('de')],
    };
    const admin = new FakeTranslationsAdmin(overview);
    admin.detailFor = options.detail ?? null;
    const written: LocaleSettings[] = [];
    let reloads = 0;

    TestBed.configureTestingModule({
      providers: [
        { provide: TranslationService, useValue: new FakeTranslations() },
        { provide: TranslationsAdminService, useValue: admin },
        {
          provide: ConfigAdminService,
          useValue: {
            setLocales: async (settings: LocaleSettings) => {
              written.push(settings);
              return settings;
            },
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            reload: async () => {
              reloads += 1;
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(LanguagesPage);
    fixture.detectChanges();
    const host = () => fixture.nativeElement as HTMLElement;

    return {
      fixture,
      admin,
      locales: () => written,
      reloads: () => reloads,
      text: () => host().textContent ?? '',
      buttonNamed: (label: string) =>
        [...host().querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === label,
        ) as HTMLButtonElement | undefined,
      /**
       * Opens the editor for one language.
       *
       * By its row rather than by the first button of that name: every row has a
       * Translate button, and the first one is English — which would have made
       * four of these tests assert about the wrong language while passing.
       */
      translate: (locale: string) => {
        const row = [...host().querySelectorAll('tbody tr')].find(
          (candidate) =>
            candidate.querySelector('code')?.textContent === locale,
        );
        (row?.querySelector('button') as HTMLButtonElement).click();
      },
      fieldFor: (key: string) =>
        host().querySelector(
          `textarea[aria-label="${key}"]`,
        ) as HTMLTextAreaElement,
      checkboxes: () => [
        ...host().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      ],
      onlyMissing: () =>
        host().querySelector('#only-missing') as HTMLInputElement,
      settle: async () => {
        await fixture.whenStable();
        fixture.detectChanges();
      },
    };
  }

  function type(field: HTMLTextAreaElement | HTMLInputElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  it('lists every language with its completeness figure', async () => {
    const page = render({});
    await page.settle();

    // The figure is the point: E23 allows an incomplete language, and this is
    // what keeps "incomplete" from being invisible.
    expect(page.text()).toContain('100%');
    expect(page.text()).toContain('50%');
    expect(page.text()).toContain('German');
    expect(page.text()).toContain('1 of 2 keys');
  });

  it('shows the English text beside a field holding this language’s own', async () => {
    const page = render({
      detail: {
        ...summary('de'),
        entries: [
          entry('a.b', {
            english: 'Language',
            shipped: 'Sprache',
            value: 'Sprache',
            state: 'shipped',
          }),
          entry('c.d', { english: 'Rooms' }),
        ],
      },
    });
    await page.settle();
    page.translate('de');
    await page.settle();

    expect(page.fieldFor('a.b').value).toBe('Sprache');
    // Empty rather than pre-filled with English: an English pre-fill would make
    // every key look translated and turn an export into a copy of English.
    expect(page.fieldFor('c.d').value).toBe('');
    expect(page.text()).toContain('Rooms');
    expect(page.text()).toContain('untranslated');
  });

  it('filters down to the untranslated keys', async () => {
    const page = render({
      detail: {
        ...summary('de'),
        entries: [
          entry('a.b', { shipped: 'Sprache', state: 'shipped' }),
          entry('c.d'),
        ],
      },
    });
    await page.settle();
    page.translate('de');
    await page.settle();

    const onlyMissing = page.onlyMissing();
    onlyMissing.checked = true;
    onlyMissing.dispatchEvent(new Event('change'));
    await page.settle();

    expect(page.fieldFor('c.d')).toBeTruthy();
    expect(page.fieldFor('a.b')).toBeNull();
  });

  it('sends every edited field in one request', async () => {
    const page = render({
      detail: {
        ...summary('de'),
        entries: [entry('a.b'), entry('c.d')],
      },
    });
    await page.settle();
    page.translate('de');
    await page.settle();

    type(page.fieldFor('a.b'), 'Sprache');
    type(page.fieldFor('c.d'), 'Räume');
    await page.settle();

    expect(page.buttonNamed('Save 2 changes')).toBeTruthy();
    page.buttonNamed('Save 2 changes')?.click();
    await page.settle();

    // One request, which the server applies in one transaction: a translator
    // working through twenty keys should not produce twenty partial writes.
    expect(page.admin.writes).toHaveLength(1);
    expect(page.admin.writes[0]).toEqual({
      locale: 'de',
      entries: { 'a.b': 'Sprache', 'c.d': 'Räume' },
    });
    expect(page.text()).toContain('2 written');
  });

  it('keeps an edit that a filter has hidden', async () => {
    const page = render({
      detail: {
        ...summary('de'),
        entries: [
          entry('a.b', { shipped: 'Sprache', state: 'shipped' }),
          entry('c.d'),
        ],
      },
    });
    await page.settle();
    page.translate('de');
    await page.settle();

    type(page.fieldFor('a.b'), 'Sprachwahl');
    await page.settle();

    const onlyMissing = page.onlyMissing();
    onlyMissing.checked = true;
    onlyMissing.dispatchEvent(new Event('change'));
    await page.settle();

    // Hidden, not dropped: switching a filter must not throw away typing.
    expect(page.fieldFor('a.b')).toBeNull();
    expect(page.buttonNamed('Save 1 change')).toBeTruthy();
  });

  it('resets one key through the endpoint that owns it', async () => {
    const page = render({
      detail: {
        ...summary('de'),
        entries: [
          entry('a.b', {
            shipped: 'Sprache',
            override: 'Sprachwahl',
            value: 'Sprachwahl',
            state: 'overridden',
          }),
        ],
      },
    });
    await page.settle();
    page.translate('de');
    await page.settle();

    page.buttonNamed('Reset')?.click();
    await page.settle();

    expect(page.admin.resets).toEqual([{ locale: 'de', key: 'a.b' }]);
  });

  it('offers no reset for a key the organization never wrote', async () => {
    const page = render({
      detail: {
        ...summary('de'),
        entries: [entry('a.b', { shipped: 'Sprache', state: 'shipped' })],
      },
    });
    await page.settle();
    page.translate('de');
    await page.settle();

    // The shipped text cannot be reset — there is nothing behind it.
    expect(page.buttonNamed('Reset')).toBeUndefined();
  });

  it('writes the offered set as a whole, and re-reads this client’s configuration', async () => {
    const page = render({
      overview: {
        defaultLocale: 'en',
        locales: [
          summary('en'),
          summary('de'),
          summary('fr', { shipped: false, active: false, translated: 1 }),
        ],
      },
    });
    await page.settle();

    // Nothing is written before Save: the default has to be one of the offered
    // ones, so a checkbox that wrote immediately would have a moment where it
    // is not.
    const french = page.checkboxes().at(-1);
    french!.checked = true;
    french!.dispatchEvent(new Event('change'));
    await page.settle();
    expect(page.locales()).toHaveLength(0);

    page.buttonNamed('Save offered languages')?.click();
    await page.settle();

    expect(page.locales()).toEqual([
      { defaultLocale: 'en', activeLocales: ['en', 'de', 'fr'] },
    ]);
    // The switcher in this client reads the cached configuration.
    expect(page.reloads()).toBe(1);
  });

  it('puts a new tag on the list so it can be translated (E30)', async () => {
    const page = render({});
    await page.settle();

    const tag = page.fixture.nativeElement.querySelector(
      '#new-locale',
    ) as HTMLInputElement;
    type(tag, 'fr');
    await page.settle();
    page.buttonNamed('Add')?.click();
    await page.settle();

    expect(page.text()).toContain('French');
    // A language exists because somebody translated it; offering it is the
    // separate decision below.
    expect(page.locales()).toHaveLength(0);
    expect(page.text()).toContain('0%');
  });

  it('refuses something that is not a language tag', async () => {
    const page = render({});
    await page.settle();

    const tag = page.fixture.nativeElement.querySelector(
      '#new-locale',
    ) as HTMLInputElement;
    type(tag, 'Deutsch bitte');
    await page.settle();
    page.buttonNamed('Add')?.click();
    await page.settle();

    expect(page.text()).toContain('A language tag looks like');
    expect(page.text()).not.toContain('ready to translate');
  });
});
