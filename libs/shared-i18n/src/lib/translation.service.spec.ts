import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import type { AppConfig } from '@trefaro/shared-models';
import { TranslationService } from './translation.service';

/**
 * The three things this service owns that Transloco does not: which language a
 * visitor gets first, that a switch waits for its text, and that `<html lang>`
 * tells the truth.
 */
const CATALOGUES: Record<string, Translation> = {
  en: { 'language.switcher.label': 'Language' },
  de: { 'language.switcher.label': 'Sprache' },
  fr: { 'language.switcher.label': 'Langue' },
};

class SlowLoader implements TranslocoLoader {
  readonly requested: string[] = [];
  /** Set to hold a load open, so the in-between state is observable. */
  release: (() => void) | null = null;
  failFor: string | null = null;

  async getTranslation(lang: string): Promise<Translation> {
    this.requested.push(lang);
    if (this.release) {
      await new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
    if (lang === this.failFor) throw new Error('offline');
    return CATALOGUES[lang] ?? {};
  }
}

/**
 * Transloco resolves its loader from the injector by class, so the stub has to
 * be a class — while the instance a test wants to steer is reached through this
 * variable rather than through the injector.
 */
let loader = new SlowLoader();

class DelegatingLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    return loader.getTranslation(lang);
  }
}

describe('TranslationService', () => {
  let service: TranslationService;
  let transloco: TranslocoService;
  let document: Document;
  let config: { availableLocales: string[]; defaultLocale: string };
  let navigatorLanguages: readonly string[];

  /**
   * Rebuilds the injector, so a test may set `config` or the browser's languages
   * and then ask what a *fresh* client would do with them — which is the only
   * interesting question about the initial language.
   */
  function configure(): void {
    TestBed.resetTestingModule();
    loader = new SlowLoader();
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: [],
            defaultLang: 'en',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
            missingHandler: {
              allowEmpty: false,
              useFallbackTranslation: false,
            },
          },
          loader: DelegatingLoader,
        }),
        {
          provide: AppConfigService,
          useValue: {
            config: () => config as unknown as AppConfig,
          },
        },
      ],
    });

    document = TestBed.inject(DOCUMENT);
    // The real `navigator.languages` cannot be set, so the window the service
    // reads through is the one being stubbed — which is also why the service
    // takes it from `DOCUMENT` rather than from the global.
    Object.defineProperty(document, 'defaultView', {
      configurable: true,
      value: {
        navigator: { languages: navigatorLanguages },
        localStorage: window.localStorage,
      },
    });

    transloco = TestBed.inject(TranslocoService);
    service = TestBed.inject(TranslationService);
  }

  beforeEach(() => {
    window.localStorage.clear();
    document?.documentElement.removeAttribute('lang');
    config = { availableLocales: ['en', 'de'], defaultLocale: 'de' };
    navigatorLanguages = [];
    configure();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('lang');
  });

  describe('start', () => {
    it("announces the organization's languages to Transloco", async () => {
      config.availableLocales = ['en', 'de', 'fr'];
      configure();

      await service.start();

      // Not a compile-time list: from AP 7 an organization creates a language by
      // translating it, so the set is a column.
      expect(transloco.getAvailableLangs()).toEqual(['en', 'de', 'fr']);
    });

    it('prefers what this visitor chose here before', async () => {
      window.localStorage.setItem('trefaro.locale', 'en');
      navigatorLanguages = ['de-DE'];
      configure();

      await service.start();

      expect(service.locale()).toBe('en');
    });

    it("falls back to the browser's language, matched on the primary subtag", async () => {
      navigatorLanguages = ['de-AT', 'en'];
      config.defaultLocale = 'en';
      configure();

      await service.start();

      // `de-AT` is not offered; `de` is. Refusing that would be pedantry with a
      // visible cost.
      expect(service.locale()).toBe('de');
    });

    it("uses the instance's default when the browser asks for nothing offered", async () => {
      navigatorLanguages = ['pt-BR'];
      configure();

      await service.start();

      expect(service.locale()).toBe('de');
    });

    it('ignores a stored language the organization no longer offers', async () => {
      window.localStorage.setItem('trefaro.locale', 'fr');
      configure();

      await service.start();

      expect(service.locale()).toBe('de');
    });

    it('sets the document language, so a screen reader pronounces it', async () => {
      await service.start();

      expect(document.documentElement.lang).toBe('de');
    });

    it('loads the catalogue even when the language is already the fallback', async () => {
      config.defaultLocale = 'en';
      configure();

      await service.start();

      // `active` starts on the fallback, so a shortcut for "already active"
      // would leave an English instance with no catalogue at all until some
      // pipe happened to trigger a load.
      expect(loader.requested).toEqual(['en']);
    });

    it('does not store a language it merely derived', async () => {
      navigatorLanguages = ['de-DE'];
      configure();

      await service.start();

      // "Your browser asks for German" must not become "you picked German": a
      // visitor who later changes their browser would keep getting the old one.
      expect(window.localStorage.getItem('trefaro.locale')).toBeNull();
    });
  });

  describe('use', () => {
    it('loads the catalogue before it activates the language', async () => {
      await service.start();
      loader.release = () => undefined;

      const switching = service.use('en');
      expect(service.switching()).toBe(true);
      // Still German while the English text is in flight: activating first would
      // leave the interface in the old language with the new one selected, and
      // nothing on screen to explain it.
      expect(service.locale()).toBe('de');
      expect(transloco.getActiveLang()).toBe('de');

      loader.release?.();
      loader.release = null;
      await switching;

      expect(service.locale()).toBe('en');
      expect(transloco.getActiveLang()).toBe('en');
      expect(service.switching()).toBe(false);
    });

    it('remembers the choice for the next visit', async () => {
      await service.start();

      await service.use('en');

      expect(window.localStorage.getItem('trefaro.locale')).toBe('en');
    });

    it('remembers nothing when the catalogue could not be fetched', async () => {
      await service.start();
      await service.use('de');
      loader.failFor = 'en';

      await expect(service.use('en')).rejects.toThrow();

      // A language that cannot be fetched is not one to greet this visitor with
      // tomorrow.
      expect(window.localStorage.getItem('trefaro.locale')).toBe('de');
      expect(service.locale()).toBe('de');
      expect(service.switching()).toBe(false);
    });

    it('updates the document language on every switch', async () => {
      await service.start();

      await service.use('en');

      expect(document.documentElement.lang).toBe('en');
    });
  });

  describe('languageName', () => {
    it('names a language in the language currently active', async () => {
      await service.start();

      expect(service.languageName('de')).toBe('Deutsch');

      await service.use('en');

      // From the platform, not from the catalogue: a catalogue would need one
      // entry per language per language, and a language an organization invents
      // in AP 7 would be nameless in every other one.
      expect(service.languageName('de')).toBe('German');
    });

    it('falls back to the tag for something the platform does not know', async () => {
      await service.start();

      expect(service.languageName('zzz')).toBe('zzz');
    });
  });

  describe('availableLocales', () => {
    it('never answers empty, so the switcher has something to render', () => {
      config.availableLocales = [];
      configure();

      // A configuration that never arrived must not make the interface
      // languageless (NFR 10).
      expect(service.availableLocales()).toEqual(['en']);
    });
  });
});
