/**
 * Port for the programme of an event (FR 3.7).
 *
 * The business layer knows this interface; the data access layer implements it.
 * Two things are deliberately *not* here:
 *
 * - **No room.** The room a session happens in belongs to the room planning
 *   plug-in's own join table (F21), and this port has no idea rooms exist.
 * - **No reorder.** A programme is ordered by the clock, not by a position
 *   somebody maintains (F40) — moving a session means changing its time, which
 *   is an ordinary update.
 */

/** A programme item in business-layer terms — no ORM types. */
export interface ProgramItemRecord {
  readonly id: string;
  readonly eventId: string;
  readonly title: string;
  readonly description: string | null;
  readonly speaker: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewProgramItem {
  readonly eventId: string;
  readonly title: string;
  readonly description: string | null;
  readonly speaker: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/** Only the fields actually given are written. */
export interface ProgramItemChanges {
  readonly title?: string;
  readonly description?: string | null;
  readonly speaker?: string | null;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
}

export interface ProgramItemRepository {
  /**
   * One event's programme in the order it happens.
   *
   * `(starts_at, ends_at, id)` — the id last, so two parallel sessions never
   * swap between two reads.
   */
  findByEvent(eventId: string): Promise<readonly ProgramItemRecord[]>;
  findById(id: string): Promise<ProgramItemRecord | null>;
  create(item: NewProgramItem): Promise<ProgramItemRecord>;
  /** `null` when no item has that id. */
  update(
    id: string,
    changes: ProgramItemChanges,
  ): Promise<ProgramItemRecord | null>;
  /** False when the item was already gone. */
  delete(id: string): Promise<boolean>;
}

export const PROGRAM_ITEM_REPOSITORY = Symbol(
  'TREFARO_PROGRAM_ITEM_REPOSITORY',
);
