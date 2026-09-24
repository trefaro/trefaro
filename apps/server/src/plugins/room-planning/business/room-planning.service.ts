import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ROOM_WARNINGS,
  type PlannedRoom,
  type PlannedSession,
  type PublicRoom,
  type RoomBooking,
  type RoomPlan,
  type RoomWarning,
} from '@trefaro/shared-models';
import {
  PLUGIN_PROGRAM_READS,
  type PluginProgramItem,
  type PluginProgramReads,
} from '../../../app/business/plugin-api';
import {
  PROGRAM_ITEM_ROOM_REPOSITORY,
  type ProgramItemRoomRecord,
  type ProgramItemRoomRepository,
} from './ports/program-item-room.repository';
import {
  ROOM_REPOSITORY,
  UnknownEventError,
  type CreateRoomInput,
  type RoomChanges,
  type RoomRecord,
  type RoomRepository,
} from './ports/room.repository';

/**
 * Room planning business logic (FR 3.11, FR 3.6).
 *
 * Structured room management with capacities (F14) — an OpenStreetMap floor plan
 * is a later stage, never a Google Maps embed (NFR 9).
 *
 * Since AP 9 of phase 1 the plug-in owns the link between a session and a room
 * (F21) and reads the sessions themselves through the host's versioned port
 * (E12). What that buys is visible in this file: there is no ORM import, no
 * core entity and no knowledge of `program_item` anywhere in it, and the
 * plug-in still knows what a session is called, when it runs and how many
 * people signed up for it.
 *
 * **What a room plan does is show, not refuse** (E50, AP 6 of phase 4). More
 * sign-ups than the rooms of a session have chairs, and two sessions at the
 * same time in one room, are **warnings** — computed every time the plan is
 * read, stored nowhere, shown at the session and at the room. Nothing here
 * refuses an assignment because of them: F41's precedent is that overlapping
 * sessions are a two-track conference, and a tool that refuses a room gets a
 * second room named "Saal A (2)", after which the truth is no longer in the
 * plan. Whether an organizer wants a hard limit instead is the pilot
 * partner's question, kept in `todo.md`.
 */
