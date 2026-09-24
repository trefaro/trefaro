import type { ProgramItemTranslation } from '@trefaro/shared-models';
import type { EventZones } from '../common/ports/event-zone.port';
import type { ProgramItemSignupRepository } from './ports/program-item-signup.repository';
import type { ProgramItemTranslationReader } from './ports/program-item-translation.repository';
import type {
  ProgramItemRecord,
  ProgramItemRepository,
} from './ports/program-item.repository';
import { ProgramPluginReads } from './program-plugin-reads';

const EVENT = '11111111-1111-4111-8111-111111111111';

function record(over: Partial<ProgramItemRecord> = {}): ProgramItemRecord {
  return {
    id: 'item-1',
    eventId: EVENT,
    title: 'Opening plenary',
    description: null,
    speaker: null,
    startsAt: new Date('2027-06-14T09:00:00.000Z'),
    endsAt: new Date('2027-06-14T10:00:00.000Z'),
    registrationEnabled: true,
    capacity: 40,
    createdAt: new Date('2027-01-01T00:00:00.000Z'),
    updatedAt: new Date('2027-01-01T00:00:00.000Z'),
    ...over,
  };
}

class FakeItems implements Pick<
  ProgramItemRepository,
  'findById' | 'findByEvent'
> {
  rows: ProgramItemRecord[] = [];
  async findById(id: string): Promise<ProgramItemRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  async findByEvent(eventId: string): Promise<readonly ProgramItemRecord[]> {
    return this.rows.filter((row) => row.eventId === eventId);
  }
}

class FakeSignups implements Pick<ProgramItemSignupRepository, 'countByItems'> {
  async countByItems(): Promise<ReadonlyMap<string, number>> {
    return new Map();
  }
}

/** One event, one zone — and a record of how often it was asked (F49). */
class FakeZones implements EventZones {
  zones = new Map<string, string>([[EVENT, 'Europe/Berlin']]);
  asked: string[] = [];

  async zoneOf(eventId: string): Promise<string | null> {
    this.asked.push(eventId);
    return this.zones.get(eventId) ?? null;
  }
}

/**
 * The translation reader as the adapter uses it: one method, and the test
 * records what it was asked so the locale can be seen travelling.
 */
class FakeTranslations implements Pick<
  ProgramItemTranslationReader,
  'findForParents'
> {
  /** `"<item id>:<locale>"` → the row somebody wrote. */
  rows = new Map<string, ProgramItemTranslation>();
  asked: { ids: readonly string[]; locale: string }[] = [];

  async findForParents(
    ids: readonly string[],
    locale: string,
  ): Promise<ReadonlyMap<string, ProgramItemTranslation>> {
    this.asked.push({ ids, locale });
    return new Map(
      ids
        .filter((id) => this.rows.has(`${id}:${locale}`))
        .map((id) => [
          id,
          this.rows.get(`${id}:${locale}`) as ProgramItemTranslation,
        ]),
    );
  }
}

/**
 * The core's side of the programme read port (E12, E56).
 *
 * What is worth testing about an adapter is the translation between two
 * shapes: that a plug-in gets exactly the fields the contract promises, that
 * the language a participant asked in reaches the programme service, and that
 * an organizer's plan — asking in no language — gets the originals.
 */
