import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  FALLBACK_LOCALE,
  MAX_REPORTED_IGNORED_KEYS,
  MAX_TRANSLATION_VALUE_LENGTH,
  MAX_TRANSLATION_WRITE_ENTRIES,
  isLocaleTag,
  isTranslationKey,
  type LocaleCatalogueDetail,
  type LocaleOverview,
  type LocaleSettings,
  type LocaleSummary,
  type TranslationCatalogue,
  type TranslationEntry,
  type TranslationWriteResult,
} from '@trefaro/shared-models';
import { ConfigurationService } from '../config';
import {
  SHIPPED_CATALOGUE_READER,
  type ShippedCatalogueReader,
} from './ports/shipped-catalogue.reader';
import {
  TRANSLATION_OVERRIDE_REPOSITORY,
  type TranslationOverrideRepository,
  type TranslationOverrideValue,
} from './ports/translation-override.repository';

/**
 * The language administration (chapter 4, FR 1.4, E22, E23, E30) — AP 7.
 *
 * This is the service that turns "new languages must be maintainable by the
 * organization" into something an organizer can do on a Tuesday afternoon: list
 * the languages with how far each has got, edit a key beside its English
 * original, reset one back to what the image ships, and take a whole file in and
 * out again for translation work done elsewhere.
 *
 * Four rules decide almost everything here:
 *
 * 1. **English is the key list** (E23). Every figure is counted against the
 *    shipped English catalogue, and a key English does not have does not exist —
 *    which is what makes "68 %" a number rather than an impression.
 * 2. **A language exists because somebody translated it** (E30). Writing is
 *    allowed for any well-formed tag, whether or not the image ships it and
 *    whether or not the organization offers it. Offering it is a separate
 *    decision, in `app_config.active_locales`, and taking it back there deletes
 *    no translation.
 * 3. **An empty value is not a translation** (F74). It removes the row, so the
 *    key falls back to the shipped text — which is also what makes an
 *    export/import round trip work, where an untranslated key is an empty
 *    string. A value identical to the shipped text is not stored either: a row
 *    that repeats the image would pin the text against the next image.
 * 4. **An unknown key is named, not swallowed** (F75). A file from an older or a
 *    newer image is the normal case for translation work, so it is imported and
 *    the difference is reported rather than refused.
 *
 * Reads and writes in one service, as with `ConfigurationService`: the rule that
 * decides whether a value may be stored is the rule that decides how it is
 * counted, and a second copy of it could disagree.
 */
@Injectable()
export class TranslationAdminService {
  constructor(
    @Inject(SHIPPED_CATALOGUE_READER)
    private readonly shipped: ShippedCatalogueReader,
    @Inject(TRANSLATION_OVERRIDE_REPOSITORY)
    private readonly overrides: TranslationOverrideRepository,
    private readonly configuration: ConfigurationService,
  ) {}

  /**
   * Every language this instance knows about, with its completeness figure.
   *
   * Three sources, unioned: what the image ships, what the organization offers,
   * and what somebody has already translated. The third is what makes a language
   * visible before it is offered — otherwise a half-finished translation would
   * disappear from the screen that is meant to finish it.
   */
  async overview(): Promise<LocaleOverview> {
    const [shipped, locales, withOverrides, english] = await Promise.all([
      this.shipped.locales(),
      this.configuration.getLocaleSettings(),
      this.overrides.localesWithOverrides(),
      this.englishCatalogue(),
    ]);

    const tags = [
      ...new Set([...shipped, ...locales.activeLocales, ...withOverrides]),
    ].sort(byFallbackFirst);

    // Sequential rather than parallel: the file reads are cached and the
    // override reads are one small query per language, and an administration
    // screen with three languages does not need three concurrent transactions.
    const summaries: LocaleSummary[] = [];
    for (const tag of tags) {
      summaries.push(await this.summarize(tag, english, shipped, locales));
    }

    return { defaultLocale: locales.defaultLocale, locales: summaries };
  }

