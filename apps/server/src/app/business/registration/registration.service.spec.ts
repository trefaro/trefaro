import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PublicEvent, RegistrationInput } from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import type { EventLocation, EventsService } from '../events';
import { MailDeliveryError, MailService } from '../mail';
import type {
  ConfirmationMailContext,
  RegistrationMailContext,
} from '../mail';
import { TokenSigner } from '../security';
import {
  type NewRegistration,
  type RegistrationChanges,
  type RegistrationRecord,
  type RegistrationRepository,
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
}

/** Records what would have gone out, and can be told to fail. */
class RecordingMailService {
  readonly confirmations: ConfirmationMailContext[] = [];
  readonly receipts: RegistrationMailContext[] = [];
  readonly recipients: string[] = [];
  failing = false;

  async sendRegistrationConfirmation(
    to: string,
    context: ConfirmationMailContext,
  ): Promise<void> {
    if (this.failing) throw new MailDeliveryError(new Error('ECONNREFUSED'));
    this.recipients.push(to);
    this.confirmations.push(context);
  }

  async sendRegistrationConfirmed(
    to: string,
    context: RegistrationMailContext,
  ): Promise<void> {
    if (this.failing) throw new MailDeliveryError(new Error('ECONNREFUSED'));
    this.recipients.push(to);
    this.receipts.push(context);
  }
}

class FakeEventsService {
  event: PublicEvent = EVENT;
  /** Set to make the public lookup behave like a draft or unknown event. */
  publiclyVisible = true;

  async getPublic(): Promise<PublicEvent> {
    if (!this.publiclyVisible) throw new NotFoundException('No such event');
    return this.event;
  }

  async locate(): Promise<EventLocation> {
    return { event: this.event, seriesSlug: 'buergerraete' };
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
  let service: RegistrationService;

  beforeEach(() => {
    repository = new FakeRegistrationRepository();
    mail = new RecordingMailService();
    events = new FakeEventsService();
    service = new RegistrationService(
      repository,
      events as unknown as EventsService,
      mail as unknown as MailService,
      new TokenSigner(ENV),
      ENV,
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
      await service.remove(repository.rows[0].id);

      expect(repository.rows).toHaveLength(0);
    });

    it('answers 404 for a registration that is already gone', async () => {
      await expect(service.remove('registration-9')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
