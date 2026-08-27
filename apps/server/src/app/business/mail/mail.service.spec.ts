import type { AppConfigRecord } from '../config/ports/app-config.repository';
import { MailDeliveryError, MailService } from './mail.service';
import type { Mailer, OutgoingMail } from './ports/mailer';
import { mailTemplates } from './templates';
import type {
  ConfirmationMailContext,
  InvitationMailContext,
  ReceiptMailContext,
} from './templates';

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

class RecordingMailer implements Mailer {
  readonly sent: OutgoingMail[] = [];
  failure: Error | null = null;

  async send(mail: OutgoingMail): Promise<void> {
    if (this.failure) throw this.failure;
    this.sent.push(mail);
  }
}

const configWith = (defaultLocale: string) => ({
  load: async (): Promise<AppConfigRecord> => ({
    primaryColor: '#1c4b8c',
    accentColor: '#e8a33d',
    logoPath: null,
    fontFamily: 'system-ui',
    defaultLocale,
    availableLocales: ['en', defaultLocale],
  }),
});

describe('MailService', () => {
  let mailer: RecordingMailer;

  const serviceFor = (locale: string): MailService => {
    mailer = new RecordingMailer();
    return new MailService(mailer, configWith(locale));
  };

  it('writes in the language the instance is configured in', async () => {
    await serviceFor('de').sendRegistrationConfirmation(
      'a@example.org',
      CONTEXT,
    );

    const [mail] = mailer.sent;
    expect(mail.to).toBe('a@example.org');
    expect(mail.subject).toContain('bestätige');
    expect(mail.text).toContain(CONTEXT.confirmUrl);
    expect(mail.html).toContain(CONTEXT.confirmUrl);
  });

  it('falls back to English for a language it has no templates for', async () => {
    await serviceFor('sw').sendRegistrationConfirmation(
      'a@example.org',
      CONTEXT,
    );

    expect(mailer.sent[0].subject).toContain('confirm your registration');
  });

  it('uses the base language of a regional locale', async () => {
    await serviceFor('de-AT').sendRegistrationConfirmation(
      'a@example.org',
      CONTEXT,
    );

    expect(mailer.sent[0].subject).toContain('bestätige');
  });

  it('always sends a text part as well as HTML', async () => {
    const service = serviceFor('en');

    await service.sendRegistrationConfirmation('a@example.org', CONTEXT);
    await service.sendRegistrationConfirmed('a@example.org', RECEIPT);

    for (const mail of mailer.sent) {
      expect(mail.text.trim().length).toBeGreaterThan(0);
      expect(mail.html).toContain('<p>');
    }
  });

  it('reports a delivery failure instead of pretending to have sent', async () => {
    const service = serviceFor('en');
    mailer.failure = new Error('ECONNREFUSED');

    await expect(
      service.sendRegistrationConfirmation('a@example.org', CONTEXT),
    ).rejects.toBeInstanceOf(MailDeliveryError);
  });
});

