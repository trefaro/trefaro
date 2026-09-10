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
  type RoomChanges,
  type RoomRecord,
  type RoomRepository,
} from './ports/room.repository';
import { RoomPlanningService } from './room-planning.service';

const EVENT = '11111111-1111-4111-8111-111111111111';
const OTHER_EVENT = '22222222-2222-4222-8222-222222222222';
const NOWHERE = 'aaaaaaaa-0000-4000-8000-000000000000';

class FakeRoomRepository implements RoomRepository {
  rooms: RoomRecord[] = [];
  /** Event ids the database would accept — the foreign key of AP 9 (F21). */
  knownEvents = new Set<string>([EVENT, OTHER_EVENT]);

  async findByEvent(eventId: string): Promise<readonly RoomRecord[]> {
    // By name, like the real one: a plan is read room by room.
    return this.rooms
      .filter((room) => room.eventId === eventId)
      .sort((left, right) => left.name.localeCompare(right.name));
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

  async update(id: string, changes: RoomChanges): Promise<RoomRecord | null> {
    const index = this.rooms.findIndex((room) => room.id === id);
    if (index < 0) return null;
    // Only what was given is written — `undefined` leaves a field alone.
    const written = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    this.rooms[index] = { ...this.rooms[index], ...written };
    return this.rooms[index];
  }

  async delete(id: string): Promise<boolean> {
    const before = this.rooms.length;
    this.rooms = this.rooms.filter((room) => room.id !== id);
    return this.rooms.length < before;
  }
}

class FakeAssignmentRepository implements ProgramItemRoomRepository {
  rows: ProgramItemRoomRecord[] = [];

  async findByRoom(roomId: string): Promise<readonly ProgramItemRoomRecord[]> {
    return this.rows.filter((row) => row.roomId === roomId);
  }

