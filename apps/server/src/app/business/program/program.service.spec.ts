import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { OrganizerEvent, PublicEvent } from '@trefaro/shared-models';
import { MAX_PROGRAM_ITEMS } from '@trefaro/shared-models';
import type { EventsService } from '../events';
import { ProgramService } from './program.service';
import type {
  NewProgramItem,
  ProgramItemChanges,
  ProgramItemRecord,
  ProgramItemRepository,
} from './ports/program-item.repository';

/**
 * The programme rules of AP 8 (FR 3.7, F40, F41).
 *
 * The acceptance criterion of the work package is the first block: an item
 * outside the event's period is refused. The rest is what makes that rule
 * survivable — an event whose period moves must not lock its own programme.
 */
class FakeProgramItemRepository implements ProgramItemRepository {
  readonly rows: ProgramItemRecord[] = [];
  private nextId = 1;

  async findByEvent(eventId: string): Promise<readonly ProgramItemRecord[]> {
    return this.rows
      .filter((row) => row.eventId === eventId)
      .sort(
        (left, right) =>
          left.startsAt.getTime() - right.startsAt.getTime() ||
          left.endsAt.getTime() - right.endsAt.getTime() ||
          left.id.localeCompare(right.id),
      );
  }

  async findById(id: string): Promise<ProgramItemRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(item: NewProgramItem): Promise<ProgramItemRecord> {
    const created: ProgramItemRecord = {
      id: `item-${this.nextId++}`,
      createdAt: new Date('2026-08-27T09:00:00Z'),
      updatedAt: new Date('2026-08-27T09:00:00Z'),
      ...item,
    };
    this.rows.push(created);
    return created;
  }

  async update(
    id: string,
    changes: ProgramItemChanges,
  ): Promise<ProgramItemRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = { ...this.rows[index], ...changes };
    return this.rows[index];
  }

  async delete(id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }
}

/** A one-day conference in Cologne: 08:00 to 18:00 local, 14 June 2027. */
const EVENT: OrganizerEvent = {
  id: 'event-1',
  seriesId: 'series-1',
  slug: 'kickoff',
  name: 'Kickoff in Cologne',
  description: 'The event this programme belongs to.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2027-06-14T06:00:00.000Z',
  endsAt: '2027-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  status: 'published',
  createdAt: '2026-08-27T09:00:00.000Z',
  updatedAt: '2026-08-27T09:00:00.000Z',
};

/** A session comfortably inside the event: 09:00–10:30 local. */
const KEYNOTE = {
  title: 'Keynote',
  startsAt: '2027-06-14T07:00:00.000Z',
  endsAt: '2027-06-14T08:30:00.000Z',
} as const;

