import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  FALLBACK_LOCALE,
  isLocaleTag,
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
 * The catalogue both clients fetch, and the mails are written from (E22, E23).
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
 * translation. That rule lives in the mail module, on top of this service and
 * out of the two readers below: {@link ownTexts} shows the gaps, {@link resolve}
 * fills them.
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
    return (await this.servableLocales()).includes(locale);
  }

  /**
   * The same question asked of every language at once.
   *
   * Its one caller outside this class is the mail module, which has to pick the
   * languages it can write a whole letter in (E24) and cannot do that without
   * first knowing which languages exist at all. Shipped first, so English and
   * German lead a list an operator reads.
   */
  async servableLocales(): Promise<readonly string[]> {
    const [shipped, config] = await Promise.all([
      this.shipped.locales(),
      this.configuration.getAppConfig(),
    ]);
    return [...new Set([...shipped, ...config.availableLocales])];
  }

  /**
   * What a language says in its own words, with the gaps left open.
   *
   * The opposite of {@link resolve}, and the reason both exist: `resolve` fills
   * every gap with English so a client never has to handle a missing key, which
   * makes it useless for the one caller that needs to *see* the gaps. E24 turns
   * on exactly that difference — a mail may not be half German, so the mail
   * module asks which keys this language actually has before it decides what
   * language to write in.
   *
   * Filtered against the English key list for the same reason `resolve` filters:
   * English is the key list (E23), and a row or a shipped line for a key this
   * image does not have is not a translation of anything.
   */
  async ownTexts(locale: string): Promise<TranslationCatalogue> {
    const canonical = this.canonical(locale);
    const [english, localised, overrides] = await Promise.all([
      this.shipped.read(FALLBACK_LOCALE),
      this.shipped.read(canonical),
      this.overrides.findByLocale(canonical),
    ]);

    const known = english ?? {};
    const own: Record<string, string> = {};
    for (const [key, value] of Object.entries(localised ?? {})) {
      if (key in known) own[key] = value;
    }
    for (const override of overrides) {
      if (override.key in known) own[override.key] = override.value;
    }
    return own;
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
    // `isLocaleTag` is also what makes this safe to hand to the shipped
    // catalogue reader: the tag arrives in a URL, and what it must not be able to
    // do is describe a path.
    if (!isLocaleTag(tag)) {
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
