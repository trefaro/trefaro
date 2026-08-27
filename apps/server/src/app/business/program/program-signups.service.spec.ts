import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProgramSignupsService } from './program-signups.service';
import type {
  ProgramItemParticipant,
  ProgramItemSignupRecord,
  ProgramItemSignupRepository,
  SignUpOutcome,
  SignUpRequest,
} from './ports/program-item-signup.repository';
import type {
  NewProgramItem,
  ProgramItemChanges,
  ProgramItemRecord,
  ProgramItemRepository,
} from './ports/program-item.repository';

/**
 * Per-item sign-up (FR 3.10) — the rules of AP 9.
 *
 * The acceptance criterion of the work package is the first block: a full
 * session takes no further sign-up. The rest is what keeps that rule from
 * turning into a trap — giving up a seat always works, and both directions
 * survive a double click.
 *
 * The capacity race itself is not asserted here. It cannot be: it is decided by
 * a lock in one statement, and a fake repository would only prove that the fake
 * counts. `apps/server-e2e` exercises it against the real database.
 */
const EVENT = 'event-1';
const OTHER_EVENT = 'event-2';
const ACTOR = { registrationId: 'registration-1', eventId: EVENT };

class FakeItemRepository implements ProgramItemRepository {
  readonly rows: ProgramItemRecord[] = [];

  add(overrides: Partial<ProgramItemRecord> = {}): ProgramItemRecord {
    const row: ProgramItemRecord = {
      id: `item-${this.rows.length + 1}`,
      eventId: EVENT,
      title: 'Workshop',
      description: null,
      speaker: null,
      // Comfortably in the future, so "has it happened yet" is a decision each
      // test makes rather than a property of the clock it runs on.
      startsAt: new Date('2099-06-14T07:00:00.000Z'),
      endsAt: new Date('2099-06-14T09:00:00.000Z'),
      registrationEnabled: true,
      capacity: null,
      createdAt: new Date('2026-08-27T09:00:00.000Z'),
      updatedAt: new Date('2026-08-27T09:00:00.000Z'),
      ...overrides,
    };
    this.rows.push(row);
    return row;
  }

  async findByEvent(eventId: string): Promise<readonly ProgramItemRecord[]> {
    return this.rows.filter((row) => row.eventId === eventId);
  }

  async findById(id: string): Promise<ProgramItemRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(item: NewProgramItem): Promise<ProgramItemRecord> {
    return this.add(item);
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

class FakeSignupRepository implements ProgramItemSignupRepository {
  rows: ProgramItemSignupRecord[] = [];
  /** Names to hand back from {@link findParticipants}, keyed by registration. */
  people = new Map<
    string,
    { firstName: string; lastName: string; email: string }
  >();

  async findByRegistration(
    registrationId: string,
  ): Promise<readonly ProgramItemSignupRecord[]> {
    return this.rows.filter((row) => row.registrationId === registrationId);
  }

  async countByItems(
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();
    for (const row of this.rows) {
      if (!itemIds.includes(row.programItemId)) continue;
      counts.set(row.programItemId, (counts.get(row.programItemId) ?? 0) + 1);
    }
    return counts;
  }

  async signUp(request: SignUpRequest): Promise<SignUpOutcome> {
    const mine = this.rows.some(
      (row) =>
        row.programItemId === request.programItemId &&
        row.registrationId === request.registrationId,
    );
    if (mine) return 'already-signed-up';

    const taken = this.rows.filter(
      (row) => row.programItemId === request.programItemId,
    ).length;
    if (request.capacity !== null && taken >= request.capacity) return 'full';

    this.rows.push({
      programItemId: request.programItemId,
      registrationId: request.registrationId,
      createdAt: new Date(2026, 7, 27, 9, this.rows.length),
    });
    return 'created';
  }

  async signOff(
    programItemId: string,
    registrationId: string,
  ): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (row) =>
        !(
          row.programItemId === programItemId &&
          row.registrationId === registrationId
        ),
    );
    return this.rows.length < before;
  }

  async findParticipants(
    programItemId: string,
  ): Promise<readonly ProgramItemParticipant[]> {
    return this.rows
      .filter((row) => row.programItemId === programItemId)
      .map((row) => ({
        registrationId: row.registrationId,
        firstName: this.people.get(row.registrationId)?.firstName ?? 'Amina',
        lastName: this.people.get(row.registrationId)?.lastName ?? 'Okonkwo',
        email:
          this.people.get(row.registrationId)?.email ?? 'amina@example.org',
        signedUpAt: row.createdAt,
      }));
  }
}

