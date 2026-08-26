/**
 * Port for room storage.
 *
 * A plug-in mirrors the server's layering internally: this interface is its
 * business layer, and `data-access/typeorm-room.repository.ts` implements it.
 * That is what lets the plug-in's business logic be tested without a database
 * and keeps its ORM usage in one place.
 */

export interface RoomRecord {
  readonly id: string;
  /** Event the room belongs to. */
  readonly eventId: string;
  readonly name: string;
  /** Seats available — the number the overbooking check compares against. */
  readonly capacity: number;
  readonly floor: string | null;
  readonly description: string | null;
}

export interface CreateRoomInput {
  readonly eventId: string;
  readonly name: string;
  readonly capacity: number;
  readonly floor: string | null;
  readonly description: string | null;
}

export interface RoomRepository {
  findByEvent(eventId: string): Promise<readonly RoomRecord[]>;
  create(input: CreateRoomInput): Promise<RoomRecord>;
}

export const ROOM_REPOSITORY = Symbol('TREFARO_ROOM_REPOSITORY');
