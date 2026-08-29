import { BadRequestException } from '@nestjs/common';
import type {
  LocaleSettings,
  TranslationCatalogue,
} from '@trefaro/shared-models';
import { translationCompleteness } from '@trefaro/shared-models';
import type { ConfigurationService } from '../config';
import type { ShippedCatalogueReader } from './ports/shipped-catalogue.reader';
import type {
  TranslationOverrideChange,
  TranslationOverrideRecord,
  TranslationOverrideRepository,
} from './ports/translation-override.repository';
import { TranslationAdminService } from './translation-admin.service';

/**
 * The language administration's rules (E23, E30, F73-F75) — AP 7.
 *
 * What is worth testing here is not that a figure can be computed but *which*
 * writes leave a row behind. Three of the four rules of the service are about
 * exactly that: an empty value resets, a value equal to the shipped text stores
 * nothing, and a key the image does not have is reported rather than stored. Get
 * one of them wrong and the symptom is a translation that survives the next
 * image update, or an import that quietly loses a third of a file.
 */
const SHIPPED: Record<string, TranslationCatalogue> = {
  en: {
    'language.switcher.label': 'Language',
    'modules.push.title': 'Push notifications',
    'plugins.roomPlanning.label': 'Rooms',
  },
  de: {
    'language.switcher.label': 'Sprache',
    // Deliberately incomplete: two of three, so German is at 67 %.
    'plugins.roomPlanning.label': 'Räume',
  },
};

class FakeShipped implements ShippedCatalogueReader {
  catalogues: Record<string, TranslationCatalogue> = { ...SHIPPED };

  async locales(): Promise<readonly string[]> {
    return Object.keys(this.catalogues).sort();
  }

  async read(locale: string): Promise<TranslationCatalogue | null> {
    return this.catalogues[locale] ?? null;
  }
}

/** A record whose value can be replaced — the stored row, not the port's view. */
type MutableRow = {
  -readonly [
    K in keyof TranslationOverrideRecord
  ]: TranslationOverrideRecord[K];
};

class FakeOverrides implements TranslationOverrideRepository {
  rows: MutableRow[] = [];
  readonly applied: TranslationOverrideChange[] = [];

  async findByLocale(
    locale: string,
  ): Promise<readonly TranslationOverrideRecord[]> {
    return this.rows
      .filter((row) => row.locale === locale)
      .sort((left, right) => left.key.localeCompare(right.key));
  }

  async localesWithOverrides(): Promise<readonly string[]> {
    return [...new Set(this.rows.map((row) => row.locale))].sort();
  }

  async apply(change: TranslationOverrideChange): Promise<void> {
    this.applied.push(change);
    for (const key of change.remove) {
      this.rows = this.rows.filter(
        (row) => !(row.locale === change.locale && row.key === key),
      );
    }
    for (const entry of change.write) {
      const existing = this.rows.find(
        (row) => row.locale === change.locale && row.key === entry.key,
      );
      if (existing) {
        existing.value = entry.value;
      } else {
        this.rows.push({
          locale: change.locale,
          key: entry.key,
          value: entry.value,
          updatedAt: new Date('2026-08-28T10:00:00Z'),
        });
      }
    }
  }
}

