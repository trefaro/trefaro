/**
 * What a plug-in may learn about the core programme (E12).
 *
 * The room planning plug-in needs two things for the overbooking check of
 * FR 3.10: which event a session belongs to and when it runs, and how many people
 * have signed up for it. It may not have them the obvious way — a plug-in owns
 * its own tables and reads nothing else (F21) — so the contract publishes them
 * as a port, and the host binds it to the core programme module.
 *
 * Narrow on purpose. There is no title here, no abstract, no speaker and above
 * all no participant: a room plan does not need to know who is coming to a
 * workshop, only how many. Every field below is one the check cannot be written
 * without, and adding one is a minor version of this contract.
 *
 * Added in plug-in API 1.1.0. A plug-in built against 1.0.0 keeps working and
 * simply never asks — which is what the minor step means.
 */

/** One session, in the shape the overbooking check needs it. */
export interface PluginProgramItem {
  readonly id: string;
  /** Which event it belongs to: a room of another event is not a candidate. */
  readonly eventId: string;
  /** Absolute instants. Two sessions in one room may not overlap in time. */
  readonly startsAt: string;
  readonly endsAt: string;
  /** The session's own limit, if it has one — not the room's. */
  readonly capacity: number | null;
}

export interface PluginProgramReads {
  /** `null` when no session has that id. */
  findItem(itemId: string): Promise<PluginProgramItem | null>;
  /**
   * Sign-ups per session id, in one query.
   *
   * Ids with no sign-ups are absent from the map rather than present with a
   * zero, so a caller reads it with a default and an absent key stays the honest
   * answer for "nobody yet".
   */
  countSignups(
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>>;
}

/**
 * Injection token for {@link PluginProgramReads}.
 *
 * Published by the plug-in host module, which is global — so a plug-in injects
 * this symbol without importing a single core module. That is the point: the
 * plug-in depends on the contract, never on the implementation behind it.
 */
export const PLUGIN_PROGRAM_READS = Symbol('TREFARO_PLUGIN_PROGRAM_READS');