  /**
   * One language, key by key — the editor's payload.
   *
   * Answers for a language nothing knows yet as well: every key `missing`, and
   * the figure zero. That is how a third language starts, and a 404 here would
   * mean an organization had to add a language to `active_locales` — making it
   * visible to visitors — before it could translate the first word of it.
   */
  async detail(locale: string): Promise<LocaleCatalogueDetail> {
    const tag = this.canonical(locale);
    const [english, shipped, locales] = await Promise.all([
      this.englishCatalogue(),
      this.shipped.locales(),
      this.configuration.getLocaleSettings(),
    ]);

    const localised = await this.localisedCatalogue(tag, english);
    const overrides = new Map(
      (await this.overrides.findByLocale(tag)).map((row) => [
        row.key,
        row.value,
      ]),
    );

    const entries: TranslationEntry[] = Object.keys(english)
      .sort()
      .map((key) => {
        const shippedText = localised[key] ?? null;
        const override = overrides.get(key) ?? null;
        return {
          key,
          english: english[key],
          shipped: shippedText,
          override,
          value: override ?? shippedText ?? english[key],
          state: override
            ? ('overridden' as const)
            : shippedText
              ? ('shipped' as const)
              : ('missing' as const),
        };
      });

    return {
      ...this.tally(tag, english, localised, overrides, shipped, locales),
      entries,
    };
  }

  /**
   * Writes what was sent and reports what it changed.
   *
   * One code path for a single edit and for an import of a whole file: they
   * differ only in size, and two paths would be two answers to "does an empty
   * value reset a key".
   *
   * Refused (400) rather than reported: a value that is not a string or is
   * longer than the column allows. Those are malformed requests, and a
   * translator who pasted a 9000-character paragraph needs to be told rather
   * than to find one key quietly missing. Refused too: nothing at all, because a
   * write that changes nothing by design is a mistake at the caller.
   */
  async write(
    locale: string,
    entries: Readonly<Record<string, unknown>>,
  ): Promise<TranslationWriteResult> {
    const tag = this.canonical(locale);
    const keys = Object.keys(entries);

    if (keys.length === 0) {
      throw new BadRequestException('entries must contain at least one key');
    }
    if (keys.length > MAX_TRANSLATION_WRITE_ENTRIES) {
      throw new BadRequestException(
        `entries must not contain more than ${MAX_TRANSLATION_WRITE_ENTRIES} keys`,
      );
    }

    const english = await this.englishCatalogue();
    const localised = await this.localisedCatalogue(tag, english);
    const overrides = new Map(
      (await this.overrides.findByLocale(tag)).map((row) => [
        row.key,
        row.value,
      ]),
    );

    const write: TranslationOverrideValue[] = [];
    const remove: string[] = [];
    const ignored: string[] = [];
    let unchanged = 0;

    for (const key of keys) {
      const value = entries[key];
      if (typeof value !== 'string') {
        throw new BadRequestException(`entries.${key} must be a string`);
      }
      if (value.length > MAX_TRANSLATION_VALUE_LENGTH) {
        throw new BadRequestException(
          `entries.${key} must be at most ${MAX_TRANSLATION_VALUE_LENGTH} characters`,
        );
      }

      // Both a malformed key and a key this image does not have end up here: to
      // an organization importing last year's file the two are the same event,
      // and the result names them either way (F75).
      if (!isTranslationKey(key) || !(key in english)) {
        ignored.push(key);
        continue;
      }

      // Whitespace only counts as "no translation of my own". Not trimmed
      // otherwise — a translation may legitimately end in a space, and silently
      // eating it would be a formatting decision taken behind the translator.
      const desired = value.trim() === '' ? null : value;
      const shippedText = localised[key] ?? null;
      // A value identical to what the image ships needs no row (F74): the row
      // would only ever mean "keep this wording even if the next image changes
      // it", which nobody asked for.
      const target =
        desired !== null && desired === shippedText ? null : desired;
      const current = overrides.get(key) ?? null;

      if (target === current) {
        unchanged += 1;
        continue;
      }
      if (target === null) {
        remove.push(key);
        overrides.delete(key);
      } else {
        write.push({ key, value: target });
        overrides.set(key, target);
      }
    }

    await this.overrides.apply({ locale: tag, write, remove });

    const [shipped, locales] = await Promise.all([
      this.shipped.locales(),
      this.configuration.getLocaleSettings(),
    ]);

    return {
      locale: tag,
      written: write.length,
      reset: remove.length,
      unchanged,
      ignored: ignored.slice(0, MAX_REPORTED_IGNORED_KEYS),
      // Counted from the map this method just maintained rather than by reading
      // the rows again: the two would have to agree, and the write above is what
      // decides.
      summary: this.tally(tag, english, localised, overrides, shipped, locales),
    };
  }

