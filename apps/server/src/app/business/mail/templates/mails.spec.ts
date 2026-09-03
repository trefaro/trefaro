import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TranslationCatalogue } from '@trefaro/shared-models';
import { ALL_MAIL_KEYS, MAIL_TEMPLATES } from './mails';
import { mailStrings } from './strings';
import type {
  ConfirmationMailContext,
  ContactAnswerMailContext,
  ContactRequestMailContext,
  InvitationMailContext,
  MailTemplate,
  ReceiptMailContext,
  RenderedMail,
} from './types';

/**
 * The four mails, rendered out of the catalogues this image really ships.
 *
 * Against the files rather than against a fixture, and this is the point of the
 * whole file: until AP 10 a missing German sentence was a compile error, because
 * every language was an object implementing an interface. The text is data now
 * (E22), so the guarantee had to become a test — and a test with its own little
 * catalogue would guarantee nothing about what a participant receives.
 *
 * Found by walking up from the working directory rather than taken from it, the
 * way `catalogues.spec.ts` in the library can: Nx runs Vitest from the workspace
 * root and Jest from the project's own directory, so the one path that works in
 * both is the one nobody wrote down.
 */
const CATALOGUE_DIR = locateCatalogues();

function locateCatalogues(): string {
  let directory = process.cwd();
  for (;;) {
    const candidate = join(directory, 'libs', 'shared-i18n', 'catalogues');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error('cannot find libs/shared-i18n/catalogues above the cwd');
    }
    directory = parent;
  }
}

function shipped(locale: string): TranslationCatalogue {
  return JSON.parse(
    readFileSync(join(CATALOGUE_DIR, `${locale}.json`), 'utf8'),
  ) as TranslationCatalogue;
}

const CATALOGUES = { en: shipped('en'), de: shipped('de') };
const LOCALES = ['en', 'de'] as const;

function render<Context>(
  locale: (typeof LOCALES)[number],
  template: MailTemplate<Context>,
  context: Context,
): RenderedMail {
  return template.render(
    mailStrings(locale, template.keys, CATALOGUES[locale]),
    context,
  );
}

const CONTEXT: ConfirmationMailContext = {
  firstName: 'Amina',
  confirmUrl: 'https://events.example.org/registrations/confirm?token=abc.def',
  event: {
    name: 'Kickoff in Köln',
    startsAt: '2027-03-28T08:00:00.000Z',
    endsAt: '2027-03-28T15:00:00.000Z',
    timezone: 'Europe/Berlin',
    url: 'https://events.example.org/series/buergerraete/events/kickoff',
  },
};

/**
 * The receipt carries one thing the request does not: the personal link (E11).
 *
 * Two different contexts rather than one optional field, so a template that
 * forgot the link would not compile — the link is what makes FR 3.10 reachable
 * without a participant login.
 */
const RECEIPT: ReceiptMailContext = {
  firstName: CONTEXT.firstName,
  event: CONTEXT.event,
  selfServiceUrl: 'https://events.example.org/registrations/me?token=ghi.jkl',
};

/**
 * An invitation to former participants (FR 2.4).
 *
 * The organizer writes the subject and the paragraphs; the objection link and
 * the sentence explaining it are the template's, which is what makes them
 * impossible to leave out of a message (F58).
 */
const INVITATION: InvitationMailContext = {
  firstName: 'Amina',
  seriesName: 'Bürgerräte',
  subject: 'You are invited: Democracy Days 2027',
  paragraphs: ['we would love to see you again.', 'Registration is open.'],
  event: CONTEXT.event,
  optOutUrl: 'https://events.example.org/invitations/unsubscribe?token=mno.pqr',
};

/**
 * A question from somebody without an account (FR 3.4, UC 14, F11) — AP 9.
 *
 * The one context whose text a **stranger** typed, which is why the escaping
 * assertion below matters more here than anywhere else: an organizer's
 * invitation at least comes from somebody with a login.
 */
const CONTACT_REQUEST: ContactRequestMailContext = {
  event: CONTEXT.event,
  guestName: 'Amina Okonkwo',
  guestEmail: 'amina@example.org',
  paragraphs: ['is the venue accessible by wheelchair?', 'Thanks in advance.'],
  answerUrl: 'https://admin.events.example.org/messages/conversation-1',
};

/**
 * The organizer's answer to that question (F11, F174) — AP 10.
 *
 * The other half of the letter above, and the one that makes F11 true: the
 * person has no inbox in this application, so the answer leaves it.
 */
const CONTACT_ANSWER: ContactAnswerMailContext = {
  guestName: 'Amina Okonkwo',
  event: CONTEXT.event,
  paragraphs: ['yes, the whole ground floor is level.', 'See you there.'],
};

