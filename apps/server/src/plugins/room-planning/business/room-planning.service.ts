import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ROOM_REPOSITORY,
  type CreateRoomInput,
  type RoomRecord,
  type RoomRepository,
} from './ports/room.repository';

/**
 * Room planning business logic (FR 3.11).
 *
 * Structured room management with capacities (F14) — an OpenStreetMap floor plan
 * is a later stage, never a Google Maps embed (NFR 9).
 *
 * The overbooking check this data exists for compares programme item sign-ups
 * (FR 3.10) against room capacity. It arrives once the core programme module
 * ships those sign-ups in phase 1; the capacity it will read is stored here.
 */
@Injectable()
export class RoomPlanningService {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
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

    return this.rooms.create({ ...input, name: input.name.trim() });
  }
}