describe('ProgramService', () => {
  let repository: FakeProgramItemRepository;
  let events: {
    event: OrganizerEvent;
    getForOrganizer: jest.Mock;
    getPublic: jest.Mock;
  };
  let service: ProgramService;

  beforeEach(() => {
    repository = new FakeProgramItemRepository();
    const state = { event: EVENT };
    events = {
      get event() {
        return state.event;
      },
      set event(value: OrganizerEvent) {
        state.event = value;
      },
      getForOrganizer: jest.fn(async (id: string) => {
        if (id !== state.event.id) throw new NotFoundException();
        return state.event;
      }),
      getPublic: jest.fn(async () => state.event as PublicEvent),
    };
    service = new ProgramService(
      repository,
      events as unknown as EventsService,
    );
  });

  describe('create', () => {
    it('accepts a session inside the event', async () => {
      const item = await service.create(EVENT.id, KEYNOTE);

      expect(item.title).toBe('Keynote');
      expect(item.eventId).toBe(EVENT.id);
      expect(item.startsAt).toBe(KEYNOTE.startsAt);
    });

    it('refuses one that starts before the event does', async () => {
      await expect(
        service.create(EVENT.id, {
          title: 'Breakfast',
          startsAt: '2027-06-14T05:00:00.000Z',
          endsAt: '2027-06-14T06:30:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.rows).toHaveLength(0);
    });

    it('refuses one that ends after the event does', async () => {
      await expect(
        service.create(EVENT.id, {
          title: 'Late night session',
          startsAt: '2027-06-14T15:00:00.000Z',
          endsAt: '2027-06-14T17:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses one on an entirely different day', async () => {
      await expect(
        service.create(EVENT.id, {
          title: 'Day two',
          startsAt: '2027-06-15T07:00:00.000Z',
          endsAt: '2027-06-15T08:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('names the event’s own period in the refusal, in its zone', async () => {
      // What an organizer who typed the wrong day actually needs to read.
      await expect(
        service.create(EVENT.id, {
          title: 'Day two',
          startsAt: '2027-06-15T07:00:00.000Z',
          endsAt: '2027-06-15T08:00:00.000Z',
        }),
      ).rejects.toThrow(/June 14, 2027, 08:00–18:00/);
    });

    it('accepts a session that fills the event exactly', async () => {
      const item = await service.create(EVENT.id, {
        title: 'One long workshop',
        startsAt: EVENT.startsAt,
        endsAt: EVENT.endsAt,
      });
      expect(item.endsAt).toBe(EVENT.endsAt);
    });

    it('refuses a session of no length', async () => {
      await expect(
        service.create(EVENT.id, {
          title: 'Nothing at all',
          startsAt: KEYNOTE.startsAt,
          endsAt: KEYNOTE.startsAt,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a session that ends before it starts', async () => {
      await expect(
        service.create(EVENT.id, {
          title: 'Backwards',
          startsAt: KEYNOTE.endsAt,
          endsAt: KEYNOTE.startsAt,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses an unparseable date', async () => {
      await expect(
        service.create(EVENT.id, {
          title: 'Whenever',
          startsAt: 'next Tuesday',
          endsAt: KEYNOTE.endsAt,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts two sessions at the same time — that is a two-track day (F41)', async () => {
      await service.create(EVENT.id, KEYNOTE);
      const parallel = await service.create(EVENT.id, {
        title: 'Workshop in the other room',
        startsAt: KEYNOTE.startsAt,
        endsAt: KEYNOTE.endsAt,
      });

      expect(parallel.id).toBeDefined();
      expect(repository.rows).toHaveLength(2);
    });

    it('trims the title and refuses an empty one', async () => {
      const item = await service.create(EVENT.id, {
        ...KEYNOTE,
        title: '  Keynote  ',
      });
      expect(item.title).toBe('Keynote');

      await expect(
        service.create(EVENT.id, { ...KEYNOTE, title: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('reads an emptied abstract as no abstract, not as an empty one', async () => {
      const item = await service.create(EVENT.id, {
        ...KEYNOTE,
        description: '   ',
        speaker: '',
      });

      expect(item.description).toBeNull();
      expect(item.speaker).toBeNull();
    });

    it('refuses an item for an event that does not exist', async () => {
      await expect(service.create('event-nope', KEYNOTE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to grow a programme past its bound', async () => {
      for (let index = 0; index < MAX_PROGRAM_ITEMS; index += 1) {
        await repository.create({
          eventId: EVENT.id,
          title: `Session ${index}`,
          description: null,
          speaker: null,
          startsAt: new Date(KEYNOTE.startsAt),
          endsAt: new Date(KEYNOTE.endsAt),
        });
      }

      await expect(service.create(EVENT.id, KEYNOTE)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('moves a session within the event', async () => {
      const item = await service.create(EVENT.id, KEYNOTE);

      const moved = await service.update(item.id, {
        startsAt: '2027-06-14T09:00:00.000Z',
        endsAt: '2027-06-14T10:00:00.000Z',
      });

      expect(moved.startsAt).toBe('2027-06-14T09:00:00.000Z');
    });

    it('refuses a move that leaves the event', async () => {
      const item = await service.create(EVENT.id, KEYNOTE);

      await expect(
        service.update(item.id, { startsAt: '2027-06-13T07:00:00.000Z' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('checks the merged period, not just the half that was sent', async () => {
      const item = await service.create(EVENT.id, KEYNOTE);

      // Only the end moves, and it moves past the end of the event.
      await expect(
        service.update(item.id, { endsAt: '2027-06-14T17:00:00.000Z' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('still lets an item the event left behind be reworded', async () => {
      const item = await service.create(EVENT.id, KEYNOTE);
      // The organizer shifts the conference to the following day; the programme
      // stays where it was (F41) and has to remain editable.
      events.event = {
        ...EVENT,
        startsAt: '2027-06-15T06:00:00.000Z',
        endsAt: '2027-06-15T16:00:00.000Z',
      };

      const renamed = await service.update(item.id, { title: 'Opening words' });

      expect(renamed.title).toBe('Opening words');
    });

    it('makes an item the event left behind land inside when its time is set', async () => {
      const item = await service.create(EVENT.id, KEYNOTE);
      events.event = {
        ...EVENT,
        startsAt: '2027-06-15T06:00:00.000Z',
        endsAt: '2027-06-15T16:00:00.000Z',
      };

      await expect(
        service.update(item.id, { startsAt: '2027-06-14T09:00:00.000Z' }),
      ).rejects.toThrow(BadRequestException);

      const moved = await service.update(item.id, {
        startsAt: '2027-06-15T07:00:00.000Z',
        endsAt: '2027-06-15T08:00:00.000Z',
      });
      expect(moved.startsAt).toBe('2027-06-15T07:00:00.000Z');
    });

    it('does not resolve the event at all for a change that has no period', async () => {
      const item = await service.create(EVENT.id, KEYNOTE);
      events.getForOrganizer.mockClear();

      await service.update(item.id, { speaker: 'Dr. Amara Nwosu' });

      expect(events.getForOrganizer).not.toHaveBeenCalled();
    });

    it('is a 404 for an item that no longer exists', async () => {
      await expect(
        service.update('item-nope', { title: 'Anything' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listForOrganizer', () => {
    it('returns the programme in the order it happens', async () => {
      await service.create(EVENT.id, {
        title: 'Lunch',
        startsAt: '2027-06-14T10:00:00.000Z',
        endsAt: '2027-06-14T11:00:00.000Z',
      });
      await service.create(EVENT.id, KEYNOTE);

      expect(
        (await service.listForOrganizer(EVENT.id)).map((item) => item.title),
      ).toEqual(['Keynote', 'Lunch']);
    });

    it('is a 404 for an unknown event rather than an empty programme', async () => {
      await expect(service.listForOrganizer('event-nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listPublic', () => {
    it('goes through the public event lookup, so a draft stays invisible', async () => {
      await service.create(EVENT.id, KEYNOTE);

      const items = await service.listPublic('series', 'kickoff');

      expect(events.getPublic).toHaveBeenCalledWith('series', 'kickoff');
      expect(items).toHaveLength(1);
      // Nothing internal: no event id, no timestamps.
      expect(Object.keys(items[0]).sort()).toEqual([
        'description',
        'endsAt',
        'id',
        'speaker',
        'startsAt',
        'title',
      ]);
    });
  });

  describe('delete', () => {
    it('removes a session', async () => {
      const item = await service.create(EVENT.id, KEYNOTE);

      await service.delete(item.id);

      expect(repository.rows).toHaveLength(0);
    });

    it('is a 404 for one that was already gone', async () => {
      await expect(service.delete('item-nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
