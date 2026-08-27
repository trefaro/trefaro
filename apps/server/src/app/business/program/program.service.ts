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
import { MAX_PROGRAM_ITEMS, formatEventPeriod } from '@trefaro/shared-models';
import { EventsService } from '../events';
import {
  PROGRAM_ITEM_REPOSITORY,
  type NewProgramItem,
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
 */
@Injectable()
export class ProgramService {
  constructor(
    @Inject(PROGRAM_ITEM_REPOSITORY)
    private readonly items: ProgramItemRepository,
    private readonly events: EventsService,
  ) {}

  /** One event's programme as the organizer manages it (FR 3.7). */
  async listForOrganizer(eventId: string): Promise<readonly ProgramItem[]> {
    // Resolving the event first turns an unknown id into a 404 rather than an
    // empty list, which would read as "this event has no programme".
    await this.events.getForOrganizer(eventId);
    return (await this.items.findByEvent(eventId)).map(toProgramItem);
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
    return (await this.items.findByEvent(event.id)).map(toPublicProgramItem);
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

    const item: NewProgramItem = {
      eventId,
      title: this.title(input.title),
      description: optional(input.description),
      speaker: optional(input.speaker),
      ...period,
    };
    return toProgramItem(await this.items.create(item));
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
    });
    if (!updated) throw new NotFoundException(GONE);
    return toProgramItem(updated);
  }

  /**
   * Removes a programme item.
   *
   * No archiving and no confirmation rule of its own (unlike E14 for an event):
   * a programme item is a plan, not somebody's statement of intent. From AP 9
   * the sign-ups of an item go with it through the database cascade — which is
   * why that package, not this one, is where the question of what a sign-up is
   * worth gets asked.
   */
  async delete(id: string): Promise<void> {
    if (!(await this.items.delete(id))) throw new NotFoundException(GONE);
  }

  private async require(id: string): Promise<ProgramItemRecord> {
    const found = await this.items.findById(id);
    if (!found) throw new NotFoundException(GONE);
    return found;
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

function toPublicProgramItem(record: ProgramItemRecord): PublicProgramItem {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    speaker: record.speaker,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
  };
}

function toProgramItem(record: ProgramItemRecord): ProgramItem {
  return {
    ...toPublicProgramItem(record),
    eventId: record.eventId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