@Injectable()
export class RoomPlanningService {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(PROGRAM_ITEM_ROOM_REPOSITORY)
    private readonly assignments: ProgramItemRoomRepository,
    // The host's read port (E12). The only way this plug-in learns that a
    // programme exists, and deliberately the narrowest one: titles, session
    // times and sign-up counts, never a participant.
    @Inject(PLUGIN_PROGRAM_READS)
    private readonly program: PluginProgramReads,
  ) {}

  listRooms(eventId: string): Promise<readonly RoomRecord[]> {
    return this.rooms.findByEvent(eventId);
  }

  async createRoom(input: CreateRoomInput): Promise<RoomRecord> {
    const name = this.roomName(input.name);
    this.seats(input.capacity);
    await this.requireUnusedName(input.eventId, name);

    try {
      return await this.rooms.create({ ...input, name });
    } catch (error: unknown) {
      // Since AP 9 the database refuses a room for an event that does not exist
      // (F21). Before it did, such a room was simply invisible — which is the
      // gap that decided the whole question.
      if (!(error instanceof UnknownEventError)) throw error;
      throw new NotFoundException(
        `No event with id ${input.eventId}. A room belongs to one event.`,
      );
    }
  }

  /**
   * Changes a room — what phase 1 left open (FR 3.11).
   *
   * The same two rules as creating one, applied to what is being changed: a
   * name is trimmed and may not collide with another room of the event, and a
   * capacity is at least one seat. Only the fields given are written.
   */
  async updateRoom(roomId: string, changes: RoomChanges): Promise<RoomRecord> {
    const room = await this.requireRoom(roomId);
    const name =
      changes.name === undefined ? undefined : this.roomName(changes.name);
    if (changes.capacity !== undefined) this.seats(changes.capacity);
    if (name !== undefined) {
      await this.requireUnusedName(room.eventId, name, room.id);
    }

    const updated = await this.rooms.update(roomId, { ...changes, name });
    if (!updated) throw new NotFoundException(`No room with id ${roomId}`);
    return updated;
  }

  /**
   * Removes a room.
   *
   * Its assignments go with it — the cascade on the plug-in's own join table
   * (F21) — and its sessions stay where they are in the programme: a room that
   * is gone is a room, not a session.
   */
  async deleteRoom(roomId: string): Promise<void> {
    if (!(await this.rooms.delete(roomId))) {
      throw new NotFoundException(`No room with id ${roomId}`);
    }
  }

  /**
   * Puts a session in a room (F21).
   *
   * Two rules, and both need the host's read port:
   *
   * 1. **The session has to exist.** The database says so too — the join table
   *    has a foreign key on it — but a 404 is a better answer than a constraint
   *    violation, and the port is what makes it possible to give one.
   * 2. **The session and the room have to belong to the same event.** Otherwise
   *    the room plan of one conference would fill up with another's sessions, and
   *    the overbooking check would compare numbers that have nothing to do with
   *    each other.
   *
   * What is deliberately **not** a rule here: the room's capacity, and what
   * else happens in it at that hour (E50). Idempotent: the pair is the primary
   * key. Assigning what is already assigned is the same fact stated twice.
   */
  async assignRoom(programItemId: string, roomId: string): Promise<void> {
    const room = await this.requireRoom(roomId);
    const item = await this.program.findItem(programItemId);
    if (!item) {
      throw new NotFoundException(`No programme item with id ${programItemId}`);
    }
    if (item.eventId !== room.eventId) {
      throw new ConflictException(
        `"${room.name}" belongs to another event than this session. A room can ` +
          'only host sessions of its own event.',
      );
    }

    await this.assignments.assign(programItemId, roomId);
  }

  /** Idempotent as well: no assignment is the outcome either way. */
  async unassignRoom(programItemId: string, roomId: string): Promise<void> {
    await this.requireRoom(roomId);
    await this.assignments.unassign(programItemId, roomId);
  }

  /**
   * The whole plan of one event, with both warnings (FR 3.11, E50).
   *
   * Every room with its sessions in clock order, and every session of the
   * event — placed or not — so the editor can offer the ones without a room.
   * Four reads for the whole screen (F49): the rooms, the sessions through the
   * port, the assignments of all rooms at once, and the sign-ups of every
   * placed session in one query.
   */
  async plan(eventId: string): Promise<RoomPlan> {
    const [rooms, items] = await Promise.all([
      this.rooms.findByEvent(eventId),
      this.program.listForEvent(eventId),
    ]);
    return {
      rooms: await this.planRooms(rooms, items),
      sessions: items.map(toPlannedSession),
    };
  }

  /**
   * The plan as a participant reads it, without a login (FR 3.6, E58).
   *
   * The same rooms and the same assignments, the titles in the reader's
   * language (E56) — and no number about people: no sign-up counts and no
   * warnings. Those are the organizer's, and a public plan that carried them
   * would tell a visitor how full a workshop is before they decided to come.
   */
  async publicPlan(
    eventId: string,
    locale?: string,
  ): Promise<readonly PublicRoom[]> {
    const [rooms, items] = await Promise.all([
      this.rooms.findByEvent(eventId),
      this.program.listForEvent(eventId, locale),
    ]);
    const placed = await this.placements(rooms, items);

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      floor: room.floor,
      description: room.description,
      bookings: placed.inRoom(room.id).map(toPlannedSession),
    }));
  }

  /**
   * What one room is used for, with the same warnings the plan carries.
   *
   * Phase 1 handed the sign-ups and the capacity over side by side and judged
   * neither; since AP 6 of phase 4 this is one room out of the event's plan,
   * so the overbooking of a session that spreads into a second room is
   * computed against both — which a look at one room alone could not do.
   */
  async roomSchedule(roomId: string): Promise<PlannedRoom> {
    const room = await this.requireRoom(roomId);
    const plan = await this.plan(room.eventId);
    const planned = plan.rooms.find((one) => one.room.id === roomId);
    // The room was read a moment ago; only a delete between the two reads can
    // make this miss, and then "gone" is the honest answer.
    if (!planned) throw new NotFoundException(`No room with id ${roomId}`);
    return planned;
  }

  /**
   * The rooms with their bookings and the two warnings of E50.
   *
   * **Overbooked**: more sign-ups than the chairs of every room the session
   * uses, added up — a plenary that spreads into a second room is not
   * overbooked in either. **Double-booked**: another session in the same room
   * whose time overlaps; two sessions that merely touch (one ends the minute
   * the other begins) do not. A room carries each warning once, whichever of
   * its sessions carry it.
   */
  private async planRooms(
    rooms: readonly RoomRecord[],
    items: readonly PluginProgramItem[],
  ): Promise<PlannedRoom[]> {
    const placed = await this.placements(rooms, items);
    // One query for every count, not one per session (E12).
    const signups = await this.program.countSignups(placed.itemIds());

    return rooms.map((room) => {
      const sessions = placed.inRoom(room.id);
      const bookings: RoomBooking[] = sessions.map((item) => {
        const warnings: RoomWarning[] = [];
        const signupCount = signups.get(item.id) ?? 0;
        if (signupCount > placed.chairsOf(item.id)) warnings.push('overbooked');
        if (sessions.some((other) => other !== item && overlap(item, other))) {
          warnings.push('double-booked');
        }
        return {
          ...toPlannedSession(item),
          itemCapacity: item.capacity,
          signupCount,
          warnings,
        };
      });
      return {
        room,
        bookings,
        warnings: ROOM_WARNINGS.filter((warning) =>
          bookings.some((booking) => booking.warnings.includes(warning)),
        ),
      };
    });
  }

  /**
   * The assignments of these rooms, joined to the sessions the port knows.
   *
   * An assignment whose session vanished between two reads is dropped rather
   * than reported as a gap — the cascade takes it, so this is only ever the
   * width of one race.
   */
  private async placements(
    rooms: readonly RoomRecord[],
    items: readonly PluginProgramItem[],
  ): Promise<Placements> {
    const rows =
      rooms.length === 0
        ? []
        : await this.assignments.findByRooms(rooms.map((room) => room.id));
    return new Placements(rooms, items, rows);
  }

  private async requireRoom(roomId: string): Promise<RoomRecord> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException(`No room with id ${roomId}`);
    return room;
  }

  /** Trimmed, and not empty afterwards — a length check cannot see spaces. */
  private roomName(name: string): string {
    const trimmed = name.trim();
    if (trimmed === '') throw new BadRequestException('A room needs a name');
    return trimmed;
  }

  private seats(capacity: number): void {
    if (capacity < 1) {
      throw new BadRequestException(
        'A room must have a capacity of at least 1',
      );
    }
  }

  /**
   * Two rooms with the same name make the programme ambiguous for
   * participants — checked without case, and without the room itself when it
   * is the one being renamed.
   */
  private async requireUnusedName(
    eventId: string,
    name: string,
    exceptRoomId?: string,
  ): Promise<void> {
    const existing = await this.rooms.findByEvent(eventId);
    if (
      existing.some(
        (room) =>
          room.id !== exceptRoomId &&
          room.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new BadRequestException(
        `This event already has a room named "${name}"`,
      );
    }
  }
}

