import type { AppConfigRecord } from '../config/ports/app-config.repository';
import { MailDeliveryError, MailService } from './mail.service';
import type { Mailer, OutgoingMail } from './ports/mailer';
import { mailTemplates } from './templates';
import type { ConfirmationMailContext } from './templates';

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
    await serviceFor('de').sendRegistrationConfirmation('a@example.org', CONTEXT);

    const [mail] = mailer.sent;
    expect(mail.to).toBe('a@example.org');
    expect(mail.subject).toContain('bestätige');
    expect(mail.text).toContain(CONTEXT.confirmUrl);
    expect(mail.html).toContain(CONTEXT.confirmUrl);
  });

  it('falls back to English for a language it has no templates for', async () => {
    await serviceFor('sw').sendRegistrationConfirmation('a@example.org', CONTEXT);

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
    await service.sendRegistrationConfirmed('a@example.org', CONTEXT);

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
      const mail = mailTemplates(locale).registrationConfirmed(CONTEXT);

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
    const mail = mailTemplates('de').registrationConfirmed(CONTEXT);

    // No image, no stylesheet, no font: opening the mail must not tell anyone
    // that it was opened (NFR 9).
    expect(mail.html).not.toMatch(/<img|<link|@import|url\(/i);
  });
});
