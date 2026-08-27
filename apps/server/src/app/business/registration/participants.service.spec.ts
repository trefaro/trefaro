import { ConflictException, NotFoundException } from '@nestjs/common';
import type {
  OrganizerEvent,
  RegistrationCounts,
  RegistrationStatus,
  RegistrationWeek,
} from '@trefaro/shared-models';
import type { EventLocation, EventsService } from '../events';
import { ParticipantsService } from './participants.service';
import type {
  RegistrationChanges,
  RegistrationRecord,
  RegistrationRepository,
  RegistrationSearch,
  RegistrationSlice,
} from './ports/registration.repository';

const EVENT: OrganizerEvent = {
  id: 'event-1',
  seriesId: 'series-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  description: 'The opening weekend.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  status: 'published',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

const COUNTS: RegistrationCounts = {
  total: 4,
  pending: 1,
  confirmed: 2,
  cancelled: 1,
};

function record(
  overrides: Partial<RegistrationRecord> = {},
): RegistrationRecord {
  return {
    id: 'registration-1',
    eventId: 'event-1',
    email: 'amina@example.org',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    phone: '+49 221 123456',
    origin: 'Cologne',
    status: 'pending',
    newsletterOptIn: true,
    contactOptOut: false,
    customFields: {},
    confirmedAt: null,
    createdAt: new Date('2026-08-24T09:30:00Z'),
    updatedAt: new Date('2026-08-24T09:30:00Z'),
    ...overrides,
  };
}

/**
 * Records the query it was asked, and answers with what the test set up.
 *
 * The filtering itself is SQL and is asserted against a real database in
 * `apps/server-e2e`; what belongs here is the translation the service performs —
 * defaults, clamping and the split of the search box into words.
 */
class RecordingRegistrationRepository implements RegistrationRepository {
  queries: RegistrationSearch[] = [];
  slice: RegistrationSlice = { rows: [], total: 0 };
  counts: RegistrationCounts = COUNTS;
  weeks: readonly RegistrationWeek[] = [];
  weeklyArguments: { eventId: string; timezone: string }[] = [];
  rows: RegistrationRecord[] = [];
  updates: { id: string; changes: RegistrationChanges }[] = [];

  async findById(id: string): Promise<RegistrationRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByEventAndEmail(): Promise<RegistrationRecord | null> {
    throw new Error('not used in this suite');
  }

  async create(): Promise<RegistrationRecord> {
    throw new Error('not used in this suite');
  }

  async update(
    id: string,
    changes: RegistrationChanges,
  ): Promise<RegistrationRecord | null> {
    this.updates.push({ id, changes });
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = { ...this.rows[index], ...changes };
    return this.rows[index];
  }

  async delete(): Promise<boolean> {
    throw new Error('not used in this suite');
  }

  async search(query: RegistrationSearch): Promise<RegistrationSlice> {
    this.queries.push(query);
    return this.slice;
  }

  async countByStatus(): Promise<RegistrationCounts> {
    return this.counts;
  }

  async weeklyTotals(
    eventId: string,
    timezone: string,
  ): Promise<readonly RegistrationWeek[]> {
    this.weeklyArguments.push({ eventId, timezone });
    return this.weeks;
  }

  get lastQuery(): RegistrationSearch {
    return this.queries[this.queries.length - 1];
  }
}

class FakeEventsService {
  event: OrganizerEvent | null = EVENT;

  async getForOrganizer(id: string): Promise<OrganizerEvent> {
    if (!this.event || this.event.id !== id) {
      throw new NotFoundException(`No event with id "${id}"`);
    }
    return this.event;
  }

  /** Whatever the event's status is — that is the point of `locate`. */
  async locate(id: string): Promise<EventLocation> {
    if (!this.event || this.event.id !== id) {
      throw new NotFoundException(`No event with id "${id}"`);
    }
    return { event: this.event, seriesSlug: 'climate-2027' };
  }
}

describe('ParticipantsService', () => {
  let repository: RecordingRegistrationRepository;
  let events: FakeEventsService;
  let service: ParticipantsService;

  beforeEach(() => {
    repository = new RecordingRegistrationRepository();
    events = new FakeEventsService();
    service = new ParticipantsService(
      repository,
      events as unknown as EventsService,
    );
  });

  describe('list', () => {
    it('refuses an event that does not exist instead of showing an empty table', async () => {
      await expect(service.list('event-404', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // An empty table reads as "nobody registered" — a very different fact.
      expect(repository.queries).toHaveLength(0);
    });

    it('applies the defaults: newest first, first page, no filter', async () => {
      await service.list('event-1', {});

      expect(repository.lastQuery).toEqual({
        eventId: 'event-1',
        terms: [],
        status: null,
        sort: 'registeredAt',
        direction: 'desc',
        offset: 0,
        limit: 25,
      });
    });

    it('turns the page number into an offset', async () => {
      await service.list('event-1', { page: 4, pageSize: 10 });

      expect(repository.lastQuery.offset).toBe(30);
      expect(repository.lastQuery.limit).toBe(10);
    });

    it('caps the page size, so one request cannot ask for the whole table', async () => {
      await service.list('event-1', { pageSize: 5000 });

      expect(repository.lastQuery.limit).toBe(200);
    });

    it('falls back to the first page for a page number that is not one', async () => {
      // Below 1 is not a page at all, and 1.5 floors to 1 — a URL somebody
      // edited by hand must not produce a negative offset.
      for (const page of [0, -3, 1.5, Number.NaN]) {
        await service.list('event-1', { page });
      }

      expect(repository.queries.map((query) => query.offset)).toEqual([
        0, 0, 0, 0,
      ]);
    });

    it('splits the search box into words, lower-cased', async () => {
      await service.list('event-1', { search: '  Okonkwo   AMINA ' });

      expect(repository.lastQuery.terms).toEqual(['okonkwo', 'amina']);
    });

    it('passes the status filter and an explicit sort through', async () => {
      await service.list('event-1', {
        status: 'confirmed',
        sort: 'name',
        direction: 'asc',
      });

      expect(repository.lastQuery.status).toBe('confirmed');
      expect(repository.lastQuery.sort).toBe('name');
      expect(repository.lastQuery.direction).toBe('asc');
    });

    it('ignores a sort column and a direction it does not know', async () => {
      await service.list('event-1', {
        sort: 'salary' as never,
        direction: 'sideways' as never,
      });

      expect(repository.lastQuery.sort).toBe('registeredAt');
      expect(repository.lastQuery.direction).toBe('desc');
    });

    it('shows the e-mail address as a field of the row', async () => {
      repository.slice = { rows: [record()], total: 1 };

      const page = await service.list('event-1', {});

      // The one correction the usability test of the thesis produced: the
      // address is in the table, not behind a click.
      expect(page.rows[0].email).toBe('amina@example.org');
      expect(page.rows[0].registeredAt).toBe('2026-08-24T09:30:00.000Z');
      expect(page.rows[0].confirmedAt).toBeNull();
      expect(page.rows[0].newsletterOptIn).toBe(true);
    });

    it('reports the whole event even while a filter is applied', async () => {
      repository.slice = {
        rows: [record({ status: 'confirmed' })],
        total: 2,
      };

      const page = await service.list('event-1', { status: 'confirmed' });

      expect(page.total).toBe(2);
      // Otherwise a filtered view cannot say what it is a subset of.
      expect(page.counts).toEqual(COUNTS);
    });
  });

  describe('statistics', () => {
    it("cuts the weeks in the event's own time zone (E8)", async () => {
      await service.statistics('event-1');

      expect(repository.weeklyArguments).toEqual([
        { eventId: 'event-1', timezone: 'Europe/Berlin' },
      ]);
    });

    it('reports the zone it counted in', async () => {
      const statistics = await service.statistics('event-1');

      expect(statistics.timezone).toBe('Europe/Berlin');
      expect(statistics.counts).toEqual(COUNTS);
    });

    it('inserts the weeks in which nobody registered', async () => {
      repository.weeks = [
        { weekStart: '2026-08-03', total: 5, confirmed: 4 },
        { weekStart: '2026-08-24', total: 2, confirmed: 1 },
      ];

      const statistics = await service.statistics('event-1');

      // A graph that leaves out the quiet weeks turns a lull into a plateau.
      expect(statistics.weeks).toEqual([
        { weekStart: '2026-08-03', total: 5, confirmed: 4 },
        { weekStart: '2026-08-10', total: 0, confirmed: 0 },
        { weekStart: '2026-08-17', total: 0, confirmed: 0 },
        { weekStart: '2026-08-24', total: 2, confirmed: 1 },
      ]);
    });

    it('leaves consecutive weeks and a single week untouched', async () => {
      repository.weeks = [
        { weekStart: '2026-08-17', total: 1, confirmed: 0 },
        { weekStart: '2026-08-24', total: 2, confirmed: 2 },
      ];

      const statistics = await service.statistics('event-1');

      expect(statistics.weeks).toHaveLength(2);
    });

    it('does not draw thousands of empty bars for an absurd gap', async () => {
      repository.weeks = [
        { weekStart: '2020-01-06', total: 1, confirmed: 1 },
        { weekStart: '2026-08-24', total: 1, confirmed: 1 },
      ];

      const statistics = await service.statistics('event-1');

      // A mistyped year must not cost a second of drawing time.
      expect(statistics.weeks).toHaveLength(2);
    });

    it('answers 404 for an event that does not exist', async () => {
      await expect(service.statistics('event-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('get', () => {
    it('names the event the registration belongs to', async () => {
      repository.rows = [record()];

      const detail = await service.get('registration-1');

      expect(detail.eventId).toBe('event-1');
      expect(detail.eventName).toBe('Kickoff in Köln');
      expect(detail.email).toBe('amina@example.org');
    });

    it('still opens after the event went back to being a draft', async () => {
      repository.rows = [record()];
      events.event = { ...EVENT, status: 'draft' };

      const detail = await service.get('registration-1');

      // The registration is an obligation towards a person; it does not become
      // invisible because the event was unpublished.
      expect(detail.eventName).toBe('Kickoff in Köln');
    });

    it('answers 404 for an id nothing matches', async () => {
      await expect(service.get('registration-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('setStatus', () => {
    const stored = (overrides: Partial<RegistrationRecord> = {}) => {
      repository.rows = [record(overrides)];
    };

    it('cancels a confirmed registration and keeps the confirmation date', async () => {
      const confirmedAt = new Date('2026-08-24T10:00:00Z');
      stored({ status: 'confirmed', confirmedAt });

      const row = await service.setStatus('registration-1', 'cancelled');

      expect(row.status).toBe('cancelled');
      // That somebody once confirmed is a fact, and cancelling is a new one.
      expect(row.confirmedAt).toBe('2026-08-24T10:00:00.000Z');
    });

    it('does nothing when the status is already the one asked for', async () => {
      stored({ status: 'cancelled' });

      const row = await service.setStatus('registration-1', 'cancelled');

      expect(row.status).toBe('cancelled');
      expect(repository.updates).toHaveLength(0);
    });

    it('reinstates a cancelled registration that had been confirmed', async () => {
      stored({
        status: 'cancelled',
        confirmedAt: new Date('2026-08-24T10:00:00Z'),
      });

      const row = await service.setStatus('registration-1', 'confirmed');

      expect(row.status).toBe('confirmed');
    });

    it('refuses to confirm an address the participant never confirmed', async () => {
      stored({ status: 'pending', confirmedAt: null });

      const failure = service.setStatus('registration-1', 'confirmed');

      // Nothing would tell a hand-set status from a real double opt-in
      // afterwards, so this would quietly devalue the consent record (E5, F23).
      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure).rejects.toThrow(/submit the form again/);
      expect(repository.updates).toHaveLength(0);
    });

    it('lets a cancelled registration that was never confirmed go back to pending', async () => {
      stored({ status: 'cancelled', confirmedAt: null });

      const row = await service.setStatus('registration-1', 'pending');

      expect(row.status).toBe('pending');
    });

    it('refuses to un-confirm a confirmed registration', async () => {
      stored({
        status: 'confirmed',
        confirmedAt: new Date('2026-08-24T10:00:00Z'),
      });

      await expect(
        service.setStatus('registration-1', 'pending'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('answers 404 for an id nothing matches', async () => {
      await expect(
        service.setStatus(
          'registration-404',
          'cancelled' as RegistrationStatus,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
