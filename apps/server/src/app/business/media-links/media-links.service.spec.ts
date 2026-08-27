import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type {
  OrganizerEvent,
  ProgramItem,
  PublicEvent,
} from '@trefaro/shared-models';
import { MAX_MEDIA_LINKS_PER_EVENT } from '@trefaro/shared-models';
import type { EventsService } from '../events';
import type { ProgramService } from '../program';
import { MediaLinksService } from './media-links.service';
import type {
  MediaLinkChanges,
  MediaLinkRecord,
  MediaLinkRepository,
  NewMediaLink,
} from './ports/media-link.repository';

/**
 * External media links (FR 3.6, F10) — AP 11.
 *
 * What is worth testing here is not storage but the four rules the service
 * exists for: only addresses a click may follow, a session that belongs to this
 * event, the order the sections are shown in, and a ceiling per event. The
 * database enforces the second one as well, through a composite foreign key —
 * this suite is about answering 400 rather than letting that become a 500.
 */
class FakeMediaLinkRepository implements MediaLinkRepository {
  readonly rows: MediaLinkRecord[] = [];
  private nextId = 1;
  private clock = 0;

  async findByEvent(eventId: string): Promise<readonly MediaLinkRecord[]> {
    // Oldest first, as the port promises.
    return this.rows
      .filter((row) => row.eventId === eventId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findById(id: string): Promise<MediaLinkRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(link: NewMediaLink): Promise<MediaLinkRecord> {
    const created: MediaLinkRecord = {
      id: `link-${this.nextId++}`,
      createdAt: new Date(2026, 7, 27, 9, 0, this.clock++),
      updatedAt: new Date(2026, 7, 27, 9, 0, 0),
      ...link,
    };
    this.rows.push(created);
    return created;
  }

  async update(
    id: string,
    changes: MediaLinkChanges,
  ): Promise<MediaLinkRecord | null> {
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

const EVENT = { id: 'event-1', slug: 'kickoff' } as OrganizerEvent;

/** Just enough of the events service to answer the two questions asked of it. */
class FakeEventsService {
  publicEvents = new Map<string, string>([['kickoff', 'event-1']]);

  async getForOrganizer(id: string): Promise<OrganizerEvent> {
    if (id !== EVENT.id) {
      throw new NotFoundException(`No event with id "${id}"`);
    }
    return EVENT;
  }

  async getPublic(seriesSlug: string, eventSlug: string): Promise<PublicEvent> {
    const id = this.publicEvents.get(eventSlug);
    if (!id) throw new NotFoundException(`No event at "${seriesSlug}"`);
    return { id, slug: eventSlug } as PublicEvent;
  }
}

/** Two sessions: one of this event, one of another. */
class FakeProgramService {
  readonly items = new Map<string, string>([
    ['session-1', 'event-1'],
    ['session-elsewhere', 'event-2'],
  ]);

  async getForOrganizer(id: string): Promise<ProgramItem> {
    const eventId = this.items.get(id);
    if (!eventId) {
      throw new NotFoundException('This programme item no longer exists.');
    }
    return { id, eventId } as ProgramItem;
  }
}

describe('MediaLinksService', () => {
  let repository: FakeMediaLinkRepository;
  let events: FakeEventsService;
  let program: FakeProgramService;
  let service: MediaLinksService;

  const stream = {
    kind: 'stream',
    title: 'Watch live',
    url: 'https://tube.example.org/live',
  } as const;

  beforeEach(() => {
    repository = new FakeMediaLinkRepository();
    events = new FakeEventsService();
    program = new FakeProgramService();
    service = new MediaLinksService(
      repository,
      events as unknown as EventsService,
      program as unknown as ProgramService,
    );
  });

  describe('adding a link', () => {
    it('stores a link that belongs to the whole event', async () => {
      const created = await service.create(EVENT.id, stream);

      expect(created).toMatchObject({
        eventId: 'event-1',
        kind: 'stream',
        title: 'Watch live',
        url: 'https://tube.example.org/live',
        programItemId: null,
      });
    });

    it('trims the title and the address', async () => {
      const created = await service.create(EVENT.id, {
        ...stream,
        title: '  Watch live  ',
        url: '  https://tube.example.org/live  ',
      });

      expect(created.title).toBe('Watch live');
      expect(created.url).toBe('https://tube.example.org/live');
    });

    it('refuses a title that is only whitespace', async () => {
      // The instance never asks the target what it is called (F51), so an empty
      // title would render as a link with no text at all.
      await expect(
        service.create(EVENT.id, { ...stream, title: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['javascript:alert(1)'],
      ['data:text/html,<script></script>'],
      ['tube.example.org/live'],
    ])('refuses %s as an address', async (url) => {
      // Not tidiness: an href an organizer typed is a link a visitor clicks, and
      // a bare word resolves against this instance.
      await expect(
        service.create(EVENT.id, { ...stream, url }),
      ).rejects.toThrow(BadRequestException);
    });

    it('attaches a link to a session of this event', async () => {
      const created = await service.create(EVENT.id, {
        kind: 'recording',
        title: 'Keynote recording',
        url: 'https://tube.example.org/w/keynote',
        programItemId: 'session-1',
      });

      expect(created.programItemId).toBe('session-1');
    });

    it('refuses a session that belongs to another event', async () => {
      // The database refuses it too — the foreign key is the pair
      // `(program_item_id, event_id)`. This is the 400 that keeps it from
      // arriving as a 500.
      await expect(
        service.create(EVENT.id, {
          ...stream,
          programItemId: 'session-elsewhere',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('turns an unknown session into the programme’s own 404', async () => {
      await expect(
        service.create(EVENT.id, { ...stream, programItemId: 'session-gone' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('says 404 for an unknown event rather than storing an orphan', async () => {
      await expect(service.create('event-missing', stream)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.rows).toHaveLength(0);
    });

    it('refuses the link past the ceiling', async () => {
      for (let index = 0; index < MAX_MEDIA_LINKS_PER_EVENT; index += 1) {
        await service.create(EVENT.id, {
          ...stream,
          url: `https://tube.example.org/live/${index}`,
        });
      }

      await expect(service.create(EVENT.id, stream)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('reading the links', () => {
    beforeEach(async () => {
      await service.create(EVENT.id, {
        kind: 'material',
        title: 'Slides',
        url: 'https://files.example.org/slides.pdf',
      });
      await service.create(EVENT.id, stream);
      await service.create(EVENT.id, {
        kind: 'recording',
        title: 'Keynote recording',
        url: 'https://tube.example.org/w/keynote',
      });
    });

    it('orders them by kind, then as they were added', async () => {
      const links = await service.listForOrganizer(EVENT.id);

      // What is on now, what can be watched again, what can be read (F52).
      expect(links.map((link) => link.kind)).toEqual([
        'stream',
        'recording',
        'material',
      ]);
    });

    it('says 404 for an unknown event rather than an empty list', async () => {
      await expect(service.listForOrganizer('event-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('answers the public list through the public event lookup', async () => {
      const links = await service.listPublic('democracy-days', 'kickoff');

      // A link is public the moment it exists — unlike the follow-up text, which
      // is withheld until the event has ended (F50): a stream URL is needed
      // *before* the event.
      expect(links.map((link) => link.title)).toEqual([
        'Watch live',
        'Keynote recording',
        'Slides',
      ]);
      // Nothing an organizer sees and a participant should not.
      expect(Object.keys(links[0]).sort()).toEqual([
        'id',
        'kind',
        'programItemId',
        'title',
        'url',
      ]);
    });

    it('inherits the 404 of a draft event on the public list', async () => {
      await expect(
        service.listPublic('democracy-days', 'not-published'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changing and removing a link', () => {
    it('writes only what was sent', async () => {
      const created = await service.create(EVENT.id, stream);

      const updated = await service.update(created.id, {
        url: 'https://tube.example.org/live-2',
      });

      expect(updated.url).toBe('https://tube.example.org/live-2');
      expect(updated.title).toBe('Watch live');
      expect(updated.kind).toBe('stream');
    });

    it('checks a new session against the link’s own event', async () => {
      const created = await service.create(EVENT.id, stream);

      await expect(
        service.update(created.id, { programItemId: 'session-elsewhere' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('detaches a link from its session when null is sent', async () => {
      const created = await service.create(EVENT.id, {
        ...stream,
        programItemId: 'session-1',
      });

      expect(
        (await service.update(created.id, { programItemId: null }))
          .programItemId,
      ).toBeNull();
    });

    it('refuses an address a click must not follow, on update as well', async () => {
      const created = await service.create(EVENT.id, stream);

      await expect(
        service.update(created.id, { url: 'javascript:alert(1)' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('says 404 for a link that is already gone', async () => {
      await expect(
        service.update('link-gone', { title: 'Anything' }),
      ).rejects.toThrow(NotFoundException);
      await expect(service.delete('link-gone')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes a link without asking anything else', async () => {
      const created = await service.create(EVENT.id, stream);

      await service.delete(created.id);

      // No archive flag and no confirmed-registration rule (unlike an event,
      // E14): the media it pointed at was never ours to keep.
      expect(repository.rows).toHaveLength(0);
    });
  });
});
