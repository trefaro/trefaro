import { BadRequestException } from '@nestjs/common';
import type { AppConfig, TranslationCatalogue } from '@trefaro/shared-models';
import type { ConfigurationService } from '../config';
import { CatalogueService } from './catalogue.service';
import type { ShippedCatalogueReader } from './ports/shipped-catalogue.reader';
import type {
  TranslationOverrideReader,
  TranslationOverrideRecord,
} from './ports/translation-override.repository';

/**
 * The resolution chain of E23, and what it is for.
 *
 * The rule reads "instance override, then shipped locale, then shipped English",
 * per key. What that buys is the difference between a language somebody is
 * halfway through translating and a screen of blank buttons — so the tests below
 * are mostly about gaps: which ones get filled, from where, and which ones the
 * organization's own rows are allowed to fill.
 */
const SHIPPED: Record<string, TranslationCatalogue> = {
  en: {
    'language.switcher.label': 'Language',
    'modules.push.title': 'Push notifications',
    'plugins.roomPlanning.label': 'Rooms',
  },
  de: {
    'language.switcher.label': 'Sprache',
    // Deliberately incomplete: `modules.push.title` is missing, which is the
    // case the chain exists for.
    'plugins.roomPlanning.label': 'Räume',
  },
};

class FakeShipped implements ShippedCatalogueReader {
  catalogues: Record<string, TranslationCatalogue> = { ...SHIPPED };
  readonly reads: string[] = [];

  async locales(): Promise<readonly string[]> {
    return Object.keys(this.catalogues).sort();
  }

  async read(locale: string): Promise<TranslationCatalogue | null> {
    this.reads.push(locale);
    return this.catalogues[locale] ?? null;
  }
}

class FakeOverrides implements TranslationOverrideReader {
  rows: TranslationOverrideRecord[] = [];

  async findByLocale(
    locale: string,
  ): Promise<readonly TranslationOverrideRecord[]> {
    return this.rows.filter((row) => row.locale === locale);
  }

  async localesWithOverrides(): Promise<readonly string[]> {
    return [...new Set(this.rows.map((row) => row.locale))].sort();
  }
}

function override(
  locale: string,
  key: string,
  value: string,
): TranslationOverrideRecord {
  return { locale, key, value, updatedAt: new Date('2026-08-28T10:00:00Z') };
}

