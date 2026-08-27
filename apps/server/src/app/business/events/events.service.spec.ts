import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { EventSeries, PublicEventSeries } from '@trefaro/shared-models';
import type { EventSeriesService } from '../event-series/event-series.service';
import type { RegistrationTally } from '../registration/ports/registration-tally';
import { EventsService, type CreateEventInput } from './events.service';
import {
  EventSlugTakenError,
  type EventChanges,
  type EventRecord,
  type EventRepository,
  type NewEvent,
} from './ports/event.repository';

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

class FakeEventRepository implements EventRepository {
  readonly rows: EventRecord[] = [];
  /** Set to make the next write lose the race against the unique index. */
  collideOnCreate = false;
  private nextId = 1;

  async findBySeries(seriesId: string): Promise<readonly EventRecord[]> {
    return this.rows
      .filter((row) => row.seriesId === seriesId)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async findPublishedBySeries(
    seriesId: string,
  ): Promise<readonly EventRecord[]> {
    return (await this.findBySeries(seriesId)).filter(
      (row) => row.status === 'published',
    );
  }

  async findById(id: string): Promise<EventRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findBySlug(
    seriesId: string,
    slug: string,
  ): Promise<EventRecord | null> {
    return (
      this.rows.find((row) => row.seriesId === seriesId && row.slug === slug) ??
      null
    );
  }

  async create(event: NewEvent): Promise<EventRecord> {
    if (this.collideOnCreate) {
      throw new EventSlugTakenError(event.seriesId, event.slug);
    }
    const created: EventRecord = {
      id: `event-${this.nextId++}`,
      logoPath: null,
      createdAt: new Date('2026-08-27T09:00:00Z'),
      updatedAt: new Date('2026-08-27T09:00:00Z'),
      ...event,
    };
    this.rows.push(created);
    return created;
  }

  async update(id: string, changes: EventChanges): Promise<EventRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = {
      ...this.rows[index],
      ...changes,
      updatedAt: new Date('2026-08-27T10:00:00Z'),
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

/** Just enough of the series service to answer the two questions events ask. */
class FakeEventSeriesService {
  readonly published = new Map<string, string>([['climate-2027', 'series-1']]);
  readonly known = new Set<string>(['series-1', 'series-2']);

  async getForOrganizer(id: string): Promise<EventSeries> {
    if (!this.known.has(id)) {
      throw new NotFoundException(`No event series with id "${id}"`);
    }
    const slug = [...this.published].find(([, known]) => known === id)?.[0];
    return { id, slug: slug ?? `series-${id}` } as EventSeries;
  }

  async getPublicBySlug(slug: string): Promise<PublicEventSeries> {
    const id = this.published.get(slug);
    if (!id) throw new NotFoundException(`No event series at "${slug}"`);
    return { id, slug } as PublicEventSeries;
  }
}

describe('EventsService', () => {
  let repository: FakeEventRepository;
  let series: FakeEventSeriesService;
  let tally: FakeRegistrationTally;
  let service: EventsService;

  const onsite: CreateEventInput = {
    name: 'Kickoff in Cologne',
    description: 'The opening weekend.',
    eventType: 'onsite',
    startsAt: '2027-03-14T08:00:00.000Z',
    endsAt: '2027-03-14T16:00:00.000Z',
    timezone: 'Europe/Berlin',
    venueName: 'Bürgerhaus Kalk',
    languages: ['de', 'en'],
  };

  beforeEach(() => {
    repository = new FakeEventRepository();
    series = new FakeEventSeriesService();
    tally = new FakeRegistrationTally();
    service = new EventsService(
      repository,
      series as unknown as EventSeriesService,
      tally,
    );
  });

  describe('create', () => {
    it('derives the public address from the name', async () => {
      const created = await service.create('series-1', onsite);

      expect(created.slug).toBe('kickoff-in-cologne');
    });

    it('lets two series each hold the same address', async () => {
      await service.create('series-1', onsite);
      const second = await service.create('series-2', onsite);

      // Scoped per series (E7): numbering the second would be a worse address
      // for no reason, since the series is part of the URL.
      expect(second.slug).toBe('kickoff-in-cologne');
    });

    it('numbers a second event with the same name in one series', async () => {
      await service.create('series-1', onsite);
      const second = await service.create('series-1', onsite);

      expect(second.slug).toBe('kickoff-in-cologne-2');
    });

    it('starts an event as a draft', async () => {
      const created = await service.create('series-1', onsite);

      expect(created.status).toBe('draft');
    });

    it('refuses an unknown series', async () => {
      await expect(service.create('series-9', onsite)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('accepts an incomplete draft', async () => {
      // Planning starts before the venue is booked; demanding the address up
      // front would only produce a placeholder.
      const created = await service.create('series-1', {
        ...onsite,
        venueName: null,
      });

      expect(created.venueName).toBeNull();
    });

    it('refuses to publish an on-site event without a venue', async () => {
      await expect(
        service.create('series-1', {
          ...onsite,
          venueName: null,
          status: 'published',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to publish an online event without a link', async () => {
      await expect(
        service.create('series-1', {
          ...onsite,
          eventType: 'online',
          venueName: null,
          status: 'published',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to publish a hybrid event that has only a venue', async () => {
      await expect(
        service.create('series-1', {
          ...onsite,
          eventType: 'hybrid',
          status: 'published',
        }),
      ).rejects.toThrow(/needs a link/);
    });

    it('publishes a hybrid event that has both', async () => {
      const created = await service.create('series-1', {
        ...onsite,
        eventType: 'hybrid',
        onlineUrl: 'https://stream.example.org/kickoff',
        status: 'published',
      });

      expect(created.eventType).toBe('hybrid');
      expect(created.venueName).toBe('Bürgerhaus Kalk');
      expect(created.onlineUrl).toBe('https://stream.example.org/kickoff');
    });

    it('refuses an event that ends before it starts', async () => {
      await expect(
        service.create('series-1', {
          ...onsite,
          endsAt: '2027-03-14T07:00:00.000Z',
        }),
      ).rejects.toThrow(/cannot end before it starts/);
    });

    it('accepts an event that starts and ends at the same instant', async () => {
      const created = await service.create('series-1', {
        ...onsite,
        endsAt: onsite.startsAt,
      });

      expect(created.endsAt).toBe(created.startsAt);
    });

    it('refuses a time zone that is not one', async () => {
      await expect(
        service.create('series-1', { ...onsite, timezone: 'Europe/Atlantis' }),
      ).rejects.toThrow(/is not a time zone/);
    });

    it('drops duplicate languages and keeps the order', async () => {
      const created = await service.create('series-1', {
        ...onsite,
        languages: ['de', 'en', 'de'],
      });

      expect(created.languages).toEqual(['de', 'en']);
    });

    it('refuses an event with no language left after trimming', async () => {
      await expect(
        service.create('series-1', { ...onsite, languages: ['  '] }),
      ).rejects.toThrow(/at least one language/);
    });

    it('turns an emptied optional field into null, not an empty string', async () => {
      const created = await service.create('series-1', {
        ...onsite,
        venueAddress: '   ',
        onlineUrl: '',
      });

      expect(created.venueAddress).toBeNull();
      expect(created.onlineUrl).toBeNull();
    });

    it('reports a lost race on the address as a conflict', async () => {
      repository.collideOnCreate = true;

      await expect(service.create('series-1', onsite)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('keeps the address when the name changes', async () => {
      const created = await service.create('series-1', onsite);

      const renamed = await service.update(created.id, {
        name: 'Kickoff in Cologne, second try',
      });

      // A link that is already out there must survive a fixed typo.
      expect(renamed.slug).toBe('kickoff-in-cologne');
    });

    it('changes the address when one is sent explicitly', async () => {
      const created = await service.create('series-1', onsite);

      const moved = await service.update(created.id, { slug: 'Opening Night' });

      expect(moved.slug).toBe('opening-night');
    });

    it('accepts switching to hybrid and adding the link in one request', async () => {
      const created = await service.create('series-1', onsite);

      const updated = await service.update(created.id, {
        eventType: 'hybrid',
        onlineUrl: 'https://stream.example.org/kickoff',
        status: 'published',
      });

      expect(updated.status).toBe('published');
    });

    it('refuses to publish an event that is still missing its link', async () => {
      const created = await service.create('series-1', {
        ...onsite,
        eventType: 'hybrid',
      });

      await expect(
        service.update(created.id, { status: 'published' }),
      ).rejects.toThrow(/needs a link/);
    });

    it('checks the new end against the stored start', async () => {
      const created = await service.create('series-1', onsite);

      await expect(
        service.update(created.id, { endsAt: '2027-03-13T08:00:00.000Z' }),
      ).rejects.toThrow(/cannot end before it starts/);
    });

    it('refuses an unknown event', async () => {
      await expect(service.update('event-9', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('the participant view', () => {
    it('lists only published events of a published series', async () => {
      const published = await service.create('series-1', {
        ...onsite,
        status: 'published',
      });
      await service.create('series-1', { ...onsite, name: 'Still planning' });

      const visible = await service.listPublic('climate-2027');

      expect(visible.map((event) => event.id)).toEqual([published.id]);
    });

    it('says 404 for a draft event', async () => {
      const draft = await service.create('series-1', onsite);

      await expect(
        service.getPublic('climate-2027', draft.slug),
      ).rejects.toThrow(NotFoundException);
    });

    it('says 404 for a published event in a series that is not public', async () => {
      const event = await service.create('series-2', {
        ...onsite,
        status: 'published',
      });

      // series-2 is not published, so nothing inside it is reachable — the
      // event's own status does not override its series'.
      await expect(
        service.getPublic('unlisted-series', event.slug),
      ).rejects.toThrow(NotFoundException);
    });

    it('carries no organizer fields', async () => {
      await service.create('series-1', { ...onsite, status: 'published' });

      const [event] = await service.listPublic('climate-2027');

      expect(Object.keys(event).sort()).toEqual([
        'description',
        'endsAt',
        'eventType',
        'id',
        'languages',
        'logoUrl',
        'name',
        'onlineUrl',
        'slug',
        'startsAt',
        'timezone',
        'venueAddress',
        'venueName',
      ]);
    });
  });

  describe('the organizer view', () => {
    it('lists drafts and published events in date order', async () => {
      const later = await service.create('series-1', {
        ...onsite,
        name: 'Closing',
        startsAt: '2027-05-14T08:00:00.000Z',
        endsAt: '2027-05-14T16:00:00.000Z',
      });
      const earlier = await service.create('series-1', onsite);

      const events = await service.listForOrganizer('series-1');

      expect(events.map((event) => event.id)).toEqual([earlier.id, later.id]);
    });

    it('says 404 for an unknown series rather than an empty list', async () => {
      await expect(service.listForOrganizer('series-9')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('removes the event', async () => {
      const created = await service.create('series-1', onsite);

      await service.delete(created.id);

      await expect(service.getForOrganizer(created.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses an unknown event', async () => {
      await expect(service.delete('event-9')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses an event people have confirmed they are coming to', async () => {
      const created = await service.create('series-1', onsite);
      tally.confirmedPerEvent = 3;

      // E14: archiving is the way to take it off the public pages. Deleting
      // would take three people's confirmed intent with it.
      await expect(service.delete(created.id)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.getForOrganizer(created.id)).resolves.toBeTruthy();
    });

    it('names how many registrations block the deletion', async () => {
      const created = await service.create('series-1', onsite);
      tally.confirmedPerEvent = 1;

      // Singular, because "1 confirmed registrations" is the kind of detail that
      // makes an organizer distrust the number.
      await expect(service.delete(created.id)).rejects.toThrow(
        /1 confirmed registration —/,
      );
    });
  });

  describe('locate', () => {
    it('finds an event by id together with its series address', async () => {
      const created = await service.create('series-1', onsite);

      const located = await service.locate(created.id);

      expect(located.seriesSlug).toBe('climate-2027');
      expect(located.event.slug).toBe(created.slug);
    });

    it('still finds an event that has been unpublished', async () => {
      const created = await service.create('series-1', {
        ...onsite,
        status: 'draft',
      });

      // A confirmation link in somebody's inbox must not stop working because
      // the organizer pulled the event back to a draft.
      await expect(service.locate(created.id)).resolves.toBeTruthy();
    });
  });
});
