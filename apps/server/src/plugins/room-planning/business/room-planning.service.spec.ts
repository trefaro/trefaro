import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type {
  PluginProgramItem,
  PluginProgramReads,
} from '../../../app/business/plugin-api';
import type {
  ProgramItemRoomRecord,
  ProgramItemRoomRepository,
} from './ports/program-item-room.repository';
import {
  UnknownEventError,
  type CreateRoomInput,
  type RoomRecord,
  type RoomRepository,
} from './ports/room.repository';
import { RoomPlanningService } from './room-planning.service';

const EVENT = '11111111-1111-4111-8111-111111111111';
const OTHER_EVENT = '22222222-2222-4222-8222-222222222222';

class FakeRoomRepository implements RoomRepository {
  rooms: RoomRecord[] = [];
  /** Event ids the database would accept — the foreign key of AP 9 (F21). */
  knownEvents = new Set<string>([EVENT, OTHER_EVENT]);

  async findByEvent(eventId: string): Promise<readonly RoomRecord[]> {
    return this.rooms.filter((room) => room.eventId === eventId);
  }

  async findById(id: string): Promise<RoomRecord | null> {
    return this.rooms.find((room) => room.id === id) ?? null;
  }

  async create(input: CreateRoomInput): Promise<RoomRecord> {
    if (!this.knownEvents.has(input.eventId)) {
      throw new UnknownEventError(input.eventId);
    }
    const room = { id: `room-${this.rooms.length + 1}`, ...input };
    this.rooms.push(room);
    return room;
  }
}

class FakeAssignmentRepository implements ProgramItemRoomRepository {
  rows: ProgramItemRoomRecord[] = [];

  async findByRoom(roomId: string): Promise<readonly ProgramItemRoomRecord[]> {
    return this.rows.filter((row) => row.roomId === roomId);
  }

  async findByProgramItem(
    programItemId: string,
  ): Promise<readonly ProgramItemRoomRecord[]> {
    return this.rows.filter((row) => row.programItemId === programItemId);
  }

  async assign(programItemId: string, roomId: string): Promise<void> {
    // The primary key is the rule; assigning twice is the same fact twice.
    if (
      this.rows.some(
        (row) => row.programItemId === programItemId && row.roomId === roomId,
      )
    ) {
      return;
    }
    this.rows.push({
      programItemId,
      roomId,
      createdAt: new Date(2026, 7, 27, 9, this.rows.length),
    });
  }

  async unassign(programItemId: string, roomId: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (row) => !(row.programItemId === programItemId && row.roomId === roomId),
    );
    return this.rows.length < before;
  }
}

/**
 * The host's read port (E12), as the plug-in sees it.
 *
 * A fake of an interface the plug-in imports from `plugin-api` and of nothing
 * else — which is the point of the port: this suite proves the plug-in's rules
 * without a database, without the core programme module, and without a single
 * ORM import in the file it is testing.
 */
class FakeProgramReads implements PluginProgramReads {
  items: PluginProgramItem[] = [];
  signups = new Map<string, number>();