/** The assignments of an event's rooms, resolved against the port's sessions. */
class Placements {
  private readonly itemsById: ReadonlyMap<string, PluginProgramItem>;
  private readonly capacityByRoom: ReadonlyMap<string, number>;
  /** Only assignments whose session the port still knows. */
  private readonly live: readonly ProgramItemRoomRecord[];

  constructor(
    rooms: readonly RoomRecord[],
    items: readonly PluginProgramItem[],
    rows: readonly ProgramItemRoomRecord[],
  ) {
    this.itemsById = new Map(items.map((item) => [item.id, item]));
    this.capacityByRoom = new Map(
      rooms.map((room) => [room.id, room.capacity]),
    );
    this.live = rows.filter((row) => this.itemsById.has(row.programItemId));
  }

  /** The sessions in one room, in clock order (F40), the id as tiebreaker. */
  inRoom(roomId: string): PluginProgramItem[] {
    return this.live
      .filter((row) => row.roomId === roomId)
      .map((row) => this.itemsById.get(row.programItemId) as PluginProgramItem)
      .sort(
        (left, right) =>
          Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
          left.id.localeCompare(right.id),
      );
  }

  /** Every placed session once, for the one sign-up query. */
  itemIds(): string[] {
    return [...new Set(this.live.map((row) => row.programItemId))];
  }

  /** The chairs of every room this session uses, added up. */
  chairsOf(itemId: string): number {
    return this.live
      .filter((row) => row.programItemId === itemId)
      .reduce(
        (sum, row) => sum + (this.capacityByRoom.get(row.roomId) ?? 0),
        0,
      );
  }
}

/** Two sessions overlap when each begins before the other ends. */
function overlap(left: PluginProgramItem, right: PluginProgramItem): boolean {
  return (
    Date.parse(left.startsAt) < Date.parse(right.endsAt) &&
    Date.parse(right.startsAt) < Date.parse(left.endsAt)
  );
}

function toPlannedSession(item: PluginProgramItem): PlannedSession {
  return {
    programItemId: item.id,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    // The event's clock, handed on from the port (E69). Without it the plan
    // drew its slots in the browser's zone, disagreeing with the programme
    // above it on the same page by the offset between the two.
    timezone: item.timezone,
  };
}