describe('mail templates', () => {
  it('name the event and its time in both languages', () => {
    for (const locale of ['en', 'de']) {
      const mail = mailTemplates(locale).registrationConfirmed(RECEIPT);

      expect(mail.subject).toContain('Kickoff in Köln');
      // Rendered in the event's zone, not the server's (E8): 08:00 UTC is 10:00
      // in Cologne, and a participant reading "08:00" would arrive two hours late.
      expect(mail.text).toContain('10:00');
      expect(mail.text).toContain(CONTEXT.event.url);
    }
  });

  it('escape what a participant or an organizer typed', () => {
    const mail = mailTemplates('en').registrationConfirmation({
      ...CONTEXT,
      firstName: '<script>alert(1)</script>',
      event: { ...CONTEXT.event, name: 'Kickoff & "Friends"' },
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('Kickoff &amp; &quot;Friends&quot;');
  });

  it('put no remotely loaded asset in the body', () => {
    const mail = mailTemplates('de').registrationConfirmed(RECEIPT);

    // No image, no stylesheet, no font: opening the mail must not tell anyone
    // that it was opened (NFR 9).
    expect(mail.html).not.toMatch(/<img|<link|@import|url\(/i);
  });

  it('carry the personal link in the receipt, in both languages (E11)', () => {
    for (const locale of ['en', 'de']) {
      const mail = mailTemplates(locale).registrationConfirmed(RECEIPT);

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
    for (const locale of ['en', 'de']) {
      const mail = mailTemplates(locale).registrationConfirmation(CONTEXT);

      expect(mail.text).not.toContain('/registrations/me');
      expect(mail.html).not.toContain('/registrations/me');
    }
  });
});
describe('the invitation template (FR 2.4, E15)', () => {
  it('sends the subject the organizer wrote, not one of its own', () => {
    for (const locale of ['en', 'de']) {
      const mail = mailTemplates(locale).invitation(INVITATION);

      expect(mail.subject).toBe('You are invited: Democracy Days 2027');
    }
  });

  it('carries the objection link in both parts and both languages (F58)', () => {
    for (const locale of ['en', 'de']) {
      const mail = mailTemplates(locale).invitation(INVITATION);

      // Not optional and not the organizer's to write: without this link,
      // writing to former participants would not be legitimate at all.
      expect(mail.text).toContain(INVITATION.optOutUrl);
      expect(mail.html).toContain(INVITATION.optOutUrl);
    }
  });

  it('says why the mail arrived, naming the series', () => {
    const mail = mailTemplates('en').invitation(INVITATION);

    expect(mail.text).toContain('Bürgerräte');
    expect(mail.text).toMatch(/registered for an event/i);
  });

  it('keeps the organizer’s paragraphs apart', () => {
    const mail = mailTemplates('de').invitation(INVITATION);

    expect(mail.text).toContain(
      'we would love to see you again.\n\nRegistration is open.',
    );
  });

  it('escapes what the organizer typed rather than sending it as markup', () => {
    const mail = mailTemplates('en').invitation({
      ...INVITATION,
      paragraphs: ['<script>alert(1)</script>'],
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('names the event when the invitation invites to one', () => {
    const mail = mailTemplates('en').invitation(INVITATION);

    expect(mail.text).toContain('Kickoff in Köln');
    expect(mail.text).toContain(CONTEXT.event.url);
    // In the event's own zone (E8): 08:00 UTC is 10:00 in Cologne.
    expect(mail.text).toContain('10:00');
  });

  it('goes out without an event block when none was named', () => {
    const mail = mailTemplates('en').invitation({
      ...INVITATION,
      event: null,
    });

    expect(mail.text).not.toContain('Kickoff in Köln');
    // But the objection link is still there — it never depends on anything.
    expect(mail.text).toContain(INVITATION.optOutUrl);
  });

  it('loads nothing from anywhere when opened', () => {
    const mail = mailTemplates('de').invitation(INVITATION);

    expect(mail.html).not.toMatch(/<img|<link|@import|url\(/i);
  });
});

describe('the cancellation notice (F59)', () => {
  it('says which event and that it was the organizers, in both languages', () => {
    for (const locale of ['en', 'de']) {
      const mail = mailTemplates(locale).registrationCancelled(CONTEXT);

      expect(mail.subject).toContain('Kickoff in Köln');
      expect(mail.text).toMatch(/organizers|Veranstaltungsteam/);
      // And the way back, because the usual reason to read this is a mistake.
      expect(mail.text).toContain(CONTEXT.event.url);
    }
  });

  it('carries no objection link — it is not an invitation', () => {
    const mail = mailTemplates('en').registrationCancelled(CONTEXT);

    // This message goes out whether or not the address objected to being
    // invited (F59), so offering to stop it would be an offer this application
    // does not make.
    expect(mail.text).not.toContain('/invitations/unsubscribe');
    expect(mail.html).not.toContain('/invitations/unsubscribe');
  });
});
