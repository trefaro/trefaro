import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  EventSeries,
  InvitationCounts,
  OrganizerEvent,
  SeriesContact,
} from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import type { EventSeriesService } from '../event-series';
import type { EventsService } from '../events';
import type { ContactsService } from '../registration';
import { TokenSigner } from '../security';
import type { InvitationSenderService } from './invitation-sender.service';
import { InvitationsService } from './invitations.service';
import type {
  InvitationRecord,
  InvitationRepository,
  InvitationSlice,
  NewInvitation,
} from './ports/invitation.repository';

const ENV = {
  authSecret: 'a-test-secret-of-at-least-32-characters',
  publicUserClientUrl: 'https://events.example.org',
} as TrefaroEnv;

const SERIES = {
  id: 'series-1',
  slug: 'democracy-days',
  name: 'Democracy Days',
} as EventSeries;

const EVENT = {
  id: 'event-1',
  seriesId: 'series-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
} as OrganizerEvent;

const CONTACT: SeriesContact = {
  registrationId: 'registration-1',
  email: 'amina@example.org',
  firstName: 'Amina',
  lastName: 'Okonkwo',
  events: 2,
  lastRegisteredAt: '2026-08-24T09:30:00.000Z',
};

function record(overrides: Partial<InvitationRecord> = {}): InvitationRecord {
  return {
    id: 'invitation-1',
    seriesId: 'series-1',
    eventId: null,
    subject: 'You are invited',
    body: 'we would love to see you again.',
    createdAt: new Date('2026-08-27T10:00:00Z'),
    finishedAt: null,
    ...overrides,
  };
}

class FakeInvitationRepository {
  created: NewInvitation[] = [];
  slice: InvitationSlice = { rows: [record()], total: 1 };
  stored: InvitationRecord | null = record();
  counts = new Map<string, InvitationCounts>();
  pagination: { offset: number; limit: number }[] = [];

  async create(invitation: NewInvitation): Promise<InvitationRecord> {
    this.created.push(invitation);
    return record({ eventId: invitation.eventId });
  }

  async findById(): Promise<InvitationRecord | null> {
    return this.stored;
  }

  async findBySeries(
    _seriesId: string,
    offset: number,
    limit: number,
  ): Promise<InvitationSlice> {
    this.pagination.push({ offset, limit });
    return this.slice;
  }

  async countsFor(): Promise<ReadonlyMap<string, InvitationCounts>> {
    return this.counts;
  }
}

class FakeSeriesService {
  missing = false;

  async getForOrganizer(id: string): Promise<EventSeries> {
    if (this.missing) throw new NotFoundException(`No series "${id}"`);
    return SERIES;
  }
}

class FakeEventsService {
  event: OrganizerEvent = EVENT;

  async getForOrganizer(id: string): Promise<OrganizerEvent> {
    if (this.event.id !== id) throw new NotFoundException('No such event');
    return this.event;
  }
}

class FakeContactsService {
  selectable: readonly SeriesContact[] = [CONTACT];
  refuse: Error | null = null;
  asked: { seriesId: string; ids: readonly string[] }[] = [];
  optedOut: string[] = [];
  listed: { seriesId: string; page: number | undefined }[] = [];

  async list(seriesId: string, query: { page?: number }) {
    this.listed.push({ seriesId, page: query.page });
    return { rows: [CONTACT], total: 1, page: 1, pageSize: 25 };
  }

  async selection(seriesId: string, ids: readonly string[]) {
    this.asked.push({ seriesId, ids });
    if (this.refuse) throw this.refuse;
    return this.selectable;
  }

  async optOut(registrationId: string) {
    this.optedOut.push(registrationId);
    return { state: 'opted-out' as const };
  }
}

class RecordingSender {
  readonly started: string[] = [];

  start(invitationId: string): void {
    this.started.push(invitationId);
  }
}

