import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  CustomFieldValues,
  PublicEvent,
  RegistrationCounts,
  RegistrationInput,
  RegistrationWeek,
} from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import type { AttachmentsService, UploadedFile } from '../attachments';
import type { EventLocation, EventsService } from '../events';
import { MailDeliveryError, MailService, PublicLinks } from '../mail';
import type {
  ConfirmationMailContext,
  MailContent,
  RegistrationMailContext,
} from '../mail';
import { TokenSigner } from '../security';
import type {
  CheckedSubmission,
  RegistrationFieldsService,
} from './registration-fields.service';
import {
  type NewRegistration,
  type RegistrationChanges,
  type RegistrationRecord,
  type RegistrationRepository,
  type RegistrationSlice,
  type SeriesContactRecord,
  type SeriesContactSlice,
} from './ports/registration.repository';
import { RegistrationService } from './registration.service';

const EVENT: PublicEvent = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  description: 'The opening weekend.',
  logoUrl: null,
  eventType: 'onsite',
  // Far enough out that the fixture does not expire on its own.
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  followUpBody: null,
};

const INPUT: RegistrationInput = {
  firstName: 'Amina',
  lastName: 'Okonkwo',
  email: 'Amina@Example.ORG',
  phone: ' +49 221 12345 ',
  origin: '',
  newsletterOptIn: true,
};

class FakeRegistrationRepository implements RegistrationRepository {
  readonly rows: RegistrationRecord[] = [];
  private nextId = 1;

  async findById(id: string): Promise<RegistrationRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByEventAndEmail(
    eventId: string,
    email: string,
  ): Promise<RegistrationRecord | null> {
    return (
      this.rows.find(
        (row) =>
          row.eventId === eventId &&
          row.email.toLowerCase() === email.toLowerCase(),
      ) ?? null
    );
  }

  async create(registration: NewRegistration): Promise<RegistrationRecord> {
    const created: RegistrationRecord = {
      id: `registration-${this.nextId++}`,
      contactOptOut: false,
      confirmedAt: null,
      createdAt: new Date('2026-08-27T09:00:00Z'),
      updatedAt: new Date('2026-08-27T09:00:00Z'),
      ...registration,
    };
    this.rows.push(created);
    return created;
  }

  async update(
    id: string,
    changes: RegistrationChanges,
  ): Promise<RegistrationRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    const updated = { ...this.rows[index], ...changes, updatedAt: new Date() };
    this.rows[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }

  // The three reads of the participant overview are not part of the double
  // opt-in flow this suite covers; `participants.service.spec.ts` exercises them.
  async search(): Promise<RegistrationSlice> {
    throw new Error('not used in this suite');
  }

  async searchByAddress(): Promise<RegistrationSlice> {
    throw new Error('not used in this suite');
  }

  async countByStatus(): Promise<RegistrationCounts> {
    throw new Error('not used in this suite');
  }

  async searchSeriesContacts(): Promise<SeriesContactSlice> {
    throw new Error('not used in this suite');
  }

  async findSeriesContacts(): Promise<readonly SeriesContactRecord[]> {
    throw new Error('not used in this suite');
  }

  async optOutByEmail(): Promise<number> {
    throw new Error('not used in this suite');
  }

  async weeklyTotals(): Promise<readonly RegistrationWeek[]> {
    throw new Error('not used in this suite');
  }
}

/** Records what would have gone out, and can be told to fail. */
/**
 * The mail service, which since AP 4 asks for its content (F125).
 *
 * The letter's language is resolved inside `MailService`, so a caller hands in
 * a function and is called back with it. This fake plays that part with
 * {@link locale}, which is what lets a test assert that the *content* followed
 * the language the letter was written in.
 */
class RecordingMailService {
  readonly confirmations: ConfirmationMailContext[] = [];
  readonly receipts: RegistrationMailContext[] = [];
  readonly recipients: string[] = [];
  failing = false;
  /** The language `MailCatalogue` would have settled on for these letters. */
  locale = 'en';

  async sendRegistrationConfirmation(
    to: string,
    content: MailContent<ConfirmationMailContext>,
  ): Promise<void> {
    if (this.failing) throw new MailDeliveryError(new Error('ECONNREFUSED'));
    this.recipients.push(to);
    this.confirmations.push(await this.resolve(content));
  }

  async sendRegistrationConfirmed(
    to: string,
    content: MailContent<RegistrationMailContext>,
  ): Promise<void> {
    if (this.failing) throw new MailDeliveryError(new Error('ECONNREFUSED'));
    this.recipients.push(to);
    this.receipts.push(await this.resolve(content));
  }

