import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EventSeriesTranslation } from '@trefaro/shared-models';
import type { RegistrationTally } from '../registration/ports/registration-tally';
import type { AttachmentsService } from '../attachments';
import type { LogoImageService, LogoUpload } from '../logo-files';
import { EventSeriesService } from './event-series.service';
import type { EventSeriesTranslationReader } from './ports/event-series-translation.repository';
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

  async setLogoPath(
    id: string,
    storedPath: string | null,
  ): Promise<EventSeriesRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = {
      ...this.rows[index],
      logoPath: storedPath,
      // The real implementation moves `updated_at`, and the public URL's `?v=`
      // is read from it — a fake that left it alone would make the test pass for
      // a URL that never changes.
      updatedAt: new Date('2026-09-01T12:00:00Z'),
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

/**
 * The bytes half of a logo (FR 2.1), as this service sees it.
 *
 * Records rather than stores: what the service owes the volume is a sequence of
 * calls — write the new file, then unlink the old one, and unlink the new one if
 * the row write failed — and that sequence is the thing worth asserting. Whether
 * PNG bytes survive a round trip is `LogoImageService`'s own test.
 */
class FakeLogoImages {
  readonly stored: LogoUpload[] = [];
  readonly discarded: string[] = [];
  readonly purgedSeries: string[] = [];
  /** Set to make the next `store` behave like a refused upload. */
  refuse: Error | null = null;
  private next = 1;

  async store(upload: LogoUpload): Promise<string> {
    if (this.refuse) throw this.refuse;
    this.stored.push(upload);
    return `logos/stored-${this.next++}`;
  }

  async discard(paths: readonly (string | null)[]): Promise<void> {
    for (const path of paths) if (path) this.discarded.push(path);
  }

  async purgeUnderSeries(seriesId: string): Promise<void> {
    this.purgedSeries.push(seriesId);
  }

  async read(storedPath: string | null) {
    return storedPath
      ? { mimeType: 'image/png', bytes: Buffer.from([0x89, 0x50]) }
      : null;
  }
}

/** Records the purge the delete paths owe the upload volume (E9). */
class FakeAttachmentsService {
  readonly purgedEvents: string[] = [];
  readonly purgedSeries: string[] = [];

  async purgeForEvent(eventId: string): Promise<void> {
    this.purgedEvents.push(eventId);
  }

  async purgeForSeries(seriesId: string): Promise<void> {
    this.purgedSeries.push(seriesId);
  }
}

/**
 * What a series says in another language (FR 3.12).
 *
 * Keyed by language and then by series, the way the port is asked; a translation
 * for a language nobody requested must never turn up in an answer.
 */
class FakeSeriesTranslations implements EventSeriesTranslationReader {
  private readonly rows = new Map<
    string,
    Map<string, EventSeriesTranslation>
  >();

  set(id: string, locale: string, value: EventSeriesTranslation): void {
    const byId = this.rows.get(locale) ?? new Map();
    byId.set(id, value);
    this.rows.set(locale, byId);
  }

  async findForParents(
    ids: readonly string[],
    locale: string,
  ): Promise<ReadonlyMap<string, EventSeriesTranslation>> {
    const byId = this.rows.get(locale) ?? new Map();
    return new Map([...byId].filter(([id]) => ids.includes(id)));
  }
}

describe('EventSeriesService', () => {
  let repository: FakeEventSeriesRepository;
  let tally: FakeRegistrationTally;
  let attachments: FakeAttachmentsService;
  let translations: FakeSeriesTranslations;
  let logos: FakeLogoImages;
  let service: EventSeriesService;

  const minimal = {
    name: 'Climate Conference 2027',
    description: 'Three days on citizen participation.',
  };

  beforeEach(() => {
    repository = new FakeEventSeriesRepository();
    tally = new FakeRegistrationTally();
    attachments = new FakeAttachmentsService();
    translations = new FakeSeriesTranslations();
    logos = new FakeLogoImages();
    service = new EventSeriesService(
      repository,
      tally,
      attachments as unknown as AttachmentsService,
      translations,
      logos as unknown as LogoImageService,
    );
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

  describe('in another language (FR 3.12, E25)', () => {
    let published: string;

    beforeEach(async () => {
      published = (await service.create({ ...minimal, status: 'published' }))
        .id;
    });

    it('shows the translation where there is one', async () => {
      translations.set(published, 'de', {
        name: 'Klimakonferenz 2027',
        description: 'Drei Tage Bürgerbeteiligung.',
      });

      const series = await service.getPublicBySlug(
        'climate-conference-2027',
        'de',
      );

      expect(series.name).toBe('Klimakonferenz 2027');
      expect(series.description).toBe('Drei Tage Bürgerbeteiligung.');
    });

    it('falls back field by field, so a half-translated series has no hole', async () => {
      translations.set(published, 'de', {
        name: 'Klimakonferenz 2027',
        description: null,
      });

      const series = await service.getPublicBySlug(
        'climate-conference-2027',
        'de',
      );

      expect(series.name).toBe('Klimakonferenz 2027');
      expect(series.description).toBe('Three days on citizen participation.');
    });

    it('leaves the address alone — a link must not change with a language', async () => {
      translations.set(published, 'de', {
        name: 'Klimakonferenz 2027',
        description: null,
      });

      const series = await service.getPublicBySlug(
        'climate-conference-2027',
        'de',
      );

      expect(series.slug).toBe('climate-conference-2027');
    });

    it('shows the original for a language nobody has translated into', async () => {
      const series = await service.getPublicBySlug(
        'climate-conference-2027',
        'fr',
      );

      expect(series.name).toBe('Climate Conference 2027');
    });

    it('orders the list by the name the reader sees', async () => {
      const zulu = await service.create({
        ...minimal,
        name: 'Zulu Assembly',
        status: 'published',
      });
      // In English "Climate…" sorts first; in German the translations reverse
      // that, and the list has to follow what is on the screen.
      translations.set(published, 'de', {
        name: 'Zusammenkunft',
        description: null,
      });
      translations.set(zulu.id, 'de', {
        name: 'Andere Versammlung',
        description: null,
      });

      expect((await service.listPublic()).map((s) => s.name)).toEqual([
        'Climate Conference 2027',
        'Zulu Assembly',
      ]);
      expect((await service.listPublic('de')).map((s) => s.name)).toEqual([
        'Andere Versammlung',
        'Zusammenkunft',
      ]);
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
    it('removes a series that was created by mistake, files included', async () => {
      const created = await service.create(minimal);

      await service.delete(created.id);

      expect(repository.rows).toHaveLength(0);
      // The cascade reaches the registrations of every event; their files are
      // only reachable from here (E9).
      expect(attachments.purgedSeries).toEqual([created.id]);
    });

    it('answers 404 for a series that is already gone, removing nothing', async () => {
      await expect(service.delete('series-99')).rejects.toThrow(
        NotFoundException,
      );

      expect(attachments.purgedSeries).toEqual([]);
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

  describe('logo (FR 2.1)', () => {
    const png: LogoUpload = {
      mimeType: 'image/png',
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    };

    it('answers a URL that names the series, never a stored path (E19)', async () => {
      const created = await service.create(minimal);

      const url = await service.setLogo(created.id, png);

      // The whole of E19 in one assertion: the address carries the row's id and
      // nothing about where the bytes are. A URL with `logos/stored-1` in it
      // would put registration attachments one guess away.
      expect(url).toBe(
        `/api/media/series/${created.id}/logo?v=${new Date('2026-09-01T12:00:00Z').getTime()}`,
      );
      expect(url).not.toContain('stored-1');
    });

    it('shows the logo on the public pages once it is uploaded', async () => {
      const created = await service.create(minimal);
      await service.update(created.id, { status: 'published' });
      await service.setLogo(created.id, png);

      const [listed] = await service.listPublic();

      expect(listed.logoUrl).toContain(`/api/media/series/${created.id}/logo`);
    });

    it('has no logo URL before anything is uploaded', async () => {
      const created = await service.create(minimal);

      expect((await service.getForOrganizer(created.id)).logoUrl).toBeNull();
    });

    it('removes the file it replaced, in that order', async () => {
      const created = await service.create(minimal);
      await service.setLogo(created.id, png);

      await service.setLogo(created.id, png);

      // Two files written, the first one gone: there is at most one logo per
      // row, so a leftover would be invisible forever rather than merely
      // wasteful.
      expect(logos.stored).toHaveLength(2);
      expect(logos.discarded).toEqual(['logos/stored-1']);
    });

    it('costs no bytes for a series that does not exist', async () => {
      await expect(service.setLogo('series-99', png)).rejects.toThrow(
        NotFoundException,
      );

      expect(logos.stored).toEqual([]);
    });

    it('leaves the volume as it was when the row write fails', async () => {
      const created = await service.create(minimal);
      jest
        .spyOn(repository, 'setLogoPath')
        .mockRejectedValueOnce(new Error('connection lost'));

      await expect(service.setLogo(created.id, png)).rejects.toThrow(
        'connection lost',
      );

      // The file was written before the column could point at it, so nothing
      // else will ever name it — it goes here or never.
      expect(logos.discarded).toEqual(['logos/stored-1']);
    });

    it('clears the column and unlinks the file when the logo is removed', async () => {
      const created = await service.create(minimal);
      await service.setLogo(created.id, png);

      expect(await service.removeLogo(created.id)).toBeNull();

      expect((await service.getForOrganizer(created.id)).logoUrl).toBeNull();
      // Read before the write, or the path would already be `null` by the time
      // anybody asked which file to unlink.
      expect(logos.discarded).toEqual(['logos/stored-1']);
    });

    it('answers 404 when removing the logo of a series that is gone', async () => {
      await expect(service.removeLogo('series-99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('serves the logo of a series that is still a draft', async () => {
      const created = await service.create(minimal);
      await service.setLogo(created.id, png);

      // Deliberate: reaching it needs the row's uuid, the bytes are a brand
      // rather than participant data, and a draft whose logo 404s would break
      // the organizer's own form in the state they are working in.
      expect(await service.readLogo(created.id)).not.toBeNull();
    });

    it('answers nothing for an id that is not a series', async () => {
      expect(await service.readLogo('series-99')).toBeNull();
    });

    it('unlinks every logo below a series before deleting it', async () => {
      const created = await service.create(minimal);

      await service.delete(created.id);

      // The cascade reaches the events and takes their rows without touching
      // the volume, so the paths have to be collected while the rows can still
      // say them (E9).
      expect(logos.purgedSeries).toEqual([created.id]);
    });
  });
});