describe('InvitationsService', () => {
  let repository: FakeInvitationRepository;
  let series: FakeSeriesService;
  let events: FakeEventsService;
  let contacts: FakeContactsService;
  let sender: RecordingSender;
  let tokens: TokenSigner;
  let service: InvitationsService;

  const input = (overrides: Record<string, unknown> = {}) => ({
    subject: 'You are invited',
    body: 'we would love to see you again.',
    recipients: ['registration-1'],
    ...overrides,
  });

  beforeEach(() => {
    repository = new FakeInvitationRepository();
    series = new FakeSeriesService();
    events = new FakeEventsService();
    contacts = new FakeContactsService();
    sender = new RecordingSender();
    tokens = new TokenSigner(ENV);
    service = new InvitationsService(
      repository as unknown as InvitationRepository,
      series as unknown as EventSeriesService,
      events as unknown as EventsService,
      contacts as unknown as ContactsService,
      sender as unknown as InvitationSenderService,
      tokens,
    );
  });

  describe('audience', () => {
    it('refuses an unknown series rather than answering an empty list', async () => {
      series.missing = true;

      await expect(service.audience('series-404', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // An empty list reads as "nobody has ever registered" — a different fact.
      expect(contacts.listed).toHaveLength(0);
    });

    it('asks the contacts service, which owns the filter (E15)', async () => {
      await service.audience('series-1', { page: 2 });

      expect(contacts.listed).toEqual([{ seriesId: 'series-1', page: 2 }]);
    });
  });

  describe('create', () => {
    it('writes the invitation and hands it to the sender (F56)', async () => {
      const invitation = await service.create('series-1', input());

      expect(repository.created[0]).toEqual({
        seriesId: 'series-1',
        eventId: null,
        subject: 'You are invited',
        body: 'we would love to see you again.',
        registrationIds: ['registration-1'],
      });
      // The request answers; the mails follow. Nothing is awaited.
      expect(sender.started).toEqual([invitation.id]);
    });

    it('answers with the count of recipients and nothing sent yet', async () => {
      const invitation = await service.create('series-1', input());

      expect(invitation.recipients).toBe(1);
      expect(invitation.sent).toBe(0);
      expect(invitation.failed).toBe(0);
      expect(invitation.state).toBe('sending');
    });

    it('checks every selected id before a single mail goes out (F55)', async () => {
      await service.create('series-1', input());

      expect(contacts.asked).toEqual([
        { seriesId: 'series-1', ids: ['registration-1'] },
      ]);
    });

    it('writes nothing when the selection is refused', async () => {
      contacts.refuse = new BadRequestException('stale');

      await expect(service.create('series-1', input())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.created).toHaveLength(0);
      expect(sender.started).toHaveLength(0);
    });

    it('trims the subject and the message', async () => {
      await service.create(
        'series-1',
        input({ subject: '  You are invited  ', body: '  Come along.  ' }),
      );

      expect(repository.created[0].subject).toBe('You are invited');
      expect(repository.created[0].body).toBe('Come along.');
    });

    it('refuses a subject that is only whitespace', async () => {
      await expect(
        service.create('series-1', input({ subject: '   ' })),
      ).rejects.toThrow(/needs a subject/);
    });

    it('refuses a message that is only whitespace', async () => {
      await expect(
        service.create('series-1', input({ body: '\n\n' })),
      ).rejects.toThrow(/needs a message/);
    });

    it('keeps an event of the same series', async () => {
      const invitation = await service.create(
        'series-1',
        input({ eventId: 'event-1' }),
      );

      expect(invitation.eventId).toBe('event-1');
    });

    it('refuses an event of another series', async () => {
      events.event = { ...EVENT, seriesId: 'series-2' };

      const failure = service.create('series-1', input({ eventId: 'event-1' }));

      // The link in the mail would point at something these people have nothing
      // to do with — which is the one thing E15 bases the feature on.
      await expect(failure).rejects.toBeInstanceOf(BadRequestException);
      await expect(failure).rejects.toThrow(/different event series/);
      expect(repository.created).toHaveLength(0);
    });

    it('refuses more recipients than one invitation may name', async () => {
      const many = Array.from({ length: 2001 }, (_, index) => `id-${index}`);

      await expect(
        service.create('series-1', input({ recipients: many })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(contacts.asked).toHaveLength(0);
    });

    it('refuses an unknown series before anything else', async () => {
      series.missing = true;

      await expect(
        service.create('series-404', input()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(contacts.asked).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('pages with the default of ten, newest first', async () => {
      await service.list('series-1', {});

      expect(repository.pagination).toEqual([{ offset: 0, limit: 10 }]);
    });

    it('caps the page size', async () => {
      await service.list('series-1', { pageSize: 900 });

      expect(repository.pagination[0].limit).toBe(50);
    });

    it('reports zero counts for an invitation whose recipients are gone', async () => {
      const page = await service.list('series-1', {});

      // Every recipient erased since; the invitation row is still the record
      // that a message went out.
      expect(page.rows[0].recipients).toBe(0);
      expect(page.rows[0].state).toBe('sent');
    });

    it('derives the state from the counts, never from a column', async () => {
      repository.counts = new Map([
        ['invitation-1', { recipients: 5, sent: 4, failed: 1 }],
      ]);

      const page = await service.list('series-1', {});

      expect(page.rows[0].state).toBe('partial');
      expect(page.rows[0].sent).toBe(4);
    });
  });

  describe('get', () => {
    it('answers 404 for an id nothing matches', async () => {
      repository.stored = null;

      await expect(service.get('invitation-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('reads the counts on every call, so a page can poll it', async () => {
      repository.counts = new Map([
        ['invitation-1', { recipients: 3, sent: 3, failed: 0 }],
      ]);

      const invitation = await service.get('invitation-1');

      expect(invitation.state).toBe('sent');
      expect(invitation.sent).toBe(3);
    });
  });

  describe('optOut', () => {
    it('records the objection the token speaks for', async () => {
      const token = tokens.sign('invitation-opt-out', 'registration-1', 60_000);

      await expect(service.optOut(token)).resolves.toEqual({
        state: 'opted-out',
      });
      expect(contacts.optedOut).toEqual(['registration-1']);
    });

    it('refuses a forged token', async () => {
      await expect(service.optOut('not.a.token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(contacts.optedOut).toHaveLength(0);
    });

    it('refuses a self-service token replayed here', async () => {
      const other = tokens.sign(
        'registration-self-service',
        'registration-1',
        60_000,
      );

      // The purpose is inside the signature: one link cannot do another's job.
      await expect(service.optOut(other)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses an expired token but tells the reader what to do', async () => {
      const expired = tokens.sign('invitation-opt-out', 'registration-1', -1);

      await expect(service.optOut(expired)).rejects.toThrow(
        /reply to the invitation/,
      );
    });
  });
});