describe('ProgramSignupsService', () => {
  let items: FakeItemRepository;
  let signups: FakeSignupRepository;
  let service: ProgramSignupsService;

  beforeEach(() => {
    items = new FakeItemRepository();
    signups = new FakeSignupRepository();
    service = new ProgramSignupsService(items, signups);
  });

  describe('signUp', () => {
    it('claims a seat in a session that asks for one', async () => {
      const item = items.add();

      await service.signUp(item.id, ACTOR);

      expect(signups.rows).toHaveLength(1);
    });

    it('refuses a further sign-up once the seats are gone', async () => {
      // The acceptance criterion of AP 9.
      const item = items.add({ capacity: 1 });
      await service.signUp(item.id, ACTOR);

      await expect(
        service.signUp(item.id, {
          registrationId: 'registration-2',
          eventId: EVENT,
        }),
      ).rejects.toThrow(ConflictException);
      expect(signups.rows).toHaveLength(1);
    });

    it('tells somebody who already has a seat in a full session so', async () => {
      const item = items.add({ capacity: 1 });
      await service.signUp(item.id, ACTOR);

      // Not "full": they are in. A second click must not read as a rejection.
      await expect(service.signUp(item.id, ACTOR)).resolves.toBeUndefined();
      expect(signups.rows).toHaveLength(1);
    });

    it('takes as many as come where no capacity is set', async () => {
      const item = items.add({ capacity: null });

      for (const registrationId of ['a', 'b', 'c']) {
        await service.signUp(item.id, { registrationId, eventId: EVENT });
      }

      expect(signups.rows).toHaveLength(3);
    });

    it('refuses a session that does not ask for sign-up', async () => {
      const item = items.add({ registrationEnabled: false });

      await expect(service.signUp(item.id, ACTOR)).rejects.toThrow(
        /does not ask for sign-up/,
      );
    });

    it('refuses a session that has already taken place', async () => {
      const item = items.add({
        startsAt: new Date('2020-01-01T09:00:00.000Z'),
        endsAt: new Date('2020-01-01T10:00:00.000Z'),
      });

      await expect(service.signUp(item.id, ACTOR)).rejects.toThrow(
        /already taken place/,
      );
    });

    it('answers a session of another event as absent, not as forbidden', async () => {
      // A link that reached the wrong inbox must not be able to enumerate other
      // events' programmes, so an id from elsewhere reads like one that never
      // existed.
      const elsewhere = items.add({ eventId: OTHER_EVENT });

      await expect(service.signUp(elsewhere.id, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is a 404 for a session that does not exist', async () => {
      await expect(service.signUp('item-nope', ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('signOff', () => {
    it('gives up a seat', async () => {
      const item = items.add();
      await service.signUp(item.id, ACTOR);

      await service.signOff(item.id, ACTOR);

      expect(signups.rows).toHaveLength(0);
    });

    it('works in a session whose sign-up was switched off again', async () => {
      const item = items.add();
      await service.signUp(item.id, ACTOR);
      await items.update(item.id, { registrationEnabled: false });

      // A rule that traps people in a list makes the list wrong.
      await expect(service.signOff(item.id, ACTOR)).resolves.toBeUndefined();
      expect(signups.rows).toHaveLength(0);
    });

    it('works after the session has started', async () => {
      const item = items.add({
        startsAt: new Date('2020-01-01T09:00:00.000Z'),
        endsAt: new Date('2020-01-01T10:00:00.000Z'),
      });
      signups.rows.push({
        programItemId: item.id,
        registrationId: ACTOR.registrationId,
        createdAt: new Date('2019-12-01T09:00:00.000Z'),
      });

      await service.signOff(item.id, ACTOR);

      expect(signups.rows).toHaveLength(0);
    });

    it('says nothing when there was no seat to give up', async () => {
      const item = items.add();

      await expect(service.signOff(item.id, ACTOR)).resolves.toBeUndefined();
    });
  });

  describe('seatsOf', () => {
    it('names the sessions one registration holds a seat in', async () => {
      const first = items.add();
      const second = items.add();
      items.add();
      await service.signUp(first.id, ACTOR);
      await service.signUp(second.id, ACTOR);

      const seats = await service.seatsOf(ACTOR.registrationId);

      expect([...seats].sort()).toEqual([first.id, second.id]);
    });

    it('does not mix in somebody else’s seats', async () => {
      const item = items.add();
      await service.signUp(item.id, {
        registrationId: 'registration-2',
        eventId: EVENT,
      });

      expect(await service.seatsOf(ACTOR.registrationId)).toEqual(new Set());
    });
  });

  describe('load', () => {
    it('reports the take-up with the addresses in the list', async () => {
      const item = items.add({ capacity: 12 });
      signups.people.set('registration-1', {
        firstName: 'Amina',
        lastName: 'Okonkwo',
        email: 'amina@example.org',
      });
      await service.signUp(item.id, ACTOR);

      const load = await service.load(item.id);

      expect(load).toMatchObject({
        itemId: item.id,
        title: 'Workshop',
        capacity: 12,
        signupCount: 1,
      });
      // The single correction the usability test of the thesis produced.
      expect(load.participants[0].email).toBe('amina@example.org');
    });

    it('answers for a session whose sign-up was switched off', async () => {
      const item = items.add();
      await service.signUp(item.id, ACTOR);
      await items.update(item.id, { registrationEnabled: false });

      const load = await service.load(item.id);

      // The seats people took while it was on are still theirs; hiding them
      // would make the list wrong rather than shorter.
      expect(load.registrationEnabled).toBe(false);
      expect(load.signupCount).toBe(1);
    });

    it('is a 404 for a session that does not exist', async () => {
      await expect(service.load('item-nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
