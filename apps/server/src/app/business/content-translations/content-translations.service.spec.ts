import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  EventSeries,
  EventSeriesTranslation,
  EventTranslation,
  OrganizerEvent,
  ProgramItem,
  ProgramItemTranslation,
} from '@trefaro/shared-models';
import type {
  ContentTranslationRecord,
  ContentTranslationRepository,
} from '../common/ports/content-translation.port';
import type { EventSeriesService } from '../event-series/event-series.service';
import type { EventsService } from '../events';
import type { ProgramService } from '../program/program.service';
import { ContentTranslationsService } from './content-translations.service';

/**
 * One table's worth of translations, in memory.
 *
 * Generic like the port it stands for: the three tables differ in what they
 * hold, not in what is done to them, and three fakes would be three chances to
 * disagree with each other.
 */
class FakeTranslations<T> implements ContentTranslationRepository<T> {
  readonly rows = new Map<string, Map<string, T>>();

  async findForParents(
    parentIds: readonly string[],
    locale: string,
  ): Promise<ReadonlyMap<string, T>> {
    const found = new Map<string, T>();
    for (const id of parentIds) {
      const value = this.rows.get(id)?.get(locale);
      if (value !== undefined) found.set(id, value);
    }
    return found;
  }

  async findAllForParent(
    parentId: string,
  ): Promise<readonly ContentTranslationRecord<T>[]> {
    return [...(this.rows.get(parentId) ?? new Map<string, T>())]
      .map(([locale, value]) => ({ locale, value }))
      .sort((left, right) => left.locale.localeCompare(right.locale));
  }

