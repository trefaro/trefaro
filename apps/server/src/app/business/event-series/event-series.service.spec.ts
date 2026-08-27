import { ConflictException, NotFoundException } from '@nestjs/common';
import type { RegistrationTally } from '../registration/ports/registration-tally';
import { EventSeriesService } from './event-series.service';
import {
  EventSeriesSlugTakenError,
  type EventSeriesChanges,
  type EventSeriesRecord,
  type EventSeriesRepository,
  type NewEventSeries,
} from './ports/event-series.repository';

/**
 * The counts the delete rule asks for (E14).
 *
 * A fake rather than a stub with a fixed answer: the tests set the number the
 * way the world sets it — somebody confirmed, or nobody did.
 */
class FakeRegistrationTally implements RegistrationTally {
  confirmedPerEvent = 0;
  confirmedPerSeries = 0;

  async confirmedForEvent(): Promise<number> {
    return this.confirmedPerEvent;
  }

  async confirmedForSeries(): Promise<number> {
    return this.confirmedPerSeries;
  }
}

class FakeEventSeriesRepository implements EventSeriesRepository {
  readonly rows: EventSeriesRecord[] = [];
  /** Set to make the next write lose the race against the unique index. */
  collideOnCreate = false;
  private nextId = 1;

  async findAll(): Promise<readonly EventSeriesRecord[]> {
    return [...this.rows].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findPublished(): Promise<readonly EventSeriesRecord[]> {
    return (await this.findAll()).filter((row) => row.status === 'published');
  }

  async findById(id: string): Promise<EventSeriesRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findBySlug(slug: string): Promise<EventSeriesRecord | null> {
    return this.rows.find((row) => row.slug === slug) ?? null;
  }

  async create(series: NewEventSeries): Promise<EventSeriesRecord> {
    if (this.collideOnCreate) {
      throw new EventSeriesSlugTakenError(series.slug);
    }
    const created: EventSeriesRecord = {
      id: `series-${this.nextId++}`,
      logoPath: null,
      createdAt: new Date('2026-08-26T09:00:00Z'),
      updatedAt: new Date('2026-08-26T09:00:00Z'),
      ...series,
    };
    this.rows.push(created);
    return created;
  }

  async update(
    id: string,
    changes: EventSeriesChanges,
  ): Promise<EventSeriesRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = {
      ...this.rows[index],
      ...changes,
      updatedAt: new Date('2026-08-26T10:00:00Z'),
    };
    return this.rows[index];
  }

  async delete(id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }
}

