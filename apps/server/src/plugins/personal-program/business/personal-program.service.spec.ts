import { NotFoundException } from '@nestjs/common';
import type {
  PluginProgramItem,
  PluginProgramReads,
} from '../../../app/business/plugin-api';
import { PersonalProgramService } from './personal-program.service';
import {
  UnknownProgramItemError,
  type PlanRepository,
} from './ports/plan.repository';

/**
 * The personal programme (FR 3.17) — AP 9 of phase 4.
 *
 * The rules that live in a statement are deliberately **not** asserted here:
 * that a second `PUT` leaves one row (the repository's `ON CONFLICT DO
 * NOTHING`) and that a deleted account takes its plan with it (the cascade). A
 * fake could only prove that the fake obeys them; they are decided against the
 * real database in `apps/server-e2e/src/api/plugin-personal-program.spec.ts`.
 *
 * What this level can decide is what the service is responsible for: that the
 * whole programme travels with a mark rather than only the selection, that the
 * language reaches the port, that one screen costs two reads, that a session
 * nobody has is a 404 in both places it can go missing, and — the one every
 * other assertion is in service of — that **nothing here books a seat** (E55).
 */
const EVENT = '11111111-1111-4111-8111-111111111111';
const ME = '22222222-2222-4222-8222-222222222222';
const SOMEBODY_ELSE = '33333333-3333-4333-8333-333333333333';

class FakePlanRepository implements PlanRepository {
  /** `userId` → the sessions in that person's plan. */
  readonly plans = new Map<string, Set<string>>();
  readonly selectCalls: { userId: string; ids: readonly string[] }[] = [];
  /** Set to make `add` fail the way a session deleted mid-request does. */
  vanishedItem = false;

  async findSelected(
    userId: string,
    programItemIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    this.selectCalls.push({ userId, ids: [...programItemIds] });
    const mine = this.plans.get(userId) ?? new Set<string>();
    return new Set(programItemIds.filter((id) => mine.has(id)));
  }

  async add(
    userId: string,
    programItemId: string,
    addedAt: Date,
  ): Promise<void> {
    if (this.vanishedItem) throw new UnknownProgramItemError(programItemId);
    void addedAt;
    const mine = this.plans.get(userId) ?? new Set<string>();
    mine.add(programItemId);
    this.plans.set(userId, mine);
  }

  async remove(userId: string, programItemId: string): Promise<void> {
    this.plans.get(userId)?.delete(programItemId);
  }
}

class FakeProgramReads implements PluginProgramReads {
  items: PluginProgramItem[] = [];
  readonly listCalls: { eventId: string; locale?: string }[] = [];