describe('TranslationAdminService', () => {
  let shipped: FakeShipped;
  let overrides: FakeOverrides;
  let locales: LocaleSettings;
  let service: TranslationAdminService;

  beforeEach(() => {
    shipped = new FakeShipped();
    overrides = new FakeOverrides();
    locales = { defaultLocale: 'en', activeLocales: ['en', 'de'] };
    service = new TranslationAdminService(shipped, overrides, {
      getLocaleSettings: async () => locales,
    } as unknown as ConfigurationService);
  });

  describe('overview', () => {
    it('counts a shipped language against the English key list', async () => {
      const { locales: summaries } = await service.overview();
      const german = summaries.find((entry) => entry.locale === 'de');

      expect(german).toEqual({
        locale: 'de',
        shipped: true,
        active: true,
        isDefault: false,
        total: 3,
        translated: 2,
        overrides: 0,
      });
      expect(translationCompleteness(german!)).toBe(67);
    });

    it('reports English as complete, because it is the key list', async () => {
      const { locales: summaries } = await service.overview();

      expect(summaries[0]).toMatchObject({
        locale: 'en',
        total: 3,
        translated: 3,
        isDefault: true,
      });
    });

    it('lists a language that exists only as translations (E30)', async () => {
      // The case that makes a third language possible: somebody has translated
      // one key of French, and nobody has offered French to visitors yet. A
      // list built from `active_locales` alone would hide the work.
      overrides.rows = [row('fr', 'modules.push.title', 'Notifications push')];

      const { locales: summaries } = await service.overview();
      const french = summaries.find((entry) => entry.locale === 'fr');

      expect(french).toMatchObject({
        locale: 'fr',
        shipped: false,
        active: false,
        translated: 1,
        overrides: 1,
        total: 3,
      });
    });

    it('lists an offered language nobody has translated yet', async () => {
      locales = { defaultLocale: 'en', activeLocales: ['en', 'de', 'fr'] };

      const { locales: summaries } = await service.overview();
      const french = summaries.find((entry) => entry.locale === 'fr');

      // Zero per cent and offered: allowed on purpose (E23), and the figure is
      // what stops it being invisible.
      expect(french).toMatchObject({ active: true, translated: 0, total: 3 });
      expect(translationCompleteness(french!)).toBe(0);
    });

    it('puts English first and the rest alphabetically', async () => {
      locales = {
        defaultLocale: 'en',
        activeLocales: ['en', 'de', 'fr', 'ca'],
      };

      const { locales: summaries } = await service.overview();

      expect(summaries.map((entry) => entry.locale)).toEqual([
        'en',
        'ca',
        'de',
        'fr',
      ]);
    });

    it('ignores a row whose key this image no longer ships', async () => {
      overrides.rows = [row('de', 'modules.gone.title', 'Fort')];

      const { locales: summaries } = await service.overview();
      const german = summaries.find((entry) => entry.locale === 'de');

      // Not counted as work, because the served catalogue filters it out — a
      // figure that counted it would claim an effect that does not exist.
      expect(german).toMatchObject({ translated: 2, overrides: 0 });
    });
  });

  describe('detail', () => {
    it('marks a key with no text in this language as missing', async () => {
      const detail = await service.detail('de');
      const entry = entryOf(detail.entries, 'modules.push.title');

      expect(entry).toEqual({
        key: 'modules.push.title',
        english: 'Push notifications',
        shipped: null,
        override: null,
        // What a client receives: the English text, not a blank (E23).
        value: 'Push notifications',
        state: 'missing',
      });
    });

    it('shows the shipped text and the organization’s own side by side', async () => {
      overrides.rows = [
        row('de', 'plugins.roomPlanning.label', 'Raumbelegung'),
      ];

      const entry = entryOf(
        (await service.detail('de')).entries,
        'plugins.roomPlanning.label',
      );

      expect(entry).toMatchObject({
        english: 'Rooms',
        shipped: 'Räume',
        override: 'Raumbelegung',
        value: 'Raumbelegung',
        state: 'overridden',
      });
    });

    it('answers for a language nothing knows yet', async () => {
      // A 404 here would mean offering a language to visitors before being able
      // to translate the first word of it.
      const detail = await service.detail('fr');

      expect(detail.entries).toHaveLength(3);
      expect(detail).toMatchObject({
        shipped: false,
        active: false,
        translated: 0,
      });
      expect(detail.entries.every((entry) => entry.state === 'missing')).toBe(
        true,
      );
    });

    it('lists keys in a stable order', async () => {
      const keys = (await service.detail('de')).entries.map(
        (entry) => entry.key,
      );

      expect(keys).toEqual([...keys].sort());
    });

    it('lower-cases the tag, so one language is one set of rows', async () => {
      const detail = await service.detail('DE-at');

      expect(detail.locale).toBe('de-at');
    });

    it('refuses something that is not a language tag', async () => {
      await expect(service.detail('../../etc/passwd')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('write', () => {
    it('stores the organization’s own text', async () => {
      const result = await service.write('de', {
        'modules.push.title': 'Push-Mitteilungen',
      });

      expect(result).toMatchObject({ written: 1, reset: 0, unchanged: 0 });
      expect(result.summary).toMatchObject({ translated: 3, overrides: 1 });
      expect(overrides.rows).toHaveLength(1);
    });

    it('does not store a value equal to the shipped text (F74)', async () => {
      const result = await service.write('de', {
        'language.switcher.label': 'Sprache',
      });

      // A row here would only ever mean "keep this wording even if the next
      // image changes it", which nobody asked for.
      expect(result).toMatchObject({ written: 0, unchanged: 1 });
      expect(overrides.rows).toHaveLength(0);
    });

    it('removes an existing row when the shipped text is written back', async () => {
      overrides.rows = [row('de', 'language.switcher.label', 'Sprachwahl')];

      const result = await service.write('de', {
        'language.switcher.label': 'Sprache',
      });

      expect(result).toMatchObject({ reset: 1, written: 0 });
      expect(overrides.rows).toHaveLength(0);
    });

    it('treats an empty value as no translation of its own (F74)', async () => {
      overrides.rows = [row('de', 'modules.push.title', 'Push-Mitteilungen')];

      const result = await service.write('de', { 'modules.push.title': '' });

      expect(result).toMatchObject({ reset: 1 });
      expect(overrides.rows).toHaveLength(0);
      // Back to the state the resolution chain describes: German ships nothing
      // for this key, so a client receives the English text again.
      expect(result.summary.translated).toBe(2);
    });

    it('treats whitespace as empty but keeps a meaningful trailing space', async () => {
      await service.write('de', { 'modules.push.title': '   ' });
      expect(overrides.rows).toHaveLength(0);

      await service.write('de', { 'modules.push.title': 'Push: ' });
      // Not trimmed: a translation may legitimately end in a space, and eating
      // it would be a formatting decision taken behind the translator.
      expect(overrides.rows[0].value).toBe('Push: ');
    });

    it('counts a key that already stood exactly so', async () => {
      overrides.rows = [row('de', 'modules.push.title', 'Push-Mitteilungen')];

      const result = await service.write('de', {
        'modules.push.title': 'Push-Mitteilungen',
      });

      expect(result).toMatchObject({ unchanged: 1, written: 0, reset: 0 });
      expect(overrides.applied[0]).toMatchObject({ write: [], remove: [] });
    });

    it('imports what it understands and names the rest (F75)', async () => {
      const result = await service.write('de', {
        'modules.push.title': 'Push-Mitteilungen',
        'modules.gone.title': 'Aus einem alten Image',
        'not a key': 'Unsinn',
      });

      expect(result.written).toBe(1);
      expect([...result.ignored].sort()).toEqual([
        'modules.gone.title',
        'not a key',
      ]);
      // Imported rather than refused: a file from an older or newer image is
      // the normal case for translation work.
      expect(overrides.rows.map((entry) => entry.key)).toEqual([
        'modules.push.title',
      ]);
    });

    it('merges: keys that are absent stay as they were', async () => {
      overrides.rows = [row('de', 'modules.push.title', 'Push-Mitteilungen')];

      await service.write('de', {
        'plugins.roomPlanning.label': 'Raumbelegung',
      });

      expect(overrides.rows).toHaveLength(2);
    });

    it('writes one language without touching another', async () => {
      overrides.rows = [row('fr', 'modules.push.title', 'Notifications push')];

      await service.write('de', { 'modules.push.title': 'Push-Mitteilungen' });

      expect(
        overrides.rows.filter((entry) => entry.locale === 'fr'),
      ).toHaveLength(1);
    });

    it('creates a language nothing ships and nobody offers (E30)', async () => {
      const result = await service.write('fr', {
        'modules.push.title': 'Notifications push',
      });

      expect(result.summary).toMatchObject({
        locale: 'fr',
        shipped: false,
        active: false,
        translated: 1,
      });
    });

    it('refuses a body with nothing in it', async () => {
      await expect(service.write('de', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses a value that is not a string', async () => {
      await expect(
        service.write('de', { 'modules.push.title': 42 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a value longer than the column allows', async () => {
      await expect(
        service.write('de', { 'modules.push.title': 'x'.repeat(8001) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses more keys than one write may carry', async () => {
      const entries: Record<string, string> = {};
      for (let index = 0; index < 5001; index += 1) {
        entries[`bulk.key${index}`] = 'x';
      }

      await expect(service.write('de', entries)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('applies everything in one call to the port', async () => {
      overrides.rows = [row('de', 'language.switcher.label', 'Sprachwahl')];

      await service.write('de', {
        'language.switcher.label': '',
        'modules.push.title': 'Push-Mitteilungen',
      });

      // One transaction, not two writes: an import that failed half way would
      // leave a language nobody can reason about.
      expect(overrides.applied).toHaveLength(1);
      expect(overrides.applied[0]).toMatchObject({
        locale: 'de',
        remove: ['language.switcher.label'],
      });
    });
  });

  describe('reset', () => {
    it('drops the organization’s row and leaves the shipped text', async () => {
      overrides.rows = [row('de', 'language.switcher.label', 'Sprachwahl')];

      const result = await service.reset('de', 'language.switcher.label');

      expect(result).toMatchObject({ reset: 1 });
      const entry = entryOf(
        (await service.detail('de')).entries,
        'language.switcher.label',
      );
      expect(entry).toMatchObject({ value: 'Sprache', state: 'shipped' });
    });

    it('is harmless on a key that was never overridden', async () => {
      const result = await service.reset('de', 'language.switcher.label');

      expect(result).toMatchObject({ reset: 0, unchanged: 1 });
    });
  });
});

function row(
  locale: string,
  key: string,
  value: string,
): TranslationOverrideRecord {
  return { locale, key, value, updatedAt: new Date('2026-08-28T10:00:00Z') };
}

function entryOf(
  entries: readonly { readonly key: string }[],
  key: string,
): unknown {
  return entries.find((entry) => entry.key === key);
}