  private async resolve<Context>(
    content: MailContent<Context>,
  ): Promise<Context> {
    return typeof content === 'function'
      ? await (content as (locale: string) => Promise<Context>)(this.locale)
      : content;
  }
}

/**
 * Stands in for the field kit (F12).
 *
 * What a valid answer is belongs to `registration-fields.service.spec.ts`, which
 * has the definitions to check against. What belongs here is the *order*: the
 * validation runs before anything is written, so a refused answer leaves no
 * pending row and sends no mail.
 */
class FakeRegistrationFieldsService {
  /** Set to make the next validation fail the way a missing answer would. */
  rejecting = false;
  answers: CustomFieldValues = {};
  uploads: readonly UploadedFile[] = [];

  async validateSubmission(): Promise<CheckedSubmission> {
    if (this.rejecting) {
      throw new BadRequestException('"Dietary requirements" is required.');
    }
    return { customFields: this.answers, uploads: this.uploads };
  }
}

/** Records what the registration flow asks of the attachment store (E9). */
class FakeAttachmentsService {
  readonly stored: { registrationId: string; keys: string[] }[] = [];
  readonly purged: string[] = [];

  async store(
    registrationId: string,
    uploads: readonly UploadedFile[],
  ): Promise<void> {
    this.stored.push({
      registrationId,
      keys: uploads.map((upload) => upload.fieldKey),
    });
  }

  async purgeForRegistration(registrationId: string): Promise<void> {
    this.purged.push(registrationId);
  }
}

class FakeEventsService {
  event: PublicEvent = EVENT;
  /** Set to make the public lookup behave like a draft or unknown event. */
  publiclyVisible = true;
  /** What the event is called in another language (FR 3.12). */
  translated = new Map<string, string>();
  /** Which languages `locate` was asked for, in order. */
  readonly located: (string | undefined)[] = [];

  async getPublic(): Promise<PublicEvent> {
    if (!this.publiclyVisible) throw new NotFoundException('No such event');
    return this.event;
  }

  async locate(_id: string, locale?: string): Promise<EventLocation> {
    this.located.push(locale);
    const name = locale ? this.translated.get(locale) : undefined;
    return {
      event: name ? { ...this.event, name } : this.event,
      seriesSlug: 'buergerraete',
    };
  }
}

const ENV = {
  authSecret: 'a-test-secret-of-at-least-32-characters',
  publicUserClientUrl: 'https://events.example.org/',
} as TrefaroEnv;

/** The token out of the link the confirmation mail carried. */
function tokenFrom(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get('token') ?? '');
}

