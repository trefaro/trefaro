/**
 * Port for room storage.
 *
 * A plug-in mirrors the server's layering internally: this interface is its
 * business layer, and `data-access/typeorm-room.repository.ts` implements it.
 * That is what lets the plug-in's business logic be tested without a database
 * and keeps its ORM usage in one place.
 *
 * What this port deliberately does *not* offer is a way to read a programme item.
 * A room hosts sessions, and the plug-in learns about them through the host's
 * versioned read port (E12) — never from a core table (F21).
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

/**
 * Raised when the event a room was to belong to does not exist.
 *
 * Since AP 9 the database says so: `event_id` carries a foreign key, which is the
 * integrity F21 argued the plug-in should not have to enforce by hand. The data
 * access layer translates the constraint violation into this error so the
 * business layer can answer with a 404 rather than a 500 — the driver's error
 * code stays where the ORM does.
 */
export class UnknownEventError extends Error {
  constructor(readonly eventId: string) {
    super('No event with that id');
    this.name = 'UnknownEventError';
  }
}

export interface RoomRepository {
  findByEvent(eventId: string): Promise<readonly RoomRecord[]>;
  findById(id: string): Promise<RoomRecord | null>;
  /** @throws UnknownEventError */
  create(input: CreateRoomInput): Promise<RoomRecord>;
}

export const ROOM_REPOSITORY = Symbol('TREFARO_ROOM_REPOSITORY');
