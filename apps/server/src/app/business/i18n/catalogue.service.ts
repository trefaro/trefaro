import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  FALLBACK_LOCALE,
  MAX_LOCALE_TAG_LENGTH,
  type TranslationCatalogue,
} from '@trefaro/shared-models';
import { ConfigurationService } from '../config';
import {
  SHIPPED_CATALOGUE_READER,
  type ShippedCatalogueReader,
} from './ports/shipped-catalogue.reader';
import {
  TRANSLATION_OVERRIDE_REPOSITORY,
  type TranslationOverrideReader,
} from './ports/translation-override.repository';

/** One resolved catalogue and the tag a client can revalidate it with. */
export interface ResolvedCatalogue {
  readonly locale: string;
  readonly catalogue: TranslationCatalogue;
  readonly etag: string;
}

/**
 * A storable, servable language tag — the same shape the configuration accepts.
 *
 * Repeated here rather than shared with `ConfigurationService`, because this one
 * also guards a file name: the tag arrives in a URL, and what it must not be
 * able to do is describe a path.
 */
const LOCALE_TAG_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/;

/**
 * The catalogue both clients fetch, and the mails will (E22, E23).
 *
 * Two sources, one answer. The **shipped** catalogues travel in the image and
 * are the reason a fresh instance speaks English and German at all; the
 * **overrides** are rows an organization wrote, and they are the reason chapter
 * 4's "new languages maintainable by the organization" is more than a sentence.
 *
 * The resolution chain per key, in this order (E23):
 *
 *   1. the instance's own value for this language,
 *   2. the shipped value for this language,
 *   3. the shipped English value.
 *
 * Per key, not per catalogue — which is what makes a partly translated language
 * usable rather than a screen full of blank buttons. The one place this rule does
 * *not* hold is a mail (E24): a mail cannot be reloaded, and an English paragraph
 * inside a German letter reads like a fault rather than like a missing
 * translation. AP 10 implements that separately, on top of this service.
 *
 * Because step 3 fills every gap, a client never has to handle a missing key.
 * Its own `fallbackLang` is a second net for the one case this service cannot
 * cover: a server that is unreachable.
 */
@Injectable()
export class CatalogueService {
  constructor(
    @Inject(SHIPPED_CATALOGUE_READER)
    private readonly shipped: ShippedCatalogueReader,
    @Inject(TRANSLATION_OVERRIDE_REPOSITORY)
    private readonly overrides: TranslationOverrideReader,
    private readonly configuration: ConfigurationService,
  ) {}

  /**
   * Whether this instance answers for a language at all.
   *
   * Two ways to qualify, because the two say different things: a language is
   * **shipped** (its file is in the image) or it is **offered** (the
   * organization put it in `active_locales`). AP 7 creates a language by
   * translating it, so a locale that exists only as rows has to be servable —
   * otherwise the screen that writes the translation could not preview it.
   */
  async isServable(locale: string): Promise<boolean> {
    if ((await this.shipped.locales()).includes(locale)) return true;
    const config = await this.configuration.getAppConfig();
    return config.availableLocales.includes(locale);
  }

  /**
   * Resolves one language into the payload of `GET /api/i18n/:locale`.
   *
   * The English base is read for every language, including English itself: it is
   * the key list, and a German catalogue with an English key list is precisely
   * what E23 asks for. The cost is one cached file read.
   */
  async resolve(locale: string): Promise<ResolvedCatalogue> {
    const canonical = this.canonical(locale);

    const [english, localised, overrides] = await Promise.all([
      this.shipped.read(FALLBACK_LOCALE),
      canonical === FALLBACK_LOCALE
        ? Promise.resolve(null)
        : this.shipped.read(canonical),
      this.overrides.findByLocale(canonical),
    ]);

    const catalogue: Record<string, string> = { ...(english ?? {}) };
    for (const [key, value] of Object.entries(localised ?? {})) {
      // Only keys English knows: English is the key list, and a shipped file
      // with an extra key would put something in a catalogue that no template
      // asks for and no completeness figure counts.
      if (key in catalogue) catalogue[key] = value;
    }
    for (const override of overrides) {
      // Same filter, and for the same reason — but here it also means a row
      // whose key the image no longer ships is ignored on read rather than
      // being an integrity problem. Every row that matters is a row for a key
      // this image has, and those win.
      if (override.key in catalogue) catalogue[override.key] = override.value;
    }

    return {
      locale: canonical,
      catalogue,
      etag: etagOf(canonical, catalogue),
    };
  }

  /**
   * Normalises a tag from a URL, or refuses it.
   *
   * Lower-cased, because `de-DE` and `de-de` are one language and a catalogue
   * served under two spellings is two caches of one answer.
   */
  private canonical(locale: string): string {
    const tag = locale.trim();
    if (tag.length > MAX_LOCALE_TAG_LENGTH || !LOCALE_TAG_PATTERN.test(tag)) {
      throw new BadRequestException(
        'locale must be a BCP 47 language tag such as de or de-AT',
      );
    }
    return tag.toLowerCase();
  }
}

/**
 * A tag over the served bytes, not over a timestamp.
 *
 * Three things decide this answer — the shipped file, the organization's rows and
 * the resolution rule — and only one of them has an `updated_at`. Hashing the
 * result covers all three, which also means a deployment that ships a new
 * catalogue invalidates every client's copy without anybody remembering to. The
 * catalogues are a few hundred short strings, so the hash is cheaper than the
 * round trip it saves.
 */
function etagOf(locale: string, catalogue: TranslationCatalogue): string {
  const digest = createHash('sha256')
    .update(locale)
    .update(' ')
    .update(JSON.stringify(catalogue))
    .digest('base64url')
    .slice(0, 22);
  return `"${digest}"`;
}