describe('CatalogueService', () => {
  let shipped: FakeShipped;
  let overrides: FakeOverrides;
  let availableLocales: string[];
  let service: CatalogueService;

  beforeEach(() => {
    shipped = new FakeShipped();
    overrides = new FakeOverrides();
    availableLocales = ['en', 'de'];
    service = new CatalogueService(shipped, overrides, {
      // Only one field of the configuration matters here: which languages the
      // organization offers.
      getAppConfig: async () => ({ availableLocales }) as Partial<AppConfig>,
    } as unknown as ConfigurationService);
  });

  describe('resolve', () => {
    it('fills a gap in a language with the English text', async () => {
      const { catalogue } = await service.resolve('de');

      expect(catalogue['language.switcher.label']).toBe('Sprache');
      // The whole reason English is read for every language: a half-translated
      // language stays usable instead of showing an empty button.
      expect(catalogue['modules.push.title']).toBe('Push notifications');
    });

    it('answers every English key for every language', async () => {
      // English is the key list (E23), so a client never has to handle a
      // missing key — which is what makes its own `fallbackLang` a net for an
      // unreachable server rather than for an incomplete translation.
      const { catalogue } = await service.resolve('de');

      expect(Object.keys(catalogue).sort()).toEqual(
        Object.keys(SHIPPED['en']).sort(),
      );
    });

    it("lets the instance's own value win over the shipped one", async () => {
      overrides.rows = [
        override('de', 'plugins.roomPlanning.label', 'Raumbelegung'),
      ];

      const { catalogue } = await service.resolve('de');

      expect(catalogue['plugins.roomPlanning.label']).toBe('Raumbelegung');
    });

    it('lets the instance translate what the image did not', async () => {
      overrides.rows = [
        override('de', 'modules.push.title', 'Push-Mitteilungen'),
      ];

      const { catalogue } = await service.resolve('de');

      // This is chapter 4 in one assertion: a word changed without a rebuild.
      expect(catalogue['modules.push.title']).toBe('Push-Mitteilungen');
    });

    it('overrides English too', async () => {
      overrides.rows = [override('en', 'modules.push.title', 'Notifications')];

      expect(
        (await service.resolve('en')).catalogue['modules.push.title'],
      ).toBe('Notifications');
    });

    it('ignores a row whose key this image no longer ships', async () => {
      overrides.rows = [
        override('de', 'modules.newsletter.title', 'Rundbrief'),
      ];

      const { catalogue } = await service.resolve('de');

      // Renaming or withdrawing a key must not turn an organization's stored
      // work into an error, and it must not put something in the catalogue that
      // no template asks for. Ignored on read, kept in the table.
      expect(catalogue).not.toHaveProperty('modules.newsletter.title');
    });

    it('serves a language this image does not ship at all', async () => {
      availableLocales = ['en', 'fr'];
      overrides.rows = [override('fr', 'modules.push.title', 'Notifications')];

      const { catalogue } = await service.resolve('fr');

      // A language is created by translating it (AP 7), so a locale that exists
      // only as rows has to resolve — the rest comes from English.
      expect(catalogue['modules.push.title']).toBe('Notifications');
      expect(catalogue['language.switcher.label']).toBe('Language');
    });

    it('lower-cases the tag, so one language is one catalogue', async () => {
      const { locale, etag } = await service.resolve('DE');

      expect(locale).toBe('de');
      expect(etag).toBe((await service.resolve('de')).etag);
    });

    it('refuses anything that is not a language tag', async () => {
      for (const candidate of [
        '../en',
        'en/../../etc/passwd',
        'toolongalanguagetag',
        '',
        'e',
      ]) {
        await expect(service.resolve(candidate)).rejects.toThrow(
          BadRequestException,
        );
      }
    });
  });

  describe('the ETag', () => {
    it('changes when a translation changes', async () => {
      const before = (await service.resolve('de')).etag;

      overrides.rows = [override('de', 'modules.push.title', 'Push')];

      expect((await service.resolve('de')).etag).not.toBe(before);
    });

    it('changes when the image ships a different catalogue', async () => {
      const before = (await service.resolve('de')).etag;

      shipped.catalogues = {
        ...shipped.catalogues,
        de: { ...SHIPPED['de'], 'language.switcher.label': 'Sprachwahl' },
      };

      // Over the bytes, not over an `updated_at`: three things decide this
      // answer and only one of them has a timestamp. A new image therefore
      // invalidates every client's copy without anybody remembering to.
      expect((await service.resolve('de')).etag).not.toBe(before);
    });

    it('stays the same when nothing changed', async () => {
      expect((await service.resolve('de')).etag).toBe(
        (await service.resolve('de')).etag,
      );
    });

    it('distinguishes two languages with identical text', async () => {
      shipped.catalogues = { en: SHIPPED['en'], de: SHIPPED['en'] };

      expect((await service.resolve('de')).etag).not.toBe(
        (await service.resolve('en')).etag,
      );
    });
  });

  describe('isServable', () => {
    it('accepts a language this image ships', async () => {
      availableLocales = ['en'];

      expect(await service.isServable('de')).toBe(true);
    });

    it('accepts a language the organization offers', async () => {
      availableLocales = ['en', 'fr'];

      expect(await service.isServable('fr')).toBe(true);
    });

    it('refuses a language that is neither', async () => {
      availableLocales = ['en'];

      expect(await service.isServable('fr')).toBe(false);
    });
  });
});
