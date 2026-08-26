import { BadRequestException } from '@nestjs/common';
import type {
  CreateRoomInput,
  RoomRecord,
  RoomRepository,
} from './ports/room.repository';
import { RoomPlanningService } from './room-planning.service';

const EVENT = '11111111-1111-4111-8111-111111111111';

class FakeRoomRepository implements RoomRepository {
  rooms: RoomRecord[] = [];

  async findByEvent(eventId: string): Promise<readonly RoomRecord[]> {
    return this.rooms.filter((room) => room.eventId === eventId);
  }

  async create(input: CreateRoomInput): Promise<RoomRecord> {
    const room = { id: `room-${this.rooms.length + 1}`, ...input };
    this.rooms.push(room);
    return room;
  }
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
  let service: RoomPlanningService;

  beforeEach(() => {
    repository = new FakeRoomRepository();
    service = new RoomPlanningService(repository);
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
    const other = '22222222-2222-4222-8222-222222222222';
    await service.createRoom(input({ name: 'Room A' }));

    await expect(
      service.createRoom(input({ eventId: other, name: 'Room A' })),
    ).resolves.toMatchObject({ eventId: other });
  });

  it('lists only the rooms of the requested event', async () => {
    const other = '22222222-2222-4222-8222-222222222222';
    await service.createRoom(input({ name: 'Room A' }));
    await service.createRoom(input({ eventId: other, name: 'Room B' }));

    expect(await service.listRooms(EVENT)).toHaveLength(1);
  });
});
