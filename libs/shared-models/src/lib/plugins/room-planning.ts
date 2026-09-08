/**
 * Payloads of the room planning plug-in (FR 3.11, FR 3.6, F14).
 *
 * In `shared-models` like the proposals' and the forum's, and for the same
 * reason: a client that loads a plug-in's bundle shares the **models** with it,
 * never the implementation. The plug-in's server DTOs implement these
 * interfaces, so a change to the contract breaks a build rather than a request.
 *
 * The plug-in's key and its catalogue namespace are declared by its server
 * descriptor; what lives here is only what travels over HTTP.
 */

/** The plug-in's stable key — also its `module_config.module_key`. */
export const ROOM_PLANNING_MODULE_KEY = 'room-planning';

export const MAX_ROOM_NAME_LENGTH = 128;
export const MAX_ROOM_FLOOR_LENGTH = 64;
export const MAX_ROOM_DESCRIPTION_LENGTH = 2000;
/**
 * An upper bound keeps a typo from turning into an overbooking check that
 * never triggers.
 */
export const MAX_ROOM_CAPACITY = 100_000;

/** A room of an event's venue, with the seats the overbooking check compares. */
export interface Room {
  readonly id: string;
  readonly eventId: string;
  readonly name: string;
  readonly capacity: number;
  readonly floor: string | null;
  readonly description: string | null;
}

/** What an organizer sends to add a room. */
export interface NewRoom {
  readonly name: string;
  readonly capacity: number;
  readonly floor?: string | null;
  readonly description?: string | null;
}

/**
 * What an organizer sends to change a room: only the fields given are written.
 *
 * `null` for the floor or the description clears it; leaving a field out keeps
 * it — the same reading `PATCH` has everywhere else in this application.
 */
export interface RoomChanges {
  readonly name?: string;
  readonly capacity?: number;
  readonly floor?: string | null;
  readonly description?: string | null;
}

/**
 * The two things a room plan warns about (E50).
 *
 * `overbooked`: more people signed up for a session than the rooms it uses
 * have chairs. `double-booked`: two sessions in the same room at the same
 * time. Both are **computed when the plan is read** and stored nowhere, both
 * are shown at the session and at the room — and neither refuses anything.
 * A tool that refuses a room gets worked around ("Saal A (2)"), and then the
 * truth is no longer in it.
 */
export const ROOM_WARNINGS = ['overbooked', 'double-booked'] as const;
export type RoomWarning = (typeof ROOM_WARNINGS)[number];

/**
 * A session as the room plan names it.
 *
 * Four fields, read through the host's port (E12, E56): enough to put a name
 * on a time slot, and nothing about who is coming. The title is the original
 * for an organizer and translated for a participant who asked in their
 * language.
 */
export interface PlannedSession {
  readonly programItemId: string;
  readonly title: string;
  /** ISO 8601 instants, rendered in the event's zone (E8). */
  readonly startsAt: string;
  readonly endsAt: string;
}

/** A session in a room, with the numbers behind its warnings. */
export interface RoomBooking extends PlannedSession {
  /** The session's own limit, if it set one — not the room's. */
  readonly itemCapacity: number | null;
  /** Sign-ups, read through the port (F45) — never from a core table. */
  readonly signupCount: number;
  readonly warnings: readonly RoomWarning[];
}

/**
 * One room with what happens in it, in clock order (F40).
 *
 * The room's own warnings are the union of its bookings' warnings: an organizer
 * scanning the plan sees at the room that something in it needs a look, and at
 * the session what it is.
 */
export interface PlannedRoom {
  readonly room: Room;
  readonly bookings: readonly RoomBooking[];
  readonly warnings: readonly RoomWarning[];
}

/**
 * The whole plan of one event, as the organizer's editor reads it (FR 3.11).
 *
 * `sessions` is **every** session of the event, assigned or not: the editor
 * offers them when a room is to be filled, and a session without a room is
 * exactly the one it has to offer. One request for the screen (F49).
 */
export interface RoomPlan {
  readonly rooms: readonly PlannedRoom[];
  readonly sessions: readonly PlannedSession[];
}

/**
 * A room as a participant reads it, without a login (FR 3.6, E58).
 *
 * A room name is not a person, so the plan stays public — the reasoned
 * counter-example to the proposals and the forum (F192). What it deliberately
 * lacks is every number about people: no sign-up counts and no warnings. Those
 * are the organizer's, and a public plan that showed them would tell a visitor
 * how full a workshop is before they decided to come.
 */
export interface PublicRoom {
  readonly id: string;
  readonly name: string;
  readonly capacity: number;
  readonly floor: string | null;
  readonly description: string | null;
  readonly bookings: readonly PlannedSession[];
}