describe('ProgramPluginReads', () => {
  let items: FakeItems;
  let translations: FakeTranslations;
  let zones: FakeZones;
  let reads: ProgramPluginReads;

  beforeEach(() => {
    items = new FakeItems();
    translations = new FakeTranslations();
    zones = new FakeZones();
    reads = new ProgramPluginReads(
      items as unknown as ProgramItemRepository,
      new FakeSignups() as unknown as ProgramItemSignupRepository,
      translations as unknown as ProgramItemTranslationReader,
      zones,
    );
  });

  it('hands over the sessions of one event with their titles, in the order the programme has them (E56)', async () => {
    items.rows.push(
      record({ description: 'Where we stand.', speaker: 'Dr. Nwosu' }),
      record({
        id: 'item-2',
        title: 'Workshop: door-to-door',
        startsAt: new Date('2027-06-14T11:00:00.000Z'),
        endsAt: new Date('2027-06-14T12:30:00.000Z'),
        registrationEnabled: false,
        capacity: null,
      }),
      record({ id: 'item-elsewhere', eventId: 'other-event' }),
    );

    const sessions = await reads.listForEvent(EVENT);

    // The five fields of F45, the title E56 added and the sign-up flag AP 9
    // needed (E55) — and nothing else of the record: no abstract, no speaker,
    // no timestamps of the row, and above all no count of people, which a
    // plug-in asks for separately.
    expect(sessions).toEqual([
      {
        id: 'item-1',
        eventId: EVENT,
        title: 'Opening plenary',
        startsAt: '2027-06-14T09:00:00.000Z',
        endsAt: '2027-06-14T10:00:00.000Z',
        timezone: 'Europe/Berlin',
        registrationEnabled: true,
        capacity: 40,
      },
      {
        id: 'item-2',
        eventId: EVENT,
        title: 'Workshop: door-to-door',
        startsAt: '2027-06-14T11:00:00.000Z',
        endsAt: '2027-06-14T12:30:00.000Z',
        timezone: 'Europe/Berlin',
        registrationEnabled: false,
        capacity: null,
      },
    ]);
  });

  it("reads the titles in the reader's language, and the original where nobody translated (F95)", async () => {
    items.rows.push(record(), record({ id: 'item-2', title: 'Panel' }));
    translations.rows.set('item-1:de', {
      title: 'Eröffnungsplenum',
      description: null,
    });

    const sessions = await reads.listForEvent(EVENT, 'de');

    expect(sessions.map((session) => session.title)).toEqual([
      'Eröffnungsplenum',
      'Panel',
    ]);
    // One question for the whole list, never one per session (F49).
    expect(translations.asked).toEqual([
      { ids: ['item-1', 'item-2'], locale: 'de' },
    ]);
  });

  it("asks nobody when no language is asked for — the organizer's plan reads the originals", async () => {
    items.rows.push(record());
    translations.rows.set('item-1:de', {
      title: 'Eröffnungsplenum',
      description: null,
    });

    const sessions = await reads.listForEvent(EVENT);

    expect(sessions[0].title).toBe('Opening plenary');
    expect(translations.asked).toEqual([]);
  });

  it('carries the original title on a single session too', async () => {
    items.rows.push(record());

    expect(await reads.findItem('item-1')).toEqual({
      id: 'item-1',
      eventId: EVENT,
      title: 'Opening plenary',
      startsAt: '2027-06-14T09:00:00.000Z',
      endsAt: '2027-06-14T10:00:00.000Z',
      timezone: 'Europe/Berlin',
      registrationEnabled: true,
      capacity: 40,
    });
  });

  it('keeps answering null for a session nobody has', async () => {
    expect(await reads.findItem('item-nope')).toBeNull();
  });

  it("stamps the event's zone on every session, asking once for the list (E69)", async () => {
    items.rows.push(
      record(),
      record({ id: 'item-2' }),
      record({ id: 'item-3' }),
    );

    const sessions = await reads.listForEvent(EVENT);

    expect(sessions.map((session) => session.timezone)).toEqual([
      'Europe/Berlin',
      'Europe/Berlin',
      'Europe/Berlin',
    ]);
    // One question for the whole list, like the translations above (F49).
    expect(zones.asked).toEqual([EVENT]);
  });

  it('answers with the zone each event is read in, not with one for all of them', async () => {
    const other = '22222222-2222-4222-8222-222222222222';
    zones.zones.set(other, 'America/Toronto');
    items.rows.push(record(), record({ id: 'item-abroad', eventId: other }));

    expect((await reads.listForEvent(EVENT))[0].timezone).toBe('Europe/Berlin');
    expect((await reads.listForEvent(other))[0].timezone).toBe(
      'America/Toronto',
    );
  });

  it('hands over nothing rather than a session without its zone', async () => {
    // Only reachable in the moment between two reads — an event's deletion
    // takes its programme with it. Inventing UTC here would be a clock nobody
    // chose, drawn beside a title that is about to disappear.
    items.rows.push(record({ id: 'item-ghost', eventId: 'gone' }));

    expect(await reads.listForEvent('gone')).toEqual([]);
    expect(await reads.findItem('item-ghost')).toBeNull();
  });
});