describe('the shipped catalogues, as mail text (E24)', () => {
  it('cover every key any of the mails asks for', () => {
    // The successor to the compile-time guarantee E24 gave up: English is the
    // key list, so a key missing here is a mail this image cannot write at all,
    // in any language.
    const missing = ALL_MAIL_KEYS.filter(
      (key) => typeof CATALOGUES.en[key] !== 'string',
    );
    expect(missing).toEqual([]);
  });

  it('cover them in German too, so a German instance never falls back', () => {
    // A shipped language may not be partial (`catalogues.spec.ts` holds the
    // whole catalogue to that). Repeated here for the mails specifically,
    // because this is the gap whose symptom is a German instance quietly
    // sending English letters rather than a button in the wrong language.
    const missing = ALL_MAIL_KEYS.filter(
      (key) => typeof CATALOGUES.de[key] !== 'string',
    );
    expect(missing).toEqual([]);
  });

  it('leave no placeholder unfilled in any rendered mail', () => {
    // The renderer leaves an unknown `{{ }}` standing on purpose, so this is
    // what would show it: a template asking for a parameter it does not pass, or
    // a catalogue sentence with a placeholder nobody supplies.
    for (const locale of LOCALES) {
      const mails = [
        render(locale, MAIL_TEMPLATES.registrationConfirmation, CONTEXT),
        render(locale, MAIL_TEMPLATES.registrationConfirmed, RECEIPT),
        render(locale, MAIL_TEMPLATES.registrationCancelled, CONTEXT),
        render(locale, MAIL_TEMPLATES.invitation, INVITATION),
        render(locale, MAIL_TEMPLATES.contactRequest, CONTACT_REQUEST),
        render(locale, MAIL_TEMPLATES.contactAnswer, CONTACT_ANSWER),
      ];
      for (const mail of mails) {
        expect(`${mail.subject}\n${mail.text}\n${mail.html}`).not.toMatch(/{{/);
      }
    }
  });
});

describe('the registration mails', () => {
  it('name the event and its time in both languages', () => {
    for (const locale of LOCALES) {
      const mail = render(
        locale,
        MAIL_TEMPLATES.registrationConfirmed,
        RECEIPT,
      );

      expect(mail.subject).toContain('Kickoff in Köln');
      // Rendered in the event's zone, not the server's (E8): 08:00 UTC is 10:00
      // in Cologne, and a participant reading "08:00" would arrive two hours late.
      expect(mail.text).toContain('10:00');
      expect(mail.text).toContain(CONTEXT.event.url);
    }
  });

  it('write the date in the language the mail turned out to be in (F78)', () => {
    const english = render(
      'en',
      MAIL_TEMPLATES.registrationConfirmed,
      RECEIPT,
    ).text;
    const german = render(
      'de',
      MAIL_TEMPLATES.registrationConfirmed,
      RECEIPT,
    ).text;

    // The zone stays the event's (E8); the words around it follow the letter.
    expect(english).toContain('March');
    expect(german).toContain('März');
  });

  it('says how long the confirmation link lasts, from the signer’s own number', () => {
    // Fourteen days is E5's decision and lives in `CONFIRMATION_TOKEN_TTL_MS`.
    // Written into the sentence as a parameter, so a change there cannot leave
    // two catalogues claiming something else.
    for (const locale of LOCALES) {
      const mail = render(
        locale,
        MAIL_TEMPLATES.registrationConfirmation,
        CONTEXT,
      );
      expect(mail.text).toContain('14');
    }
  });

  it('escape what a participant or an organizer typed', () => {
    const mail = render('en', MAIL_TEMPLATES.registrationConfirmation, {
      ...CONTEXT,
      firstName: '<script>alert(1)</script>',
      event: { ...CONTEXT.event, name: 'Kickoff & "Friends"' },
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('Kickoff &amp; &quot;Friends&quot;');
  });

  it('put no remotely loaded asset in the body', () => {
    const mail = render('de', MAIL_TEMPLATES.registrationConfirmed, RECEIPT);

    // No image, no stylesheet, no font: opening the mail must not tell anyone
    // that it was opened (NFR 9).
    expect(mail.html).not.toMatch(/<img|<link|@import|url\(/i);
  });

  it('carry the personal link in the receipt, in both languages (E11)', () => {
    for (const locale of LOCALES) {
      const mail = render(
        locale,
        MAIL_TEMPLATES.registrationConfirmed,
        RECEIPT,
      );

      expect(mail.text).toContain(RECEIPT.selfServiceUrl);
      expect(mail.html).toContain(RECEIPT.selfServiceUrl);
      // And it says what the link is worth: whoever holds it can change this
      // registration, which is the trade-off of not having a login yet.
      expect(mail.text).toMatch(/weiter|yourself/i);
    }
  });

  it('keep the personal link out of the confirmation request', () => {
    // Before the address is confirmed there is nothing to self-serve, and a link
    // that granted sign-ups beforehand would make the double opt-in decorative.
    for (const locale of LOCALES) {
      const mail = render(
        locale,
        MAIL_TEMPLATES.registrationConfirmation,
        CONTEXT,
      );

      expect(mail.text).not.toContain('/registrations/me');
      expect(mail.html).not.toContain('/registrations/me');
    }
  });

  it('offer the same thing in the text part as in the HTML part', () => {
    // One key for the call to action, two renderings of it: the label of the
    // link and the line above the bare address. Two keys would let a German
    // reader of the text part be invited to do something else.
    const mail = render('de', MAIL_TEMPLATES.registrationConfirmation, CONTEXT);

    expect(mail.text).toContain(`Anmeldung bestätigen:\n${CONTEXT.confirmUrl}`);
    expect(mail.html).toContain('>Anmeldung bestätigen</a>');
  });
});

describe('the invitation template (FR 2.4, E15)', () => {
  it('sends the subject the organizer wrote, not one of its own', () => {
    for (const locale of LOCALES) {
      const mail = render(locale, MAIL_TEMPLATES.invitation, INVITATION);

      expect(mail.subject).toBe('You are invited: Democracy Days 2027');
    }
  });

  it('carries the objection link in both parts and both languages (F58)', () => {
    for (const locale of LOCALES) {
      const mail = render(locale, MAIL_TEMPLATES.invitation, INVITATION);

      // Not optional and not the organizer's to write: without this link,
      // writing to former participants would not be legitimate at all.
      expect(mail.text).toContain(INVITATION.optOutUrl);
      expect(mail.html).toContain(INVITATION.optOutUrl);
    }
  });

  it('says why the mail arrived, naming the series', () => {
    const mail = render('en', MAIL_TEMPLATES.invitation, INVITATION);

    expect(mail.text).toContain('Bürgerräte');
    expect(mail.text).toMatch(/registered for an event/i);
  });

  it('keeps the organizer’s paragraphs apart', () => {
    const mail = render('de', MAIL_TEMPLATES.invitation, INVITATION);

    expect(mail.text).toContain(
      'we would love to see you again.\n\nRegistration is open.',
    );
  });

  it('escapes what the organizer typed rather than sending it as markup', () => {
    const mail = render('en', MAIL_TEMPLATES.invitation, {
      ...INVITATION,
      paragraphs: ['<script>alert(1)</script>'],
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('names the event when the invitation invites to one', () => {
    const mail = render('en', MAIL_TEMPLATES.invitation, INVITATION);

    expect(mail.text).toContain('Kickoff in Köln');
    expect(mail.text).toContain(CONTEXT.event.url);
    // In the event's own zone (E8): 08:00 UTC is 10:00 in Cologne.
    expect(mail.text).toContain('10:00');
  });

  it('goes out without an event block when none was named', () => {
    const mail = render('en', MAIL_TEMPLATES.invitation, {
      ...INVITATION,
      event: null,
    });

    expect(mail.text).not.toContain('Kickoff in Köln');
    // But the objection link is still there — it never depends on anything.
    expect(mail.text).toContain(INVITATION.optOutUrl);
  });

  it('loads nothing from anywhere when opened', () => {
    const mail = render('de', MAIL_TEMPLATES.invitation, INVITATION);

    expect(mail.html).not.toMatch(/<img|<link|@import|url\(/i);
  });
});

describe('the cancellation notice (F59)', () => {
  it('says which event and that it was the organizers, in both languages', () => {
    for (const locale of LOCALES) {
      const mail = render(
        locale,
        MAIL_TEMPLATES.registrationCancelled,
        CONTEXT,
      );

      expect(mail.subject).toContain('Kickoff in Köln');
      expect(mail.text).toMatch(/organizers|Veranstaltungsteam/);
      // And the way back, because the usual reason to read this is a mistake.
      expect(mail.text).toContain(CONTEXT.event.url);
    }
  });

  it('carries no objection link — it is not an invitation', () => {
    const mail = render('en', MAIL_TEMPLATES.registrationCancelled, CONTEXT);

    // This message goes out whether or not the address objected to being
    // invited (F59), so offering to stop it would be an offer this application
    // does not make.
    expect(mail.text).not.toContain('/invitations/unsubscribe');
    expect(mail.html).not.toContain('/invitations/unsubscribe');
  });
});

describe('the contact notification (FR 3.4, UC 14, F11)', () => {
  it('names the event in the subject, in both languages', () => {
    for (const locale of LOCALES) {
      const mail = render(
        locale,
        MAIL_TEMPLATES.contactRequest,
        CONTACT_REQUEST,
      );

      expect(mail.subject).toContain('Kickoff in Köln');
      expect(mail.text).toContain('Amina Okonkwo');
    }
  });

  it('carries the address the answer goes to (F11)', () => {
    for (const locale of LOCALES) {
      const mail = render(
        locale,
        MAIL_TEMPLATES.contactRequest,
        CONTACT_REQUEST,
      );

      // The whole point of this letter: the organization can answer without
      // opening anything, because the person has no inbox in this application.
      expect(mail.text).toContain('amina@example.org');
      expect(mail.html).toContain('amina@example.org');
    }
  });

  it('greets nobody', () => {
    // The one mail with no addressee: it arrives in a shared mailbox, and
    // "Hello Democracy International" is a robot addressing an organization by
    // its own name. Asserted as "the first thing said is the news".
    for (const locale of LOCALES) {
      const mail = render(
        locale,
        MAIL_TEMPLATES.contactRequest,
        CONTACT_REQUEST,
      );

      expect(mail.text.startsWith('Amina Okonkwo')).toBe(true);
      expect(mail.text).not.toMatch(/Hello|Hallo/);
    }
  });

  it('keeps the paragraphs a stranger wrote apart', () => {
    const mail = render('en', MAIL_TEMPLATES.contactRequest, CONTACT_REQUEST);

    expect(mail.text).toContain(
      'is the venue accessible by wheelchair?\n\nThanks in advance.',
    );
  });

  it('escapes what a stranger typed rather than sending it as markup', () => {
    const mail = render('en', MAIL_TEMPLATES.contactRequest, {
      ...CONTACT_REQUEST,
      guestName: '<script>alert(1)</script>',
      paragraphs: ['<img src=x onerror=alert(1)>'],
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('&lt;img');
  });

  it('leads to the organizer client and nowhere else', () => {
    const mail = render('de', MAIL_TEMPLATES.contactRequest, CONTACT_REQUEST);

    expect(mail.text).toContain(CONTACT_REQUEST.answerUrl);
    // Not a reply link to the guest: an answer written from the application
    // stays with the request (F11), and a mail client's reply would not.
    expect(mail.html).not.toContain('mailto:');
  });

  it('loads nothing from anywhere when opened', () => {
    const mail = render('en', MAIL_TEMPLATES.contactRequest, CONTACT_REQUEST);

    expect(mail.html).not.toMatch(/<img|<link|@import|url\(/i);
  });
});

describe('the answer to somebody without an account (FR 3.4, F11, F174)', () => {
  it('greets the person by the name they typed', () => {
    // The opposite of the notification it answers, and for the reason that one
    // greets nobody: this letter goes to a person, not to a shared mailbox.
    for (const locale of LOCALES) {
      const mail = render(locale, MAIL_TEMPLATES.contactAnswer, CONTACT_ANSWER);

      expect(mail.text).toMatch(/^(Hello|Hallo) Amina Okonkwo,/);
    }
  });

  it('names the event in the subject and says when it is', () => {
    for (const locale of LOCALES) {
      const mail = render(locale, MAIL_TEMPLATES.contactAnswer, CONTACT_ANSWER);

      expect(mail.subject).toContain('Kickoff in Köln');
      // In the event's zone, like every other mail that names a time (E8).
      expect(mail.text).toContain('10:00');
      expect(mail.text).toContain(CONTEXT.event.url);
    }
  });

  it('keeps the organizer’s paragraphs apart', () => {
    const mail = render('en', MAIL_TEMPLATES.contactAnswer, CONTACT_ANSWER);

    expect(mail.text).toContain(
      'yes, the whole ground floor is level.\n\nSee you there.',
    );
  });

  it('escapes what the organizer typed rather than sending it as markup', () => {
    const mail = render('en', MAIL_TEMPLATES.contactAnswer, {
      ...CONTACT_ANSWER,
      guestName: '<b>Amina</b>',
      paragraphs: ['<script>alert(1)</script>'],
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('&lt;b&gt;Amina');
  });

  it('offers no button of its own', () => {
    // The only address worth offering is the event page, which the event block
    // already links — and the recipient has nothing here to log in to.
    const mail = render('en', MAIL_TEMPLATES.contactAnswer, CONTACT_ANSWER);

    expect(mail.text).not.toContain('/messages');
    expect(mail.html).not.toContain('mailto:');
  });

  it('loads nothing from anywhere when opened', () => {
    const mail = render('en', MAIL_TEMPLATES.contactAnswer, CONTACT_ANSWER);

    expect(mail.html).not.toMatch(/<img|<link|@import|url\(/i);
  });
});
