import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  OrganizerEvent,
  ProgramItem,
  ProgramItemChange,
  ProgramItemInput,
  PublicEvent,
  PublicProgramItem,
} from '@trefaro/shared-models';
import {
  MAX_PROGRAM_ITEMS,
  MAX_PROGRAM_ITEM_CAPACITY,
  formatEventPeriod,
} from '@trefaro/shared-models';
import { EventsService } from '../events';
import {
  PROGRAM_ITEM_SIGNUP_REPOSITORY,
  type ProgramItemSignupRepository,
} from './ports/program-item-signup.repository';
import {
  PROGRAM_ITEM_REPOSITORY,
  type NewProgramItem,
  type ProgramItemChanges,
  type ProgramItemRecord,
  type ProgramItemRepository,
} from './ports/program-item.repository';

/** Said the same way wherever a programme item cannot be found any more. */
const GONE = 'This programme item no longer exists.';

/**
 * The programme of an event (FR 3.7, FR 3.6, UC 11).
 *
 * The programme is part of what FR 3.6 calls the information a participant needs
 * — the highest-rated participant feature of the survey (3,74) — so it is read
 * without a login, through the event's public address, and written only by an
 * organizer.
 *
 * Three rules, and the reasons they are the way round they are:
 *
 * 1. **An item has to fit inside its event.** A session at 22:00 on a day the
 *    conference is not running cannot be rendered on any timeline the event has;
 *    it is not a bold choice, it is a typo in a date field. Refused with 400.
 * 2. **Overlaps are accepted** (F41). Two sessions at the same time are what a
 *    two-track conference *is*. Only a person can tell a parallel track from a
 *    clash, so the organizer's view marks them and this service does not refuse
 *    them.
 * 3. **The period is only re-checked when it is being changed.** Shifting an
 *    event by a day leaves its programme behind outside the new period — and
 *    refusing that shift would be a dead end, since the way out of it is to
 *    move the items. So an item already outside stays editable; a period that is
 *    being *set* has to land inside.
 * 4. **A capacity needs sign-up** (AP 9). Setting one without switching sign-up
 *    on is refused rather than ignored, and switching sign-up off drops the
 *    limit — a number that nothing enforces is worse than no number, because it
 *    reads like one that is enforced. The sign-ups themselves survive both:
 *    turning the flag off closes the session for new seats and leaves the people
 *    who already have one (and their way of giving it up).
 *
 * Every list carries the seat counts, fetched in one query for the whole
 * programme. Cheap enough to be unconditional, and the alternative — a second
 * request the participant client would have to make — is how a landing page ends
 * up rendering a programme without its "full" markers.
 */
@Injectable()
export class ProgramService {
  constructor(
    @Inject(PROGRAM_ITEM_REPOSITORY)
    private readonly items: ProgramItemRepository,
    // Counts only. Who signed up is the sign-up service's business; a list of
    // sessions never needs a participant row (FR 3.10).
    @Inject(PROGRAM_ITEM_SIGNUP_REPOSITORY)
    private readonly signups: ProgramItemSignupRepository,
    private readonly events: EventsService,
  ) {}

  /** One event's programme as the organizer manages it (FR 3.7). */
  async listForOrganizer(eventId: string): Promise<readonly ProgramItem[]> {
    // Resolving the event first turns an unknown id into a 404 rather than an
    // empty list, which would read as "this event has no programme".
    await this.events.getForOrganizer(eventId);
    const items = await this.items.findByEvent(eventId);
    const counts = await this.countsFor(items);
    return items.map((item) => toProgramItem(item, counts));
  }

  /**
   * One session as the organizer sees it.
   *
   * For callers that need to know what a session belongs to before writing
   * something against it — the media links of AP 11 attach to a session and have
   * to establish that it is a session of *their* event. Through this service
   * rather than through the repository port, so the 404 for a session that is
   * gone is worded in one place.
   */
  async getForOrganizer(id: string): Promise<ProgramItem> {
    const item = await this.require(id);
    return toProgramItem(item, await this.countsFor([item]));
  }