describe('EventSeriesService', () => {
  let repository: FakeEventSeriesRepository;
  let tally: FakeRegistrationTally;
  let service: EventSeriesService;

  const minimal = {
    name: 'Climate Conference 2027',
    description: 'Three days on citizen participation.',
  };

  beforeEach(() => {
    repository = new FakeEventSeriesRepository();
    tally = new FakeRegistrationTally();
    service = new EventSeriesService(repository, tally);
  });

  describe('create', () => {
    it('derives the public address from the name', async () => {
      const created = await service.create(minimal);

      expect(created.slug).toBe('climate-conference-2027');
    });

    it('starts as a draft, so a series can be prepared unseen', async () => {
      expect((await service.create(minimal)).status).toBe('draft');
    });

    it('numbers the address when the derived one is taken', async () => {
      await service.create(minimal);

      const second = await service.create(minimal);

      expect(second.slug).toBe('climate-conference-2027-2');
    });

    it('honours an address the organizer chose', async () => {
      const created = await service.create({ ...minimal, slug: 'cop-2027' });

      expect(created.slug).toBe('cop-2027');
    });

    it('cleans up an address that was typed loosely', async () => {
      const created = await service.create({
        ...minimal,
        slug: '  COP 2027!  ',
      });

      expect(created.slug).toBe('cop-2027');
    });

    it('refuses an address with nothing usable in it', async () => {
      await expect(service.create({ ...minimal, slug: '!!!' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('falls back rather than inventing a name for a non-Latin title', async () => {
      const created = await service.create({
        ...minimal,
        name: 'Демократия',
      });

      // Generic, and the organizer can set a readable address themselves.
      expect(created.slug).toBe('series');
    });

    it('trims the text and treats an emptied field as no value', async () => {
      const created = await service.create({
        name: '  Spaced Out  ',
        description: '  Description.  ',
        websiteUrl: '   ',
        contactEmail: null,
      });

      expect(created.name).toBe('Spaced Out');
      expect(created.description).toBe('Description.');
      expect(created.websiteUrl).toBeNull();
      expect(created.contactEmail).toBeNull();
    });

    it('turns a lost race against the unique index into a conflict', async () => {
      repository.collideOnCreate = true;

      await expect(service.create(minimal)).rejects.toThrow(ConflictException);
    });
  });

  describe('what a participant sees', () => {
    beforeEach(async () => {
      await service.create({ ...minimal, status: 'published' });
      await service.create({ ...minimal, name: 'Draft Series' });
      await service.create({
        ...minimal,
        name: 'Old Series',
        status: 'archived',
      });
    });

    it('lists only published series', async () => {
      const published = await service.listPublic();

      expect(published.map((series) => series.name)).toEqual([
        'Climate Conference 2027',
      ]);
    });

    it('carries nothing but what was published', async () => {
      const [series] = await service.listPublic();

      // No status, no timestamps: the public payload is a different shape, not
      // the organizer's with fields blanked out.
      expect(Object.keys(series).sort()).toEqual([
        'contactEmail',
        'description',
        'id',
        'logoUrl',
        'name',
        'slug',
        'websiteUrl',
      ]);
    });

    it('shows every series to the organizer, whatever its status', async () => {
      expect((await service.listForOrganizer()).map((s) => s.status)).toEqual([
        'published',
        'draft',
        'archived',
      ]);
    });

    it('answers 404 for a draft, so an unannounced series stays unannounced', async () => {
      await expect(service.getPublicBySlug('draft-series')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('answers 404 for an archived series too', async () => {
      await expect(service.getPublicBySlug('old-series')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('serves a published series by its address', async () => {
      const series = await service.getPublicBySlug('climate-conference-2027');

      expect(series.name).toBe('Climate Conference 2027');
    });
  });

  describe('update', () => {
    it('leaves the public address alone when the name changes', async () => {
      const created = await service.create(minimal);

      const renamed = await service.update(created.id, {
        name: 'Climate Conference 2028',
      });

      // Links that are already out there have to keep working.
      expect(renamed.slug).toBe('climate-conference-2027');
      expect(renamed.name).toBe('Climate Conference 2028');
    });

    it('changes the address when it is sent explicitly', async () => {
      const created = await service.create(minimal);

      expect(
        (await service.update(created.id, { slug: 'cop-2028' })).slug,
      ).toBe('cop-2028');
    });

    it('does not treat a series own address as a collision with itself', async () => {
      const created = await service.create({ ...minimal, slug: 'cop-2027' });

      expect(
        (await service.update(created.id, { slug: 'cop-2027' })).slug,
      ).toBe('cop-2027');
    });

    it('writes only the fields that were sent', async () => {
      const created = await service.create({
        ...minimal,
        websiteUrl: 'https://example.org',
      });

      const updated = await service.update(created.id, { status: 'published' });

      expect(updated.websiteUrl).toBe('https://example.org');
      expect(updated.description).toBe(minimal.description);
      expect(updated.status).toBe('published');
    });

    it('clears a field that was sent as null', async () => {
      const created = await service.create({
        ...minimal,
        websiteUrl: 'https://example.org',
      });

      expect(
        (await service.update(created.id, { websiteUrl: null })).websiteUrl,
      ).toBeNull();
    });

    it('answers 404 for a series that does not exist', async () => {
      await expect(
        service.update('series-99', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('removes a series that was created by mistake', async () => {
      const created = await service.create(minimal);

      await service.delete(created.id);

      expect(repository.rows).toHaveLength(0);
    });

    it('answers 404 for a series that is already gone', async () => {
      await expect(service.delete('series-99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses a series whose events carry confirmed registrations', async () => {
      const created = await service.create(minimal);
      tally.confirmedPerSeries = 12;

      // The foreign key would cascade through events and registrations alike;
      // that is precisely why the rule is here and not in the schema (E14).
      await expect(service.delete(created.id)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.rows).toHaveLength(1);
    });
  });
});