  async findItem(itemId: string): Promise<PluginProgramItem | null> {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  async listForEvent(
    eventId: string,
    locale?: string,
  ): Promise<readonly PluginProgramItem[]> {
    this.listCalls.push({ eventId, locale });
    return this.items.filter((item) => item.eventId === eventId);
  }

  async countSignups(
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    void itemIds;
    // Never asked for by this plug-in — how full a session is belongs to the
    // programme, not to a personal plan. Present so the fake is the port.
    return new Map();
  }
}

const session = (
  id: string,
  overrides: Partial<PluginProgramItem> = {},
): PluginProgramItem => ({
  id,
  eventId: EVENT,
  title: `Session ${id}`,
  startsAt: '2026-05-12T09:00:00.000Z',
  endsAt: '2026-05-12T10:30:00.000Z',
  registrationEnabled: false,
  capacity: null,
  ...overrides,
});

describe('PersonalProgramService', () => {
  let plans: FakePlanRepository;
  let program: FakeProgramReads;
  let service: PersonalProgramService;

  beforeEach(() => {
    plans = new FakePlanRepository();
    program = new FakeProgramReads();
    service = new PersonalProgramService(plans, program);
    program.items = [session('a'), session('b'), session('c')];
  });

  describe('reading one event', () => {
    it('answers with the whole programme, not with the selection', async () => {
      plans.plans.set(ME, new Set(['b']));

      const plan = await service.forEvent(EVENT, ME);

      // A plan one can only read is a plan one cannot change: the screen that
      // ticks a session is the screen that shows the ones not yet ticked.
      expect(plan.map((item) => item.programItemId)).toEqual(['a', 'b', 'c']);
      expect(plan.map((item) => item.inPlan)).toEqual([false, true, false]);
    });

    it('marks nothing for somebody who has not chosen anything', async () => {
      plans.plans.set(SOMEBODY_ELSE, new Set(['a', 'b', 'c']));

      const plan = await service.forEvent(EVENT, ME);

      expect(plan.every((item) => !item.inPlan)).toBe(true);
    });

    it('hands the language to the port, so the titles are the reader’s (E56)', async () => {
      await service.forEvent(EVENT, ME, 'de');

      expect(program.listCalls).toEqual([{ eventId: EVENT, locale: 'de' }]);
    });

    it('asks for the originals when nobody named a language', async () => {
      await service.forEvent(EVENT, ME);

      expect(program.listCalls).toEqual([
        { eventId: EVENT, locale: undefined },
      ]);
    });

    it('costs two reads for a screen, whatever the programme’s length', async () => {
      program.items = Array.from({ length: 40 }, (_, index) =>
        session(`s${index}`),
      );

      await service.forEvent(EVENT, ME);

      expect(program.listCalls).toHaveLength(1);
      expect(plans.selectCalls).toHaveLength(1);
      expect(plans.selectCalls[0].ids).toHaveLength(40);
    });

    it('says where a seat is booked without saying how full it is (E55)', async () => {
      program.items = [
        session('a', { registrationEnabled: true, capacity: 30 }),
        session('b', { registrationEnabled: true, capacity: null }),
        session('c'),
      ];

      const plan = await service.forEvent(EVENT, ME);

      // Two shapes of FR 3.10 (F42): a limited sign-up and "as many as come".
      // `capacity` alone could not tell the second from a session that asks
      // nothing, which is why the port carries the flag.
      expect(plan.map((item) => item.registrationEnabled)).toEqual([
        true,
        true,
        false,
      ]);
      expect(plan.map((item) => item.capacity)).toEqual([30, null, null]);
      // Nothing about people travels: no count, no names, no seat of one's own.
      expect(Object.keys(plan[0])).toEqual([
        'programItemId',
        'title',
        'startsAt',
        'endsAt',
        'registrationEnabled',
        'capacity',
        'inPlan',
      ]);
    });

    it('is an empty list for an event that has nothing, not a refusal', async () => {
      const plan = await service.forEvent(
        '44444444-4444-4444-8444-444444444444',
        ME,
      );

      expect(plan).toEqual([]);
      // Nothing to ask about: an empty programme is not a round trip.
      expect(plans.selectCalls[0].ids).toEqual([]);
    });
  });

  describe('putting a session in a plan', () => {
    it('adds it, and adding it twice is still one', async () => {
      await service.add(ME, 'a');
      await service.add(ME, 'a');

      expect([...(plans.plans.get(ME) ?? [])]).toEqual(['a']);
    });

    it('books no seat — there is nothing here that could', async () => {
      program.items = [
        session('a', { registrationEnabled: true, capacity: 1 }),
      ];
      // Two people, one seat, and both may put it in their plan: a plan is a
      // selection, and the seat is taken in the event's programme (E55).
      await service.add(ME, 'a');
      await service.add(SOMEBODY_ELSE, 'a');

      expect([...(plans.plans.get(ME) ?? [])]).toEqual(['a']);
      expect([...(plans.plans.get(SOMEBODY_ELSE) ?? [])]).toEqual(['a']);
    });

    it('refuses a session that does not exist', async () => {
      await expect(service.add(ME, 'nothing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('answers the same 404 when the session vanishes mid-request', async () => {
      // The check above cannot close this race; the foreign key does, and the
      // service translates it into the answer the check would have given.
      plans.vanishedItem = true;

      await expect(service.add(ME, 'a')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('keeps one person’s plan out of another’s', async () => {
      await service.add(ME, 'a');

      expect(plans.plans.get(SOMEBODY_ELSE)).toBeUndefined();
    });
  });

  describe('taking a session out', () => {
    it('removes it', async () => {
      await service.add(ME, 'a');
      await service.remove(ME, 'a');

      expect([...(plans.plans.get(ME) ?? [])]).toEqual([]);
    });

    it('is content with a session that was never in the plan', async () => {
      // The caller asked for a state, and that state is what they get: a retry
      // after a lost connection must not look like a mistake.
      await expect(service.remove(ME, 'a')).resolves.toBeUndefined();
    });

    it('does not ask whether the session exists at all', async () => {
      await expect(service.remove(ME, 'nothing')).resolves.toBeUndefined();
    });
  });
});