  async findByRooms(
    roomIds: readonly string[],
  ): Promise<readonly ProgramItemRoomRecord[]> {
    return this.rows.filter((row) => roomIds.includes(row.roomId));
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
 * The host's read port (E12, E56), as the plug-in sees it.
 *
 * A fake of an interface the plug-in imports from `plugin-api` and of nothing
 * else — which is the point of the port: this suite proves the plug-in's rules
 * without a database, without the core programme module, and without a single
 * ORM import in the file it is testing.
 */
class FakeProgramReads implements PluginProgramReads {
  items: PluginProgramItem[] = [];
  signups = new Map<string, number>();
  /** `"<item id>:<locale>"` → the translated title, where somebody translated. */
  translations = new Map<string, string>();

  async findItem(itemId: string): Promise<PluginProgramItem | null> {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  async listForEvent(
    eventId: string,
    locale?: string,
  ): Promise<readonly PluginProgramItem[]> {
    return this.items
      .filter((item) => item.eventId === eventId)
      .sort(
        (left, right) =>
          Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
          Date.parse(left.endsAt) - Date.parse(right.endsAt) ||
          left.id.localeCompare(right.id),
      )
      .map((item) => ({
        ...item,
        title:
          (locale && this.translations.get(`${item.id}:${locale}`)) ||
          item.title,
      }));
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

/** A session on 14 June 2027, from `from` to `to` in fractional hours. */
const session = (
  id: string,
  from: number,
  to: number = from + 1,
  overrides: Partial<PluginProgramItem> = {},
): PluginProgramItem => ({
  id,
  eventId: EVENT,
  title: `Session ${id}`,
  startsAt: at(from),
  endsAt: at(to),
  registrationEnabled: false,
  capacity: null,
  ...overrides,
});

function at(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `2027-06-14T${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
}

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

  it('rejects a name that is only spaces — the length check cannot see that', async () => {
    await expect(service.createRoom(input({ name: '   ' }))).rejects.toThrow(
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

  describe('changing a room (FR 3.11)', () => {
    let roomA: string;

    beforeEach(async () => {
      roomA = (
        await service.createRoom(input({ name: 'Room A', floor: '1st floor' }))
      ).id;
      await service.createRoom(input({ name: 'Room B', capacity: 20 }));
    });

    it('renames it, trimmed, and keeps what was not sent', async () => {
      const room = await service.updateRoom(roomA, { name: '  Saal A ' });

      expect(room).toMatchObject({
        name: 'Saal A',
        capacity: 40,
        floor: '1st floor',
      });
    });

    it('changes the seats, which moves the overbooking line', async () => {
      const room = await service.updateRoom(roomA, { capacity: 12 });

      expect(room.capacity).toBe(12);
    });

    it('refuses a name that is only spaces', async () => {
      await expect(service.updateRoom(roomA, { name: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses to take the last seat away', async () => {
      await expect(service.updateRoom(roomA, { capacity: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses the name of another room of the same event, ignoring case', async () => {
      // Two rooms with the same name make the programme ambiguous for
      // participants — the rule the creation has, applied to the rename.
      await expect(
        service.updateRoom(roomA, { name: 'room b' }),
      ).rejects.toThrow(/already has a room named/);
    });

    it('lets a room keep its own name in a new spelling', async () => {
      const room = await service.updateRoom(roomA, { name: 'ROOM A' });

      expect(room.name).toBe('ROOM A');
    });

    it('clears the floor with null, and leaves it alone when the field is absent', async () => {
      expect(
        (await service.updateRoom(roomA, { description: 'Lift at the back' }))
          .floor,
      ).toBe('1st floor');

      expect((await service.updateRoom(roomA, { floor: null })).floor).toBe(
        null,
      );
    });

    it('is a 404 for a room that does not exist', async () => {
      await expect(
        service.updateRoom(NOWHERE, { name: 'Nowhere' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleting a room', () => {
    it('removes it, so the plan no longer lists it', async () => {
      const room = await service.createRoom(input({ name: 'Room A' }));

      await service.deleteRoom(room.id);

      expect((await service.plan(EVENT)).rooms).toEqual([]);
    });

    it('is a 404 when it is already gone', async () => {
      await expect(service.deleteRoom(NOWHERE)).rejects.toThrow(
        NotFoundException,
      );
    });
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
        session('item-elsewhere', 9, 10, { eventId: OTHER_EVENT }),
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
      await expect(service.assignRoom('item-1', NOWHERE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('takes a session out of a room, and says nothing if it was not in it', async () => {
      await service.assignRoom('item-1', roomId);

      await service.unassignRoom('item-1', roomId);
      await service.unassignRoom('item-1', roomId);

      expect(assignments.rows).toHaveLength(0);
    });

    it('refuses nothing a room plan would warn about (E50)', async () => {
      // Forty-five people in a room with forty chairs, and a second session
      // at the same hour: both go through. The plan shows them; a tool that
      // refused would be worked around, and then the truth would not be in it.
      program.signups.set('item-1', 45);
      program.items.push(session('item-2', 9.5));

      await expect(
        service.assignRoom('item-1', roomId),
      ).resolves.toBeUndefined();
      await expect(
        service.assignRoom('item-2', roomId),
      ).resolves.toBeUndefined();
    });
  });

  describe('the plan of an event (E50)', () => {
    let roomA: string;
    let roomB: string;

    beforeEach(async () => {
      roomA = (await service.createRoom(input({ name: 'Room A' }))).id;
      roomB = (
        await service.createRoom(input({ name: 'Room B', capacity: 20 }))
      ).id;
      program.items.push(
        session('plenary', 9, 10, { title: 'Opening plenary' }),
        session('workshop', 11, 12.5, { title: 'Door-to-door', capacity: 30 }),
        session('panel', 11.5, 12, { title: 'Panel' }),
        session('unplaced', 14, 15, { title: 'Closing' }),
        session('elsewhere', 9, 10, { eventId: OTHER_EVENT }),
      );
      program.signups.set('plenary', 45);
      program.signups.set('workshop', 5);
      await service.assignRoom('plenary', roomA);
      await service.assignRoom('workshop', roomB);
      await service.assignRoom('panel', roomB);
    });

    it('lists every room with its sessions in clock order, named through the port', async () => {
      const plan = await service.plan(EVENT);

      expect(plan.rooms.map((planned) => planned.room.name)).toEqual([
        'Room A',
        'Room B',
      ]);
      expect(
        plan.rooms[1].bookings.map((booking) => [
          booking.programItemId,
          booking.title,
        ]),
      ).toEqual([
        ['workshop', 'Door-to-door'],
        ['panel', 'Panel'],
      ]);
      // The numbers a warning is made of travel with the session (F45): the
      // session's own limit and the sign-ups through the port.
      expect(plan.rooms[1].bookings[0]).toMatchObject({
        itemCapacity: 30,
        signupCount: 5,
      });
      expect(plan.rooms[1].bookings[1].signupCount).toBe(0);
    });

    it('lists every session of the event, placed or not, so the editor can offer them', async () => {
      const plan = await service.plan(EVENT);

      expect(plan.sessions.map((one) => one.programItemId)).toEqual([
        'plenary',
        'workshop',
        'panel',
        'unplaced',
      ]);
      expect(plan.sessions[3]).toEqual({
        programItemId: 'unplaced',
        title: 'Closing',
        startsAt: at(14),
        endsAt: at(15),
      });
    });

    it('warns at the session and at the room when more people signed up than it has chairs', async () => {
      const plan = await service.plan(EVENT);
      const [roomWithPlenary, other] = plan.rooms;

      // Forty-five sign-ups, forty chairs. The plan says so at the session
      // and at the room — and refuses nothing.
      expect(roomWithPlenary.bookings[0].warnings).toEqual(['overbooked']);
      expect(roomWithPlenary.warnings).toEqual(['overbooked']);
      expect(other.bookings[0].warnings).toEqual(
        expect.not.arrayContaining(['overbooked']),
      );
    });

    it('counts the chairs of every room a session uses before calling it overbooked', async () => {
      // The plenary spreads into the second room: forty plus twenty chairs
      // for forty-five people is not an overbooking, in either room.
      await service.assignRoom('plenary', roomB);

      const plan = await service.plan(EVENT);

      for (const planned of plan.rooms) {
        const plenary = planned.bookings.find(
          (booking) => booking.programItemId === 'plenary',
        );
        expect(plenary?.warnings).not.toContain('overbooked');
      }
      expect(plan.rooms[0].warnings).not.toContain('overbooked');
    });

    it('warns at both sessions and at the room when two overlap in it', async () => {
      const plan = await service.plan(EVENT);
      const roomWithTwo = plan.rooms[1];

      // Eleven to half past twelve, and half past eleven to twelve, in the
      // same room: a double booking, shown on both and on the room.
      expect(roomWithTwo.bookings.map((booking) => booking.warnings)).toEqual([
        ['double-booked'],
        ['double-booked'],
      ]);
      expect(roomWithTwo.warnings).toEqual(['double-booked']);
      // The other room hosts one session and has nothing to say about time.
      expect(plan.rooms[0].warnings).not.toContain('double-booked');
    });

    it('does not call two sessions that only touch a double booking', async () => {
      // The panel now begins the minute the workshop ends.
      program.items = program.items.map((item) =>
        item.id === 'panel'
          ? { ...item, startsAt: at(12.5), endsAt: at(13) }
          : item,
      );

      const plan = await service.plan(EVENT);

      expect(plan.rooms[1].warnings).toEqual([]);
    });

    it('names each warning once at the room, however many sessions carry it', async () => {
      program.signups.set('workshop', 25);
      program.signups.set('panel', 25);

      const plan = await service.plan(EVENT);

      expect(plan.rooms[1].warnings).toEqual(['overbooked', 'double-booked']);
    });

    it('keeps the rooms and sessions of another event out', async () => {
      await service.createRoom(input({ eventId: OTHER_EVENT, name: 'Room Z' }));

      const plan = await service.plan(EVENT);

      expect(plan.rooms.map((planned) => planned.room.name)).toEqual([
        'Room A',
        'Room B',
      ]);
      expect(plan.sessions.map((one) => one.programItemId)).not.toContain(
        'elsewhere',
      );
    });

    it('drops an assignment whose session vanished between two reads', async () => {
      program.items = program.items.filter((item) => item.id !== 'panel');

      const plan = await service.plan(EVENT);

      expect(
        plan.rooms[1].bookings.map((booking) => booking.programItemId),
      ).toEqual(['workshop']);
    });

    it('answers an event without rooms with an empty plan, not a failure', async () => {
      expect(await service.plan(OTHER_EVENT)).toEqual({
        rooms: [],
        sessions: [
          {
            programItemId: 'elsewhere',
            title: 'Session elsewhere',
            startsAt: at(9),
            endsAt: at(10),
          },
        ],
      });
    });
  });

  describe('the public plan (FR 3.6, E58)', () => {
    let roomA: string;

    beforeEach(async () => {
      roomA = (
        await service.createRoom(
          input({ name: 'Room A', floor: 'Ground floor' }),
        )
      ).id;
      await service.createRoom(input({ name: 'Room B', capacity: 20 }));
      program.items.push(
        session('plenary', 9, 10, { title: 'Opening plenary' }),
        session('panel', 11, 12, { title: 'Panel' }),
      );
      program.translations.set('plenary:de', 'Eröffnungsplenum');
      program.signups.set('plenary', 45);
      await service.assignRoom('plenary', roomA);
      await service.assignRoom('panel', roomA);
    });

    it('names the sessions in the language a participant asked in (E56)', async () => {
      const rooms = await service.publicPlan(EVENT, 'de');

      expect(rooms[0].bookings.map((booking) => booking.title)).toEqual([
        // Translated where somebody did, the original where nobody has (F95).
        'Eröffnungsplenum',
        'Panel',
      ]);
    });

    it('reads the originals when no language is asked for', async () => {
      const rooms = await service.publicPlan(EVENT);

      expect(rooms[0].bookings[0].title).toBe('Opening plenary');
    });

    it('carries the room, its sessions and their times — and no number about people', async () => {
      const rooms = await service.publicPlan(EVENT);

      expect(rooms.map((room) => room.name)).toEqual(['Room A', 'Room B']);
      expect(rooms[0]).toEqual({
        id: roomA,
        name: 'Room A',
        capacity: 40,
        floor: 'Ground floor',
        description: null,
        bookings: [
          {
            programItemId: 'plenary',
            title: 'Opening plenary',
            startsAt: at(9),
            endsAt: at(10),
          },
          {
            programItemId: 'panel',
            title: 'Panel',
            startsAt: at(11),
            endsAt: at(12),
          },
        ],
      });
      // Forty-five sign-ups in forty chairs is the organizer's warning, not a
      // visitor's information: neither the count nor the word appears here.
      expect(JSON.stringify(rooms)).not.toMatch(/signupCount|warnings|45/);
      expect(rooms[1].bookings).toEqual([]);
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

    it('carries the same warnings as the plan — the check that phase 1 left open', async () => {
      program.signups.set('early', 99);

      const schedule = await service.roomSchedule(roomId);

      // Ninety-nine sign-ups in a room with forty seats. Phase 1 handed the two
      // numbers over side by side; since AP 6 the schedule says what they mean.
      expect(schedule.room.capacity).toBe(40);
      expect(schedule.bookings[0]).toMatchObject({
        title: 'Session early',
        signupCount: 99,
        warnings: ['overbooked'],
      });
      expect(schedule.warnings).toEqual(['overbooked']);
    });

    it('drops a session that vanished between two reads', async () => {
      program.items = program.items.filter((item) => item.id !== 'late');

      const schedule = await service.roomSchedule(roomId);

      expect(schedule.bookings.map((booking) => booking.programItemId)).toEqual(
        ['early'],
      );
    });

    it('is a 404 for a room that does not exist', async () => {
      await expect(service.roomSchedule(NOWHERE)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