  async findItem(itemId: string): Promise<PluginProgramItem | null> {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  async countSignups(
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    return new Map(
      itemIds
        .filter((id) => this.signups.has(id))
        .map((id) => [id, this.signups.get(id) as number]),
    );
  }
}

const session = (
  id: string,
  hour: number,
  overrides: Partial<PluginProgramItem> = {},
): PluginProgramItem => ({
  id,
  eventId: EVENT,
  startsAt: `2027-06-14T${String(hour).padStart(2, '0')}:00:00.000Z`,
  endsAt: `2027-06-14T${String(hour + 1).padStart(2, '0')}:00:00.000Z`,
  capacity: null,
  ...overrides,
});

function input(overrides: Partial<CreateRoomInput> = {}): CreateRoomInput {
  return {
    eventId: EVENT,
    name: 'Room A',
    capacity: 40,
    floor: null,
    description: null,
    ...overrides,
  };
}

describe('RoomPlanningService', () => {
  let repository: FakeRoomRepository;
  let assignments: FakeAssignmentRepository;
  let program: FakeProgramReads;
  let service: RoomPlanningService;

  beforeEach(() => {
    repository = new FakeRoomRepository();
    assignments = new FakeAssignmentRepository();
    program = new FakeProgramReads();
    service = new RoomPlanningService(repository, assignments, program);
  });

  it('stores a room with its capacity, which the overbooking check needs', async () => {
    const room = await service.createRoom(input({ capacity: 25 }));

    expect(room).toMatchObject({ name: 'Room A', capacity: 25 });
  });

  it('trims the room name before storing it', async () => {
    const room = await service.createRoom(input({ name: '  Room A  ' }));

    expect(room.name).toBe('Room A');
  });

  it('rejects a room without seats', async () => {
    await expect(service.createRoom(input({ capacity: 0 }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a duplicate room name, ignoring case and padding', async () => {
    await service.createRoom(input({ name: 'Room A' }));

    await expect(
      service.createRoom(input({ name: '  room a ' })),
    ).rejects.toThrow(/already has a room named/);
  });

  it('allows the same room name in a different event', async () => {
    await service.createRoom(input({ name: 'Room A' }));

    await expect(
      service.createRoom(input({ eventId: OTHER_EVENT, name: 'Room A' })),
    ).resolves.toMatchObject({ eventId: OTHER_EVENT });
  });

  it('lists only the rooms of the requested event', async () => {
    await service.createRoom(input({ name: 'Room A' }));
    await service.createRoom(input({ eventId: OTHER_EVENT, name: 'Room B' }));

    expect(await service.listRooms(EVENT)).toHaveLength(1);
  });

  it('answers a room for an unknown event as absent, not as a failure', async () => {
    // The foreign key of AP 9 (F21) is what says so; the plug-in turns the
    // constraint violation into the answer an API should give.
    await expect(
      service.createRoom(
        input({ eventId: 'ffffffff-0000-4000-8000-000000000000' }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  describe('assigning a room to a session (F21)', () => {
    let roomId: string;

    beforeEach(async () => {
      roomId = (await service.createRoom(input({ name: 'Room A' }))).id;
      program.items.push(session('item-1', 9));
    });

    it('stores the pair', async () => {
      await service.assignRoom('item-1', roomId);

      expect(assignments.rows).toHaveLength(1);
      expect(assignments.rows[0]).toMatchObject({
        programItemId: 'item-1',
        roomId,
      });
    });

    it('is idempotent — the pair is the primary key', async () => {
      await service.assignRoom('item-1', roomId);
      await service.assignRoom('item-1', roomId);

      expect(assignments.rows).toHaveLength(1);
    });

    it('refuses a session of another event', async () => {
      program.items.push(
        session('item-elsewhere', 9, { eventId: OTHER_EVENT }),
      );

      await expect(
        service.assignRoom('item-elsewhere', roomId),
      ).rejects.toThrow(ConflictException);
    });

    it('is a 404 for a session the host does not know', async () => {
      await expect(service.assignRoom('item-nope', roomId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is a 404 for a room that does not exist', async () => {
      await expect(
        service.assignRoom('item-1', 'aaaaaaaa-0000-4000-8000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('takes a session out of a room, and says nothing if it was not in it', async () => {
      await service.assignRoom('item-1', roomId);

      await service.unassignRoom('item-1', roomId);
      await service.unassignRoom('item-1', roomId);

      expect(assignments.rows).toHaveLength(0);
    });
  });

  describe('the schedule of a room (E12)', () => {
    let roomId: string;

    beforeEach(async () => {
      roomId = (await service.createRoom(input({ name: 'Room A' }))).id;
      program.items.push(session('late', 14), session('early', 9));
      program.signups.set('early', 7);
      await service.assignRoom('late', roomId);
      await service.assignRoom('early', roomId);
    });

    it('reads the sign-up counts through the port, in clock order', async () => {
      const schedule = await service.roomSchedule(roomId);

      expect(schedule.room.name).toBe('Room A');
      expect(schedule.bookings.map((booking) => booking.programItemId)).toEqual(
        ['early', 'late'],
      );
      expect(schedule.bookings[0].signupCount).toBe(7);
      // Absent from the map means nobody yet, not a missing session.
      expect(schedule.bookings[1].signupCount).toBe(0);
    });

    it('reports the numbers without judging them — the check is phase 4', async () => {
      program.signups.set('early', 99);

      const schedule = await service.roomSchedule(roomId);

      // Ninety-nine sign-ups in a room with forty seats is exactly what an
      // overbooking check exists for. Nothing here decides that; it hands over
      // the two numbers side by side.
      expect(schedule.room.capacity).toBe(40);
      expect(schedule.bookings[0].signupCount).toBe(99);
    });

    it('drops a session that vanished between two reads', async () => {
      program.items = program.items.filter((item) => item.id !== 'late');

      const schedule = await service.roomSchedule(roomId);

      expect(schedule.bookings.map((booking) => booking.programItemId)).toEqual(
        ['early'],
      );
    });

    it('is a 404 for a room that does not exist', async () => {
      await expect(
        service.roomSchedule('aaaaaaaa-0000-4000-8000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
