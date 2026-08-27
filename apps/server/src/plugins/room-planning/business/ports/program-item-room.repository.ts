/**
 * Port for the room a session happens in (F21).
 *
 * The plug-in's own join table, behind the plug-in's own port — the same
 * layering inside the plug-in as the server has outside it. Nothing here knows
 * what a programme item *is*; it stores an id the business logic has already
 * checked through the host's read port (E12).
 */

/** One assignment: this session, in this room. */
export interface ProgramItemRoomRecord {
  readonly programItemId: string;
  readonly roomId: string;
  readonly createdAt: Date;
}

export interface ProgramItemRoomRepository {
  /** The sessions assigned to one room, oldest assignment first. */
  findByRoom(roomId: string): Promise<readonly ProgramItemRoomRecord[]>;
  /** Every assignment of one session — a session may use more than one room. */
  findByProgramItem(
    programItemId: string,
  ): Promise<readonly ProgramItemRoomRecord[]>;
  /**
   * Assigns a room to a session.
   *
   * Idempotent: the pair is the primary key, and assigning what is already
   * assigned is the same fact stated twice, not an error.
   */
  assign(programItemId: string, roomId: string): Promise<void>;
  /** False when there was no such assignment. */
  unassign(programItemId: string, roomId: string): Promise<boolean>;
}

export const PROGRAM_ITEM_ROOM_REPOSITORY = Symbol(
  'TREFARO_PROGRAM_ITEM_ROOM_REPOSITORY',
);
