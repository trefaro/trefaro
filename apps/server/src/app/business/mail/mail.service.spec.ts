import type { MailCatalogue } from './mail-catalogue.service';
import { MailDeliveryError, MailService } from './mail.service';
import type { Mailer, OutgoingMail } from './ports/mailer';
import { MAIL_TEMPLATES, mailStrings, type MailStrings } from './templates';
import type { ConfirmationMailContext, ReceiptMailContext } from './templates';

/**
 * What is left of this class since AP 10: picking a template and handing over
 * the result.
 *
 * The words are gone from here — which language a letter is written in and what
 * it says are `MailCatalogue`'s and `templates/`'s, and both have their own
 * spec. What is tested here is the seam: that each sender reaches for its own
 * template, asks for exactly the keys that template declared, and reports a
 * refusal from the mail server instead of pretending to have sent.
 */
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

const RECEIPT: ReceiptMailContext = {
  firstName: CONTEXT.firstName,
  event: CONTEXT.event,
  selfServiceUrl: 'https://events.example.org/registrations/me?token=ghi.jkl',
};

class RecordingMailer implements Mailer {
  readonly sent: OutgoingMail[] = [];
  failure: Error | null = null;

  async send(mail: OutgoingMail): Promise<void> {
    if (this.failure) throw this.failure;
    this.sent.push(mail);
  }
}

/** Answers with the keys it was asked for, so a gap would be visible as one. */
class StubCatalogue {
  locale = 'de';
  readonly asked: string[][] = [];

  async strings(keys: readonly string[]): Promise<MailStrings> {
    this.asked.push([...keys]);
    return mailStrings(
      this.locale,
      keys,
      Object.fromEntries(keys.map((key) => [key, `[${key}]`])),
    );
  }
}

describe('MailService', () => {
  let mailer: RecordingMailer;
  let catalogue: StubCatalogue;
  let service: MailService;

  beforeEach(() => {
    mailer = new RecordingMailer();
    catalogue = new StubCatalogue();
    service = new MailService(mailer, catalogue as unknown as MailCatalogue);
  });

  it('sends to the address it was given, with both parts filled', async () => {
    await service.sendRegistrationConfirmation('a@example.org', CONTEXT);

    const [mail] = mailer.sent;
    expect(mail.to).toBe('a@example.org');
    expect(mail.text.trim().length).toBeGreaterThan(0);
    expect(mail.html).toContain('<p>');
    expect(mail.text).toContain(CONTEXT.confirmUrl);
    expect(mail.html).toContain(CONTEXT.confirmUrl);
  });

  it('asks for exactly the keys the chosen template declared', async () => {
    // The key list is what E24 measures a language against, so a sender that
    // reached for another template's keys would make the whole-mail check
    // answer a question about a different mail.
    await service.sendRegistrationConfirmed('a@example.org', RECEIPT);

    expect(catalogue.asked).toEqual([
      [...MAIL_TEMPLATES.registrationConfirmed.keys],
    ]);
  });

  it('leaves the choice of language to the catalogue', async () => {
    catalogue.locale = 'en';

    await service.sendRegistrationConfirmation('a@example.org', CONTEXT);

    // Nothing here decides it; the assertion is that nothing here overrides it
    // either — the rendered subject is the one the resolved strings produced.
    expect(mailer.sent[0].subject).toBe('[mail.confirm.subject]');
  });

  it('reports a delivery failure instead of pretending to have sent', async () => {
    mailer.failure = new Error('ECONNREFUSED');

    await expect(
      service.sendRegistrationConfirmation('a@example.org', CONTEXT),
    ).rejects.toBeInstanceOf(MailDeliveryError);
  });
});
