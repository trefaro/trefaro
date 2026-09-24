import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PersonalProgramItem } from '@trefaro/shared-models';
import {
  PLUGIN_PROGRAM_READS,
  type PluginProgramItem,
  type PluginProgramReads,
} from '../../../app/business/plugin-api';
import {
  PLAN_REPOSITORY,
  UnknownProgramItemError,
  type PlanRepository,
} from './ports/plan.repository';

/**
 * The personal programme, as business logic (FR 3.17).
 *
 * Three operations and no fourth: read one event's programme with the reader's
 * marks on it, put a session in, take it out. Everything about a *session* —
 * that it exists, what it is called, when it runs, whether a seat is booked for
 * it — arrives through the host's versioned port (E12); this plug-in owns only
 * the pairs of "who" and "which".
 *
 * **A selection is not a sign-up** (E55, F201). Nothing in this file reserves
 * anything, compares anything against a capacity, or refuses because a session
 * is full — there is no capacity in its own table to compare against. Seats are
 * booked by FR 3.10, in the event's programme, and the one thing this service
 * does about that is pass `registrationEnabled` on, so a row can say where the
 * booking happens. Two lists both called "my sessions" is the failure this
 * whole decision exists to avoid; the one that reserves nothing has to say so.
 *
 * **The whole programme travels, not the selection.** A plan one can only read
 * is a plan one cannot change: the screen that ticks a session is the screen
 * that shows the ones not yet ticked, and one request draws it (F49).
 */
@Injectable()
export class PersonalProgramService {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plan: PlanRepository,
    // The host's read port (E12). The only way this plug-in learns that a
    // programme exists — no ORM import, no core entity, no `program_item`.
    @Inject(PLUGIN_PROGRAM_READS)
    private readonly program: PluginProgramReads,
  ) {}

  /**
   * One event's programme with `inPlan` on every session (E56).
   *
   * The language goes to the port, which translates and falls back field by
   * field (F95) — a participant reads their plan, so the titles are theirs.
   * An unknown event is an empty programme rather than a 404: the port answers
   * that way, and a plug-in that invented the 404 would be answering about an
   * event it has no port to ask about.
   */
  async forEvent(
    eventId: string,
    userId: string,
    locale?: string,
  ): Promise<readonly PersonalProgramItem[]> {
    const items = await this.program.listForEvent(eventId, locale);
    const selected = await this.plan.findSelected(
      userId,
      items.map((item) => item.id),
    );
    return items.map((item) => toPayload(item, selected.has(item.id)));
  }

  /**
   * Puts a session in this person's plan (E55).
   *
   * Idempotent: doing it twice leaves one row, with the time of the first. The
   * existence check is the port's — a 404 for a session that is not there is a
   * better answer than a foreign key violation — and the same 404 comes out of
   * the write when a session is deleted between the two, which is the race the
   * check alone cannot close.
   */
  async add(userId: string, programItemId: string): Promise<void> {
    const item = await this.program.findItem(programItemId);
    if (!item) throw noSuchItem(programItemId);

    try {
      await this.plan.add(userId, programItemId, new Date());
    } catch (error: unknown) {
      if (!(error instanceof UnknownProgramItemError)) throw error;
      throw noSuchItem(programItemId);
    }
  }

  /**
   * Takes it out again.
   *
   * No check of any kind, and no 404 for a session that is not in the plan:
   * the caller asked for a state, and that state is what they get. A route
   * that answered differently the second time would make a retry after a lost
   * connection look like a mistake.
   */
  remove(userId: string, programItemId: string): Promise<void> {
    return this.plan.remove(userId, programItemId);
  }
}

function noSuchItem(programItemId: string): NotFoundException {
  return new NotFoundException(
    `No programme item with id ${programItemId}. A plan holds sessions that exist.`,
  );
}

/**
 * Picked field by field rather than spread, for the reason the host's adapter
 * has it: what the payload does not name must not travel. The sign-up **count**
 * is the one the port would hand over and this does not — how full a workshop
 * is belongs to the programme and to the organizer's plan (E50), and a personal
 * plan that showed it would be a second occupancy screen.
 */
function toPayload(
  item: PluginProgramItem,
  inPlan: boolean,
): PersonalProgramItem {
  return {
    programItemId: item.id,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    // The event's clock, straight from the port (E69): a plan is a selection
    // from the programme, and a selection that disagreed with the programme
    // about the hour would be a second timetable.
    timezone: item.timezone,
    registrationEnabled: item.registrationEnabled,
    capacity: item.capacity,
    inPlan,
  };
}