describe('RegistrationService', () => {
  let repository: FakeRegistrationRepository;
  let mail: RecordingMailService;
  let events: FakeEventsService;
  let fields: FakeRegistrationFieldsService;
  let attachments: FakeAttachmentsService;
  let service: RegistrationService;

  beforeEach(() => {
    repository = new FakeRegistrationRepository();
    mail = new RecordingMailService();
    events = new FakeEventsService();
    fields = new FakeRegistrationFieldsService();
    attachments = new FakeAttachmentsService();
    service = new RegistrationService(
      repository,
      events as unknown as EventsService,
      fields as unknown as RegistrationFieldsService,
      attachments as unknown as AttachmentsService,
      mail as unknown as MailService,
      new TokenSigner(ENV),
      new PublicLinks(ENV),
    );
  });

  describe('register', () => {
    it('stores a pending registration and asks for confirmation', async () => {
      const answer = await service.register('buergerraete', 'kickoff', INPUT);

      expect(answer).toEqual({ email: 'amina@example.org' });
      expect(repository.rows).toHaveLength(1);
      const [row] = repository.rows;
      expect(row.status).toBe('pending');
      expect(row.confirmedAt).toBeNull();
      expect(row.newsletterOptIn).toBe(true);
      expect(mail.confirmations).toHaveLength(1);
      expect(mail.recipients).toEqual(['amina@example.org']);
    });

    it('normalizes what was typed into the form', async () => {
      await service.register('buergerraete', 'kickoff', INPUT);

      const [row] = repository.rows;
      // Lower-cased address (E10), trimmed phone, and an empty optional field
      // stored as absent rather than as an empty string.
      expect(row.email).toBe('amina@example.org');
      expect(row.phone).toBe('+49 221 12345');
      expect(row.origin).toBeNull();
    });

    it('stores the answers the field kit accepted (F12)', async () => {
      fields.answers = { 'dietary-requirements': 'vegan', visa: true };

      await service.register('buergerraete', 'kickoff', {
        ...INPUT,
        customFields: { 'dietary-requirements': ' vegan ', visa: true },
      });

      const [row] = repository.rows;
      // What the field service returned, not what the request contained: the
      // trimming and the dropping of unanswered fields happen there.
      expect(row.customFields).toEqual({
        'dietary-requirements': 'vegan',
        visa: true,
      });
    });

    it('stores an uploaded file against the registration (E9)', async () => {
      fields.uploads = [
        {
          fieldKey: 'passport',
          fileName: 'passport.pdf',
          mimeType: 'application/pdf',
          bytes: Buffer.from('%PDF-1.7'),
        },
      ];

      await service.register('buergerraete', 'kickoff', INPUT);

      expect(attachments.stored).toEqual([
        { registrationId: repository.rows[0].id, keys: ['passport'] },
      ]);
    });

    it("does not let a public request replace a confirmed registration's file", async () => {
      await service.register('buergerraete', 'kickoff', INPUT);
      await service.confirm(tokenFrom(mail.confirmations[0].confirmUrl));
      fields.uploads = [
        {
          fieldKey: 'passport',
          fileName: 'other.pdf',
          mimeType: 'application/pdf',
          bytes: Buffer.from('%PDF-1.7'),
        },
      ];

      await service.register('buergerraete', 'kickoff', INPUT);

      // Anyone who knows the address could otherwise swap the visa document of
      // somebody who is already registered — and nothing here authorizes that.
      expect(attachments.stored).toEqual([]);
    });

    it('writes nothing and sends nothing when an answer is refused', async () => {
      fields.rejecting = true;

      await expect(
        service.register('buergerraete', 'kickoff', INPUT),
      ).rejects.toThrow(BadRequestException);

      // The order matters: a pending row plus no mail would be a registration
      // the participant can neither complete nor see.
      expect(repository.rows).toHaveLength(0);
      expect(mail.recipients).toEqual([]);
    });

    it('names the event in the language the mail is written in (F125)', async () => {
      mail.locale = 'de';
      events.translated.set('de', 'Auftakt in Köln');

      await service.register('buergerraete', 'kickoff', INPUT);

      // The other half of "mail in the recipient's language": a German letter
      // that named the English original would be half a decision, and the half
      // that is missing is the reader's.
      expect(events.located).toContain('de');
      expect(mail.confirmations[0].event.name).toBe('Auftakt in Köln');
    });

    it('links to the participant client, not to the API (E5b)', async () => {
      await service.register('buergerraete', 'kickoff', INPUT);

      const { confirmUrl, event } = mail.confirmations[0];
      expect(confirmUrl).toContain(
        'https://events.example.org/registrations/confirm?token=',
      );
      expect(event.url).toBe(
        'https://events.example.org/series/buergerraete/events/kickoff',
      );
    });

    it('creates no second row for the same address', async () => {
      await service.register('buergerraete', 'kickoff', INPUT);
      const answer = await service.register('buergerraete', 'kickoff', {
        ...INPUT,
        email: 'AMINA@example.org',
      });

      // E10: identical answer, one row, and the mail goes out again.
      expect(answer).toEqual({ email: 'amina@example.org' });
      expect(repository.rows).toHaveLength(1);
      expect(mail.confirmations).toHaveLength(2);
    });

    it('applies a correction made on a second attempt', async () => {
      await service.register('buergerraete', 'kickoff', INPUT);
      await service.register('buergerraete', 'kickoff', {
        ...INPUT,
        firstName: 'Aminata',
      });

      expect(repository.rows[0].firstName).toBe('Aminata');
    });

    it('leaves a confirmed registration untouched and resends the receipt', async () => {
      await service.register('buergerraete', 'kickoff', INPUT);
      await service.confirm(tokenFrom(mail.confirmations[0].confirmUrl));

      await service.register('buergerraete', 'kickoff', {
        ...INPUT,
        firstName: 'Someone',
        lastName: 'Else',
      });

      // The endpoint is public: knowing an address must not be enough to rewrite
      // a confirmed participant's name.
      expect(repository.rows[0].firstName).toBe('Amina');
      expect(repository.rows[0].status).toBe('confirmed');
      expect(mail.receipts).toHaveLength(2);
      expect(mail.confirmations).toHaveLength(1);
    });

    it('lets a cancelled registration come back', async () => {
      await service.register('buergerraete', 'kickoff', INPUT);
      await repository.update(repository.rows[0].id, { status: 'cancelled' });

      await service.register('buergerraete', 'kickoff', INPUT);

      expect(repository.rows[0].status).toBe('pending');
      expect(mail.confirmations).toHaveLength(2);
    });

    it('refuses an event that is not public', async () => {
      events.publiclyVisible = false;

      await expect(
        service.register('buergerraete', 'kickoff', INPUT),
      ).rejects.toThrow(NotFoundException);
      expect(repository.rows).toHaveLength(0);
    });

    it('refuses an event that is already over', async () => {
      events.event = {
        ...EVENT,
        startsAt: '2020-01-01T09:00:00.000Z',
        endsAt: '2020-01-01T17:00:00.000Z',
      };

      await expect(
        service.register('buergerraete', 'kickoff', INPUT),
      ).rejects.toThrow(ConflictException);
    });

    it('says so when the confirmation mail could not be sent', async () => {
      mail.failing = true;

      // Without that mail the registration cannot be completed, so silence would
      // be a lie. The row stays pending and a second attempt sends it again.
      await expect(
        service.register('buergerraete', 'kickoff', INPUT),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(repository.rows[0].status).toBe('pending');
    });
  });

  describe('confirm', () => {
    /** Registers and returns the token from the mail that went out. */
    const registerAndGetToken = async (): Promise<string> => {
      await service.register('buergerraete', 'kickoff', INPUT);
      return tokenFrom(mail.confirmations.at(-1)?.confirmUrl ?? '');
    };

    it('turns a pending registration into a confirmed one', async () => {
      const token = await registerAndGetToken();

      const result = await service.confirm(token);

      expect(result).toEqual({
        state: 'confirmed',
        eventName: 'Kickoff in Köln',
        seriesSlug: 'buergerraete',
        eventSlug: 'kickoff',
      });
      expect(repository.rows[0].status).toBe('confirmed');
      expect(repository.rows[0].confirmedAt).toBeInstanceOf(Date);
      expect(mail.receipts).toHaveLength(1);
    });

    it('reports the second click as already confirmed', async () => {
      const token = await registerAndGetToken();
      await service.confirm(token);

      const result = await service.confirm(token);

      // People click links twice, and forwarded mail gets opened by a colleague.
      expect(result.state).toBe('already-confirmed');
      expect(mail.receipts).toHaveLength(1);
    });

    it('rejects a token somebody edited', async () => {
      const token = await registerAndGetToken();
      const [payload] = token.split('.');

      await expect(
        service.confirm(`${payload}.this-is-not-the-signature`),
      ).rejects.toThrow(BadRequestException);
      expect(repository.rows[0].status).toBe('pending');
    });

    it('rejects a token for a registration that is gone', async () => {
      const token = await registerAndGetToken();
      repository.rows.length = 0;

      await expect(service.confirm(token)).rejects.toThrow(NotFoundException);
    });

    it('refuses to revive a cancelled registration', async () => {
      const token = await registerAndGetToken();
      await repository.update(repository.rows[0].id, { status: 'cancelled' });

      // E5b allows exactly one transition: pending → confirmed.
      await expect(service.confirm(token)).rejects.toThrow(ConflictException);
    });

    it('confirms even when the receipt cannot be delivered', async () => {
      const token = await registerAndGetToken();
      mail.failing = true;

      // The state change has already happened; failing the request now would
      // tell the participant the opposite of the truth.
      await expect(service.confirm(token)).resolves.toMatchObject({
        state: 'confirmed',
      });
      expect(repository.rows[0].status).toBe('confirmed');
    });

    it('still confirms after the event was pulled back to a draft', async () => {
      const token = await registerAndGetToken();
      events.publiclyVisible = false;

      await expect(service.confirm(token)).resolves.toMatchObject({
        state: 'confirmed',
      });
    });
  });

  describe('remove', () => {
    it('deletes a registration whatever its status', async () => {
      await service.register('buergerraete', 'kickoff', INPUT);
      const token = tokenFrom(mail.confirmations[0].confirmUrl);
      await service.confirm(token);

      // Unlike deleting an event, this is allowed once confirmed: it is how an
      // organization answers a request for erasure (E14).
      const id = repository.rows[0].id;
      await service.remove(id);

      expect(repository.rows).toHaveLength(0);
      // The files go too: the cascade would take their rows and leave the bytes.
      expect(attachments.purged).toEqual([id]);
    });

    it('answers 404 for a registration that is already gone, removing nothing', async () => {
      await expect(service.remove('registration-9')).rejects.toThrow(
        NotFoundException,
      );

      expect(attachments.purged).toEqual([]);
    });
  });
});
