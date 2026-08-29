import type { TranslationCatalogue } from '@trefaro/shared-models';
import type { ConfigurationService } from '../config';
import type { CatalogueService } from '../i18n';
import { MailCatalogue } from './mail-catalogue.service';
import { ALL_MAIL_KEYS, MAIL_TEMPLATES } from './templates';

/**
 * E24, which is the whole reason this class exists: a mail falls back as a
 * whole, and the unit of "a whole" is one mail.
 *
 * The fake catalogue below stands in for the resolution `CatalogueService`
 * performs — `ownTexts` shows what a language has said itself, `resolve('en')`
 * fills every gap. Keeping both in the fake is what lets these tests state the
 * difference the rule turns on.
 */
const ENGLISH: TranslationCatalogue = Object.fromEntries(
  ALL_MAIL_KEYS.map((key) => [key, `en:${key}`]),
);

class FakeCatalogue {
  own: Record<string, TranslationCatalogue> = {};
  servable: string[] = ['en', 'de'];

  async ownTexts(locale: string): Promise<TranslationCatalogue> {
    return this.own[locale] ?? {};
  }

  async resolve(locale: string) {
    return { locale, catalogue: ENGLISH, etag: '"x"' };
  }

  async servableLocales(): Promise<readonly string[]> {
    return this.servable;
  }
}

const configWith = (defaultLocale: string) =>
  ({
    getLocaleSettings: async () => ({
      defaultLocale,
      activeLocales: ['en', defaultLocale],
    }),
  }) as unknown as ConfigurationService;

const german = (keys: readonly string[]): TranslationCatalogue =>
  Object.fromEntries(keys.map((key) => [key, `de:${key}`]));

describe('MailCatalogue', () => {
  let catalogue: FakeCatalogue;

  const serviceFor = (defaultLocale: string): MailCatalogue => {
    catalogue = new FakeCatalogue();
    return new MailCatalogue(
      catalogue as unknown as CatalogueService,
      configWith(defaultLocale),
    );
  };

  it('writes in the language the instance is configured in', async () => {
    const service = serviceFor('de');
    catalogue.own['de'] = german(ALL_MAIL_KEYS);

    const strings = await service.strings(
      MAIL_TEMPLATES.registrationConfirmation.keys,
    );

    expect(strings.locale).toBe('de');
    expect(strings.text('mail.confirm.subject')).toBe(
      'de:mail.confirm.subject',
    );
  });

  it('sends the whole mail in English when one piece is missing (E24)', async () => {
    const service = serviceFor('de');
    const { keys } = MAIL_TEMPLATES.registrationConfirmation;
    catalogue.own['de'] = german(keys.filter((key) => key !== keys[2]));

    const strings = await service.strings(keys);

    // Not a German mail with one English sentence in it: nobody can reload a
    // letter, and a mixed one reads as a fault rather than as a gap.
    expect(strings.locale).toBe('en');
    for (const key of keys) expect(strings.text(key)).toBe(`en:${key}`);
  });

  it('falls back per mail, not per instance', async () => {
    const service = serviceFor('de');
    // Only the keys the invitation alone uses are withheld — the greeting and
    // the event block belong to the receipt as much as to it.
    const onlyInvitation = MAIL_TEMPLATES.invitation.keys.filter(
      (key) => !MAIL_TEMPLATES.registrationConfirmed.keys.includes(key),
    );
    catalogue.own['de'] = german(
      ALL_MAIL_KEYS.filter((key) => !onlyInvitation.includes(key)),
    );

    const receipt = await service.strings(
      MAIL_TEMPLATES.registrationConfirmed.keys,
    );
    const invitation = await service.strings(MAIL_TEMPLATES.invitation.keys);

    // A language that has translated the registration mails and not the
    // invitation sends German receipts and English invitations. Coarser and one
    // untranslated sentence would push all of it into English.
    expect(receipt.locale).toBe('de');
    expect(invitation.locale).toBe('en');
  });

  it('lets the organization’s own words win over the shipped ones', async () => {
    // The acceptance criterion of AP 10: a changed subject takes effect on the
    // next mail, with no rebuild in between. `ownTexts` is where a row and a
    // shipped line have already been merged.
    const service = serviceFor('de');
    catalogue.own['de'] = {
      ...german(ALL_MAIL_KEYS),
      'mail.confirm.subject': 'Noch ein Klick, dann bist du dabei',
    };

    const strings = await service.strings(
      MAIL_TEMPLATES.registrationConfirmation.keys,
    );

    expect(strings.text('mail.confirm.subject')).toBe(
      'Noch ein Klick, dann bist du dabei',
    );
  });

  it('takes English through the resolution too, so an English edit applies', async () => {
    const service = serviceFor('en');

    const strings = await service.strings(MAIL_TEMPLATES.invitation.keys);

    // `resolve` rather than `ownTexts`: for English the two differ only in that
    // the first applies the organization's rows, and an instance that runs in
    // English must be able to reword its own letters.
    expect(strings.locale).toBe('en');
    expect(strings.text('mail.invitation.action')).toBe(
      'en:mail.invitation.action',
    );
  });

  it('treats a regional tag as its own language, not as its base', async () => {
    const service = serviceFor('de-AT');
    catalogue.own['de-at'] = german(ALL_MAIL_KEYS);

    const strings = await service.strings(MAIL_TEMPLATES.invitation.keys);

    expect(strings.locale).toBe('de-at');
  });

  it('sends English for a language nothing has translated', async () => {
    const service = serviceFor('sw');

    const strings = await service.strings(MAIL_TEMPLATES.invitation.keys);

    expect(strings.locale).toBe('en');
  });
});

describe('MailCatalogue.localesForMail', () => {
  let catalogue: FakeCatalogue;

  const service = (): MailCatalogue => {
    catalogue = new FakeCatalogue();
    return new MailCatalogue(
      catalogue as unknown as CatalogueService,
      configWith('en'),
    );
  };

  it('offers a language only when it can write every mail', async () => {
    const subject = service();
    catalogue.servable = ['en', 'de', 'fr'];
    catalogue.own['de'] = german(ALL_MAIL_KEYS);
    catalogue.own['fr'] = german(MAIL_TEMPLATES.registrationConfirmed.keys);

    // Choosing a default is a decision about all future correspondence: a
    // language that covers the receipt and not the invitation would make the
    // wizard promise something E24 then takes back.
    expect(await subject.localesForMail()).toEqual(['en', 'de']);
  });

  it('always offers English', async () => {
    const subject = service();
    catalogue.servable = ['en', 'de'];

    // English is the key list (E23): a key it lacks is a key that does not
    // exist, so it cannot be incomplete.
    expect(await subject.localesForMail()).toEqual(['en']);
  });
});
