import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PLUGIN_PROGRAM_READS,
  type PluginProgramReads,
} from '../../../app/business/plugin-api';
import {
  PROGRAM_ITEM_ROOM_REPOSITORY,
  type ProgramItemRoomRepository,
} from './ports/program-item-room.repository';
import {
  ROOM_REPOSITORY,
  UnknownEventError,
  type CreateRoomInput,
  type RoomRecord,
  type RoomRepository,
} from './ports/room.repository';

/** One session in a room, with the numbers the phase 4 check will compare. */
export interface RoomBooking {
  readonly programItemId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  /** The session's own limit, if it set one. */
  readonly itemCapacity: number | null;
  /** How many have signed up — read through the host's port (E12). */
  readonly signupCount: number;
}

/** What a room is used for. */
export interface RoomSchedule {
  readonly room: RoomRecord;
  readonly bookings: readonly RoomBooking[];
}

/**
 * Room planning business logic (FR 3.11).
 *
 * Structured room management with capacities (F14) — an OpenStreetMap floor plan
 * is a later stage, never a Google Maps embed (NFR 9).
 *
 * Since AP 9 the plug-in owns the link between a session and a room (F21) and
 * reads the sessions themselves through the host's versioned port (E12). What
 * that buys is visible in this file: there is no ORM import, no core entity and
 * no knowledge of `program_item` anywhere in it, and the plug-in still knows
 * when a session runs and how many people signed up for it.
 *
 * The overbooking *check* — comparing those sign-ups against room capacity, and
 * deciding what an organizer should be told — belongs to phase 4. What is built
 * here is what it needs: the assignment, and a schedule that reports the numbers
 * side by side without judging them. That line is deliberate; a warning invented
 * now would be a product decision taken without the pilot partner.
 */
@Injectable()
export class RoomPlanningService {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(PROGRAM_ITEM_ROOM_REPOSITORY)
    private readonly assignments: ProgramItemRoomRepository,
    // The host's read port (E12). The only way this plug-in learns that a
    // programme exists, and deliberately the narrowest one: session times and
    // sign-up counts, never a participant.
    @Inject(PLUGIN_PROGRAM_READS)
    private readonly program: PluginProgramReads,
  ) {}

  listRooms(eventId: string): Promise<readonly RoomRecord[]> {
    return this.rooms.findByEvent(eventId);
  }

  async createRoom(input: CreateRoomInput): Promise<RoomRecord> {
    if (input.capacity < 1) {
      throw new BadRequestException(
        'A room must have a capacity of at least 1',
      );
    }

    const existing = await this.rooms.findByEvent(input.eventId);
    // Two rooms with the same name make the programme ambiguous for participants.
    if (
      existing.some(
        (room) => room.name.toLowerCase() === input.name.trim().toLowerCase(),
      )
    ) {
      throw new BadRequestException(
        `This event already has a room named "${input.name}"`,
      );
    }

    try {
      return await this.rooms.create({ ...input, name: input.name.trim() });
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
   * Puts a session in a room (F21).
   *
   * Two rules, and both need the host's read port:
   *
   * 1. **The session has to exist.** The database says so too — the join table
   *    has a foreign key on it — but a 404 is a better answer than a constraint
   *    violation, and the port is what makes it possible to give one.
   * 2. **The session and the room have to belong to the same event.** Otherwise
   *    the room plan of one conference would fill up with another's sessions, and
   *    the overbooking check of phase 4 would compare numbers that have nothing
   *    to do with each other.
   *
   * Idempotent: the pair is the primary key. Assigning what is already assigned
   * is the same fact stated twice.
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
   * What one room is used for, with the sign-up numbers beside its capacity.
   *
   * The numbers are reported, not judged: whether twelve sign-ups in a room with
   * ten chairs is a problem, and what an organizer should see about it, is the
   * overbooking check of phase 4.
   *
   * Sessions that vanished between two reads are dropped rather than reported as
   * gaps. The cascade takes their assignments, so this is only ever the width of
   * one race.
   */
  async roomSchedule(roomId: string): Promise<RoomSchedule> {
    const room = await this.requireRoom(roomId);
    const assignments = await this.assignments.findByRoom(roomId);

    const items = (
      await Promise.all(
        assignments.map((assignment) =>
          this.program.findItem(assignment.programItemId),
        ),
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    // One query for every count, not one per session (E12).
    const signups = await this.program.countSignups(
      items.map((item) => item.id),
    );

    return {
      room,
      bookings: items
        .map((item) => ({
          programItemId: item.id,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          itemCapacity: item.capacity,
          signupCount: signups.get(item.id) ?? 0,
        }))
        // The clock is the order here as well (F40), with the id as the tiebreaker.
        .sort(
          (left, right) =>
            Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
            left.programItemId.localeCompare(right.programItemId),
        ),
    };
  }

  private async requireRoom(roomId: string): Promise<RoomRecord> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException(`No room with id ${roomId}`);
    return room;
  }
}
