import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import type {
  RegistrationRecord,
  RegistrationRepository,
  SeriesContactRecord,
  SeriesContactSearch,
  SeriesContactSlice,
} from './ports/registration.repository';

function contact(
  overrides: Partial<SeriesContactRecord> = {},
): SeriesContactRecord {
  return {
    registrationId: 'registration-1',
    email: 'amina@example.org',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    events: 2,
    lastRegisteredAt: new Date('2026-08-24T09:30:00Z'),
    ...overrides,
  };
}

/**
 * Only the four methods this service uses; the rest of the port belongs to the
 * two suites that cover the other services on this table.
 */
class FakeRegistrationRepository {
  searches: SeriesContactSearch[] = [];
  slice: SeriesContactSlice = { rows: [contact()], total: 1 };
  selectable: readonly SeriesContactRecord[] = [contact()];
  rows: RegistrationRecord[] = [];
  optedOut: string[] = [];
  changedRows = 1;
  lastSelection: readonly string[] = [];

  async searchSeriesContacts(
    query: SeriesContactSearch,
  ): Promise<SeriesContactSlice> {
    this.searches.push(query);
    return this.slice;
  }

  async findSeriesContacts(
    _seriesId: string,
    registrationIds: readonly string[],
  ): Promise<readonly SeriesContactRecord[]> {
    this.lastSelection = registrationIds;
    return this.selectable;
  }

  async findById(id: string): Promise<RegistrationRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async optOutByEmail(email: string): Promise<number> {
    this.optedOut.push(email);
    return this.changedRows;
  }
}

describe('ContactsService', () => {
  let repository: FakeRegistrationRepository;
  let service: ContactsService;

  beforeEach(() => {
    repository = new FakeRegistrationRepository();
    service = new ContactsService(
      repository as unknown as RegistrationRepository,
    );
  });

  describe('list', () => {
    it('applies the defaults: first page, twenty-five, no filter', async () => {
      await service.list('series-1', {});

      expect(repository.searches[0]).toEqual({
        seriesId: 'series-1',
        terms: [],
        offset: 0,
        limit: 25,
      });
    });

    it('caps the page size at two hundred', async () => {
      await service.list('series-1', { pageSize: 5000 });

      // Two hundred is deliberate: the audience of the work package's
      // acceptance case fits on one page, because a selection assembled across
      // nine pages is one an organizer gets wrong.
      expect(repository.searches[0].limit).toBe(200);
    });

    it('turns the search box into words that all have to match', async () => {
      await service.list('series-1', { search: '  Okonkwo   AMINA ' });

      expect(repository.searches[0].terms).toEqual(['okonkwo', 'amina']);
    });

    it('reports the page it answered for, not the one that was asked for', async () => {
      const page = await service.list('series-1', { page: 0, pageSize: -3 });

      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(25);
    });

    it('hands out addresses as strings, and the instant as ISO', async () => {
      const page = await service.list('series-1', {});

      expect(page.rows[0]).toEqual({
        registrationId: 'registration-1',
        email: 'amina@example.org',
        firstName: 'Amina',
        lastName: 'Okonkwo',
        events: 2,
        lastRegisteredAt: '2026-08-24T09:30:00.000Z',
      });
      expect(page.total).toBe(1);
    });
  });

  describe('selection', () => {
    it('refuses an empty selection rather than sending nothing', async () => {
      await expect(service.selection('series-1', [])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('looks every id up again through the audience filter (F55)', async () => {
      await service.selection('series-1', ['registration-1']);

      // The gate: nothing a client sends is trusted, so this endpoint cannot be
      // used to mail an arbitrary address through the instance.
      expect(repository.lastSelection).toEqual(['registration-1']);
    });

    it('sends one id twice to the repository only once', async () => {
      await service.selection('series-1', ['registration-1', 'registration-1']);

      expect(repository.lastSelection).toEqual(['registration-1']);
    });

    it('refuses the whole selection when one id may not be written to', async () => {
      repository.selectable = [];

      const failure = service.selection('series-1', ['registration-1']);

      // Refused rather than silently skipped: an organizer who selected eighty
      // people and reached seventy-nine has no way to find the missing one.
      await expect(failure).rejects.toBeInstanceOf(BadRequestException);
      await expect(failure).rejects.toThrow(/1 of the selected addresses/);
    });

    it('collapses two registrations of one address into one recipient', async () => {
      // The repository folds by address, so a selection of two rows of the same
      // person comes back as one — and both ids count as addressed.
      repository.selectable = [contact({ registrationId: 'registration-2' })];

      const selected = await service.selection('series-1', ['registration-2']);

      expect(selected).toHaveLength(1);
      expect(selected[0].email).toBe('amina@example.org');
    });
  });

  describe('optOut', () => {
    const stored = (email: string) => {
      repository.rows = [
        {
          id: 'registration-1',
          eventId: 'event-1',
          email,
          firstName: 'Amina',
          lastName: 'Okonkwo',
          phone: null,
          origin: null,
          status: 'confirmed',
          newsletterOptIn: false,
          contactOptOut: false,
          customFields: {},
          confirmedAt: new Date('2026-08-24T10:00:00Z'),
          createdAt: new Date('2026-08-24T09:30:00Z'),
          updatedAt: new Date('2026-08-24T10:00:00Z'),
        },
      ];
    };

    it('writes every registration of that address, not the one row (F57)', async () => {
      stored('amina@example.org');

      const result = await service.optOut('registration-1');

      expect(repository.optedOut).toEqual(['amina@example.org']);
      expect(result.state).toBe('opted-out');
    });

    it('says so when this address had already objected', async () => {
      stored('amina@example.org');
      repository.changedRows = 0;

      const result = await service.optOut('registration-1');

      // Not an error: from the reader's side nothing about their situation has
      // changed, and a second click is the most likely reason.
      expect(result.state).toBe('already-opted-out');
    });

    it('answers 404 when the registration behind the link is gone', async () => {
      await expect(service.optOut('registration-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.optedOut).toEqual([]);
    });

    it('does not require the registration to be confirmed', async () => {
      stored('amina@example.org');
      repository.rows = [{ ...repository.rows[0], status: 'cancelled' }];

      // Whoever holds this link asked to be left alone. "Your registration does
      // not qualify" is never the answer to that.
      await expect(service.optOut('registration-1')).resolves.toEqual({
        state: 'opted-out',
      });
    });
  });
});