  /** Drops the instance's own text for one key, back to what the image ships. */
  reset(locale: string, key: string): Promise<TranslationWriteResult> {
    // Through the same path as a write, so "reset" cannot come to mean something
    // slightly different from "save an empty value".
    return this.write(locale, { [key]: '' });
  }

  /**
   * The shipped English catalogue — the key list of everything above.
   *
   * An image without one is a build mistake rather than a state to render
   * around: every figure here would be zero out of zero and every language would
   * look complete. Failing loudly is the same choice `AppConfigRepository` makes
   * for a missing configuration row.
   */
  private async englishCatalogue(): Promise<TranslationCatalogue> {
    const english = await this.shipped.read(FALLBACK_LOCALE);
    if (!english) {
      throw new Error(
        `this image ships no ${FALLBACK_LOCALE} catalogue — check I18N_CATALOGUE_DIR`,
      );
    }
    return english;
  }

  /**
   * A language's shipped text, filtered to the keys English has.
   *
   * The same filter the served catalogue applies: a shipped file with an extra
   * key would otherwise count towards a completeness figure for something no
   * template asks for.
   */
  private async localisedCatalogue(
    tag: string,
    english: TranslationCatalogue,
  ): Promise<TranslationCatalogue> {
    const shipped =
      tag === FALLBACK_LOCALE ? english : await this.shipped.read(tag);
    if (!shipped) return {};

    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(shipped)) {
      if (key in english) filtered[key] = value;
    }
    return filtered;
  }

  private async summarize(
    tag: string,
    english: TranslationCatalogue,
    shipped: readonly string[],
    locales: LocaleSettings,
  ): Promise<LocaleSummary> {
    const localised = await this.localisedCatalogue(tag, english);
    const overrides = new Map(
      (await this.overrides.findByLocale(tag)).map((row) => [
        row.key,
        row.value,
      ]),
    );
    return this.tally(tag, english, localised, overrides, shipped, locales);
  }

  /**
   * The figures of one language, from material already in hand.
   *
   * Pure and synchronous on purpose: every caller has just read the same three
   * things for its own reasons, and a version of this that fetched them would be
   * a second reader that could answer differently from the catalogue being
   * served.
   */
  private tally(
    tag: string,
    english: TranslationCatalogue,
    localised: TranslationCatalogue,
    overrides: ReadonlyMap<string, string>,
    shipped: readonly string[],
    locales: LocaleSettings,
  ): LocaleSummary {
    const keys = Object.keys(english);
    let translated = 0;
    for (const key of keys) {
      if (overrides.has(key) || localised[key]) translated += 1;
    }

    return {
      locale: tag,
      shipped: shipped.includes(tag),
      active: locales.activeLocales.includes(tag),
      isDefault: locales.defaultLocale === tag,
      total: keys.length,
      translated,
      // Only rows for keys this image has: a row left over from an older image
      // is ignored on read (the served catalogue filters it), so counting it
      // here would claim work that has no effect.
      overrides: [...overrides.keys()].filter((key) => key in english).length,
    };
  }

  /**
   * Normalises a tag from a URL, or refuses it.
   *
   * Lower-cased for the same reason the served catalogue lower-cases it: `de-AT`
   * and `de-at` are one language, and two spellings would be two sets of rows
   * for one translation.
   */
  private canonical(locale: string): string {
    const tag = locale.trim();
    if (!isLocaleTag(tag)) {
      throw new BadRequestException(
        'locale must be a BCP 47 language tag such as de or de-AT',
      );
    }
    return tag.toLowerCase();
  }
}

/**
 * English first, then alphabetically.
 *
 * English is the key list and the fallback, so it is the row every other row is
 * measured against — putting it at the top is the same ordering the editor
 * shows.
 */
function byFallbackFirst(left: string, right: string): number {
  if (left === right) return 0;
  if (left === FALLBACK_LOCALE) return -1;
  if (right === FALLBACK_LOCALE) return 1;
  return left.localeCompare(right);
}