  async findAllForParents(
    parentIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ContentTranslationRecord<T>[]>> {
    const found = new Map<string, readonly ContentTranslationRecord<T>[]>();
    for (const id of parentIds) found.set(id, await this.findAllForParent(id));
    return found;
  }

  async save(parentId: string, locale: string, value: T): Promise<void> {
    const byLocale = this.rows.get(parentId) ?? new Map<string, T>();
    byLocale.set(locale, value);
    this.rows.set(parentId, byLocale);
  }

  async remove(parentId: string, locale: string): Promise<boolean> {
    return this.rows.get(parentId)?.delete(locale) ?? false;
  }
}

const SERIES = {
  id: 'series-1',
  name: 'Climate Conference 2027',
  description: 'Three days on citizen participation.',
} as EventSeries;

const EVENT = {
  id: 'event-1',
  name: 'Kickoff in Cologne',
  description: 'The opening weekend.',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: 'Kalker Hauptstraße 247',
  followUpBody: 'Thank you for coming.',
  timezone: 'Europe/Berlin',
} as OrganizerEvent;

const KEYNOTE = {
  id: 'item-1',
  title: 'Keynote',
  description: 'How a citizens’ assembly works.',
  startsAt: '2027-06-14T07:00:00.000Z',
} as ProgramItem;

describe('ContentTranslationsService', () => {
  let seriesRows: FakeTranslations<EventSeriesTranslation>;
  let eventRows: FakeTranslations<EventTranslation>;
  let itemRows: FakeTranslations<ProgramItemTranslation>;
  let service: ContentTranslationsService;

  const found = <T extends { id: string }>(thing: T) =>
    jest.fn(async (id: string) => {
      if (id !== thing.id) throw new NotFoundException();
      return thing;
    });

  beforeEach(() => {
    seriesRows = new FakeTranslations();
    eventRows = new FakeTranslations();
    itemRows = new FakeTranslations();

    service = new ContentTranslationsService(
      { getForOrganizer: found(SERIES) } as unknown as EventSeriesService,
      { getForOrganizer: found(EVENT) } as unknown as EventsService,
      {
        getForOrganizer: found(KEYNOTE),
        listForOrganizer: jest.fn(async () => [KEYNOTE]),
      } as unknown as ProgramService,
      seriesRows,
      eventRows,
      itemRows,
    );
  });

  describe('reading a screen', () => {
    it('answers with the original beside every language it has', async () => {
      await service.writeSeries(SERIES.id, 'de', {
        name: 'Klimakonferenz 2027',
      });

      const screen = await service.forSeries(SERIES.id);

      expect(screen.source.name).toBe('Climate Conference 2027');
      expect(screen.translations['de'].name).toBe('Klimakonferenz 2027');
      // Field by field, so an untranslated description is `null` here and the
      // original on the page.
      expect(screen.translations['de'].description).toBeNull();
    });

    it('names no language that has no translation', async () => {
      expect((await service.forSeries(SERIES.id)).translations).toEqual({});
    });

    it('brings the event and its programme back in one answer (F49)', async () => {
      await service.writeEvent(EVENT.id, 'de', { name: 'Auftakt in Köln' });
      await service.writeProgramItem(KEYNOTE.id, 'de', {
        title: 'Eröffnungsvortrag',
      });

      const screen = await service.forEvent(EVENT.id);

      expect(screen.timezone).toBe('Europe/Berlin');
      expect(screen.translations['de'].name).toBe('Auftakt in Köln');
      expect(screen.programItems).toHaveLength(1);
      expect(screen.programItems[0].source.title).toBe('Keynote');
      expect(screen.programItems[0].translations['de'].title).toBe(
        'Eröffnungsvortrag',
      );
      // The time comes along so a translator can tell two sessions of one name
      // apart.
      expect(screen.programItems[0].startsAt).toBe(KEYNOTE.startsAt);
    });

    it('says 404 for a parent that does not exist', async () => {
      await expect(service.forSeries('nope')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.forEvent('nope')).rejects.toThrow(NotFoundException);
      await expect(service.forProgramItem('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('writing', () => {
    it('trims, and stores a blank field as “no translation”', async () => {
      const written = await service.writeSeries(SERIES.id, 'de', {
        name: '  Klimakonferenz 2027  ',
        description: '   ',
      });

      expect(written).toEqual({
        name: 'Klimakonferenz 2027',
        description: null,
      });
    });

    it('deletes the row when nothing is left in it (F74 applied)', async () => {
      await service.writeSeries(SERIES.id, 'de', { name: 'Klimakonferenz' });
      expect(
        (await service.forSeries(SERIES.id)).translations['de'],
      ).toBeDefined();

      await service.writeSeries(SERIES.id, 'de', { name: '' });

      // Not an empty row: a language that says nothing would still be counted
      // as translated by everything that counts rows.
      expect(
        (await service.forSeries(SERIES.id)).translations['de'],
      ).toBeUndefined();
    });

    it('replaces rather than merges — a cleared box has to be expressible', async () => {
      await service.writeEvent(EVENT.id, 'de', {
        name: 'Auftakt in Köln',
        description: 'Das Eröffnungswochenende.',
      });

      await service.writeEvent(EVENT.id, 'de', { name: 'Auftakt in Köln' });

      expect((await service.forEvent(EVENT.id)).translations['de']).toEqual({
        name: 'Auftakt in Köln',
        description: null,
        venueName: null,
        followUpBody: null,
      });
    });

    it('accepts a language the instance does not offer (E30)', async () => {
      // A language is created by translating it. Requiring it to be on offer
      // first would mean showing visitors a language before its first word.
      await service.writeSeries(SERIES.id, 'fr', { name: 'Conférence 2027' });

      expect((await service.forSeries(SERIES.id)).translations['fr']).toEqual({
        name: 'Conférence 2027',
        description: null,
      });
    });

    it('reads de-AT and de-at as one language', async () => {
      await service.writeSeries(SERIES.id, 'de-AT', { name: 'Klimakonferenz' });
      await service.writeSeries(SERIES.id, 'de-at', {
        name: 'Klimakonferenz!',
      });

      const { translations } = await service.forSeries(SERIES.id);

      expect(Object.keys(translations)).toEqual(['de-at']);
      expect(translations['de-at'].name).toBe('Klimakonferenz!');
    });

    it('refuses something that is not a language tag', async () => {
      await expect(
        service.writeSeries(SERIES.id, 'de_DE', { name: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('says 404 for a parent that does not exist, before writing anything', async () => {
      await expect(
        service.writeProgramItem('nope', 'de', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(itemRows.rows.size).toBe(0);
    });
  });

  describe('removing', () => {
    it('takes one language away and leaves the others', async () => {
      await service.writeEvent(EVENT.id, 'de', { name: 'Auftakt in Köln' });
      await service.writeEvent(EVENT.id, 'fr', { name: 'Lancement à Cologne' });

      await service.removeEvent(EVENT.id, 'de');

      expect(
        Object.keys((await service.forEvent(EVENT.id)).translations),
      ).toEqual(['fr']);
    });

    it('is not an error when there was nothing to remove', async () => {
      await expect(
        service.removeProgramItem(KEYNOTE.id, 'de'),
      ).resolves.toBeUndefined();
    });

    it('says 404 for a parent that does not exist', async () => {
      await expect(service.removeSeries('nope', 'de')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
