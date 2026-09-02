import { Inject, Injectable, Logger } from '@nestjs/common';
import { FALLBACK_LOCALE } from '@trefaro/shared-models';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
} from '../common/ports/profile-directory.port';
import { ConfigurationService } from '../config';
import { CatalogueService } from '../i18n';
import { ALL_MAIL_KEYS, mailStrings, type MailStrings } from './templates';

/**
 * Which language a mail goes out in, and where its words come from (E22, E24).
 *
 * Until AP 10 the answer was a registry of TypeScript files, one per language,
 * and adding a language meant a rebuild — which is precisely what chapter 4
 * rules out. The words now come from the catalogue the organization maintains,
 * so the confirmation mail's subject is one edit on the language page away, with
 * no deployment in between.
 *
 * What this service adds on top of the per-key chain is **E24: a mail falls back
 * as a whole**. If the language the instance writes in is missing so much as one
 * piece of a letter, the entire letter goes out in English rather than in a
 * German with English paragraphs in it. The difference from a screen is that
 * nobody can reload a mail: a half-translated button reads as a gap in a
 * translation, a half-translated letter reads as a fault in the organization.
 *
 * The unit of that fallback is **one mail**, not the catalogue: a language that
 * has translated the three registration mails and not the invitation sends three
 * German mails and one English one. Any coarser and one untranslated sentence
 * would push an instance's whole correspondence into English; any finer and E24
 * would not exist.
 */
@Injectable()
export class MailCatalogue {
  private readonly logger = new Logger(MailCatalogue.name);

  constructor(
    private readonly catalogue: CatalogueService,
    private readonly configuration: ConfigurationService,
    // Which language an address has chosen (F125) — a port, not the accounts
    // module: mail cannot import it (that module sends mail), and what is
    // needed is one field of one row (F100).
    @Inject(PROFILE_DIRECTORY)
    private readonly directory: ProfileDirectory,
  ) {}

  /**
   * The words for one mail, in the best language it can be written in.
   *
   * Two questions in order (F125). **Whose language is this?** — the
   * recipient's, if that address has an account and a preference on it;
   * otherwise the organization's default, which is the only answer phase 1 and
   * 2 could give. **Can that language write this letter?** — E24, unchanged:
   * if one piece is missing the whole mail goes out in English.
   *
   * The answer carries the language it settled on, and the caller renders the
   * *content* in the same one — otherwise a German event title would end up in
   * an English letter, which is the mixture E24 exists to prevent.
   *
   * @param recipient the address this mail is going to, when there is one to
   *   ask about. Only ever used to read a preference: nothing is sent from
   *   here, and no profile is read (F55).
   */
  async strings(
    keys: readonly string[],
    recipient?: string,
  ): Promise<MailStrings> {
    const tag = await this.languageFor(recipient);

    if (tag !== FALLBACK_LOCALE) {
      const own = await this.catalogue.ownTexts(tag);
      const missing = keys.filter((key) => typeof own[key] !== 'string');
      if (missing.length === 0) return mailStrings(tag, keys, own);

      // Named, not counted: an organizer who wonders why the invitation went
      // out in English gets the answer from one log line, and the language
      // administration shows the same keys as missing.
      this.logger.warn(
        `Sending in ${FALLBACK_LOCALE} instead of ${tag}: no ${tag} text for ` +
          `${missing.join(', ')}`,
      );
    }

    const { catalogue } = await this.catalogue.resolve(FALLBACK_LOCALE);
    return mailStrings(FALLBACK_LOCALE, keys, catalogue);
  }

  /**
   * Whose language a letter is written in, before E24 has its say.
   *
   * A preference that cannot write this mail falls back to English rather than
   * to the instance's default: somebody who chose Swahili has said that they do
   * not read the organization's German, and the default is not a second guess
   * at what they meant. English is the key list (E23) and the one language
   * every instance can write.
   */
  private async languageFor(recipient?: string): Promise<string> {
    const chosen = recipient ? await this.directory.localeFor(recipient) : null;
    if (chosen) return chosen.trim().toLowerCase();

    const { defaultLocale } = await this.configuration.getLocaleSettings();
    return defaultLocale.trim().toLowerCase();
  }

  /**
   * The languages this instance can write every one of its mails in.
   *
   * The setup wizard's list of default languages, and the honest successor to
   * the compile-time `MAIL_TEMPLATE_LOCALES`: since the text is data, "does this
   * image have German mail templates" became "does this instance have German
   * words for all of them", and only a lookup can answer that. English always
   * qualifies — it is the key list (E23), so a key it lacks is a key that does
   * not exist.
   *
   * Strict on purpose: a language qualifies only if it covers **every** mail,
   * not merely the one the operator will see first. Choosing a default is a
   * decision about all future correspondence, and E24 would otherwise let an
   * instance be set to a language that quietly writes half its letters in
   * English.
   */
  async localesForMail(): Promise<readonly string[]> {
    const servable = await this.catalogue.servableLocales();
    const complete: string[] = [];

    for (const locale of servable) {
      if (locale === FALLBACK_LOCALE) {
        complete.push(locale);
        continue;
      }
      const own = await this.catalogue.ownTexts(locale);
      if (ALL_MAIL_KEYS.every((key) => typeof own[key] === 'string')) {
        complete.push(locale);
      }
    }

    return complete;
  }
}