  /**
   * The programme a participant reads on the landing page (FR 3.6).
   *
   * Through the public event lookup, so the programme of a draft event — or of
   * an event in a series nobody can see — is not readable either.
   */
  async listPublic(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<readonly PublicProgramItem[]> {
    const event = await this.events.getPublic(seriesSlug, eventSlug);
    const items = await this.items.findByEvent(event.id);
    const counts = await this.countsFor(items);
    return items.map((item) => toPublicProgramItem(item, counts));
  }

  /**
   * The programme of one event, without a visibility check of its own.
   *
   * For flows a signed link already authorizes — the participant self-service of
   * E11. Deliberately not through the public lookup: an organizer who unpublishes
   * an event while confirmations are in people's inboxes must not turn a
   * self-service link into an error, exactly as {@link EventsService.locate} does
   * not. The caller has established the right to see this event; what it gets is
   * the participant's shape of the programme, nothing more.
   */
  async listForEvent(eventId: string): Promise<readonly PublicProgramItem[]> {
    const items = await this.items.findByEvent(eventId);
    const counts = await this.countsFor(items);
    return items.map((item) => toPublicProgramItem(item, counts));
  }

  async create(eventId: string, input: ProgramItemInput): Promise<ProgramItem> {
    const event = await this.events.getForOrganizer(eventId);

    const existing = await this.items.findByEvent(eventId);
    if (existing.length >= MAX_PROGRAM_ITEMS) {
      throw new ConflictException(
        `A programme holds at most ${MAX_PROGRAM_ITEMS} items. Remove one ` +
          'before adding another.',
      );
    }

    const period = this.period(input.startsAt, input.endsAt);
    this.assertWithinEvent(event, period);

    const registrationEnabled = input.registrationEnabled ?? false;
    const item: NewProgramItem = {
      eventId,
      title: this.title(input.title),
      description: optional(input.description),
      speaker: optional(input.speaker),
      ...period,
      registrationEnabled,
      capacity: this.capacity(input.capacity ?? null, registrationEnabled),
    };
    // A new session has no sign-ups, so no count query for a known zero.
    return toProgramItem(await this.items.create(item), new Map());
  }

  /**
   * Changes a programme item — anything about it.
   *
   * Nothing is fixed after creation: an item has no key that anything else
   * refers to, so a session that moves an hour and gets a new speaker is one
   * edit rather than a delete and a re-create.
   */
  async update(id: string, change: ProgramItemChange): Promise<ProgramItem> {
    const existing = await this.require(id);

    const period =
      change.startsAt === undefined && change.endsAt === undefined
        ? undefined
        : this.period(
            change.startsAt ?? existing.startsAt.toISOString(),
            change.endsAt ?? existing.endsAt.toISOString(),
          );

    if (period) {
      // Only when the period is part of the change (rule 3 above): an item that
      // an event's own change left outside must stay editable, or an organizer
      // who shifted a conference could no longer fix its programme.
      this.assertWithinEvent(
        await this.events.getForOrganizer(existing.eventId),
        period,
      );
    }

    const updated = await this.items.update(id, {
      ...(change.title === undefined
        ? {}
        : { title: this.title(change.title) }),
      ...(change.description === undefined
        ? {}
        : { description: optional(change.description) }),
      ...(change.speaker === undefined
        ? {}
        : { speaker: optional(change.speaker) }),
      ...(period ?? {}),
      ...this.signupChanges(existing, change),
    });
    if (!updated) throw new NotFoundException(GONE);
    return toProgramItem(updated, await this.countsFor([updated]));
  }

  /**
   * Removes a programme item.
   *
   * No archiving and no confirmation rule of its own (unlike E14 for an event):
   * a programme item is a plan, not somebody's statement of intent. Its
   * sign-ups go with it through the database cascade, and that is the right way
   * round — a workshop that is not happening has no attendees, and refusing to
   * delete a session people signed up for would leave an organizer who cancelled
   * it with no way to say so. What the organizer's view owes them instead is the
   * number: the confirmation names how many seats are about to be released.
   */
  async delete(id: string): Promise<void> {
    if (!(await this.items.delete(id))) throw new NotFoundException(GONE);
  }

  private async require(id: string): Promise<ProgramItemRecord> {
    const found = await this.items.findById(id);
    if (!found) throw new NotFoundException(GONE);
    return found;
  }

  /** Seat counts for a whole programme, in one query. */
  private async countsFor(
    items: readonly ProgramItemRecord[],
  ): Promise<ReadonlyMap<string, number>> {
    return this.signups.countByItems(items.map((item) => item.id));
  }

  /**
   * What a change does to sign-up and capacity.
   *
   * The one rule with a side effect: switching sign-up off drops the limit with
   * it. Leaving a capacity behind would be a limit on a session that does not
   * ask who is coming — which the database refuses outright, and rightly so.
   */
  private signupChanges(
    existing: ProgramItemRecord,
    change: ProgramItemChange,
  ): ProgramItemChanges {
    const enabled = change.registrationEnabled ?? existing.registrationEnabled;
    if (!enabled) {
      // `undefined` would leave the stored capacity in place; `null` is the
      // change that has to be written.
      return change.registrationEnabled === undefined &&
        change.capacity === undefined
        ? {}
        : { registrationEnabled: false, capacity: null };
    }

    const capacity =
      change.capacity === undefined ? existing.capacity : change.capacity;
    return {
      registrationEnabled: true,
      capacity: this.capacity(capacity, true),
    };
  }

  /**
   * A capacity, checked against the flag that gives it meaning.
   *
   * Also checked here and not only in the DTO: the rule is a product decision,
   * and a second entry point — a plug-in, an import — must not be able to write
   * a limit nothing enforces.
   */
  private capacity(
    capacity: number | null,
    registrationEnabled: boolean,
  ): number | null {
    if (capacity === null) return null;
    if (!registrationEnabled) {
      throw new BadRequestException(
        'A capacity only means something where sign-up is switched on. Enable ' +
          'sign-up for this session, or leave the capacity empty.',
      );
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new BadRequestException(
        'A capacity is a whole number of seats, at least one.',
      );
    }
    if (capacity > MAX_PROGRAM_ITEM_CAPACITY) {
      throw new BadRequestException(
        `A capacity of more than ${MAX_PROGRAM_ITEM_CAPACITY} is not a limit ` +
          'anybody meant to set.',
      );
    }
    return capacity;
  }

  /**
   * The acceptance rule of AP 8: an item happens while the event does.
   *
   * The message names the event's period in the event's own zone (E8) — an
   * organizer who typed the wrong day needs to see which day was meant, and a
   * bare "outside the event" leaves them guessing.
   */
  private assertWithinEvent(
    event: OrganizerEvent | PublicEvent,
    period: { startsAt: Date; endsAt: Date },
  ): void {
    const from = Date.parse(event.startsAt);
    const until = Date.parse(event.endsAt);
    if (period.startsAt.getTime() < from || period.endsAt.getTime() > until) {
      throw new BadRequestException(
        'A programme item has to happen while the event does. ' +
          `"${event.name}" runs ${formatEventPeriod(event)}.`,
      );
    }
  }

  /**
   * Start and end of one item.
   *
   * An item has to have a length, unlike an event, which may be booked as a
   * single instant while the details are open: a session of no duration cannot
   * be drawn on a timeline and cannot be attended.
   */
  private period(
    startsAt: string,
    endsAt: string,
  ): { startsAt: Date; endsAt: Date } {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Start and end have to be valid dates.');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'A programme item has to end after it starts.',
      );
    }
    return { startsAt: start, endsAt: end };
  }

  private title(value: string): string {
    const title = value.trim();
    if (title.length === 0) {
      throw new BadRequestException(
        'A programme item needs a title participants read.',
      );
    }
    return title;
  }
}

/** An emptied form field means "no value", not the empty string. */
function optional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param counts sign-ups per item id; a session without any is simply absent,
 * which is why the default is spelled out here rather than in the query.
 */
function toPublicProgramItem(
  record: ProgramItemRecord,
  counts: ReadonlyMap<string, number>,
): PublicProgramItem {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    speaker: record.speaker,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    registrationEnabled: record.registrationEnabled,
    capacity: record.capacity,
    signupCount: counts.get(record.id) ?? 0,
  };
}

function toProgramItem(
  record: ProgramItemRecord,
  counts: ReadonlyMap<string, number>,
): ProgramItem {
  return {
    ...toPublicProgramItem(record, counts),
    eventId: record.eventId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
