/**
 * What a plug-in may learn about the core programme (E12).
 *
 * The room planning plug-in needs two things for the overbooking check of
 * FR 3.10: which event a session belongs to and when it runs, and how many people
 * have signed up for it. It may not have them the obvious way — a plug-in owns
 * its own tables and reads nothing else (F21) — so the contract publishes them
 * as a port, and the host binds it to the core programme module.
 *
 * Narrow on purpose. There is no abstract here, no speaker and above all no
 * participant: a room plan does not need to know who is coming to a workshop,
 * only how many. Every field below is one a plug-in's screen cannot be drawn
 * without, and adding one is a minor version of this contract.
 *
 * Added in plug-in API 1.1.0 with five fields and two methods. **1.2.0 adds the
 * title and {@link PluginProgramReads.listForEvent}** (E56): a room plan that
 * names its time slots needs the title, and an editor that fills a room needs
 * the event's sessions to choose from — neither can be had by id alone. The
 * title is the one field F45 left out, and it comes in under E56's rule: a
 * plug-in reads it **translated when a participant is reading**, and the
 * original otherwise. A plug-in built against 1.1.0 keeps working and simply
 * never asks — which is what the minor step means.
 *
 * **1.2.0 also adds `registrationEnabled`** (AP 9, E55). A personal programme
 * plan reserves nothing, and the one thing that keeps it from being read as if
 * it did is a mark on the sessions where a seat is actually booked — in the
 * event's programme, by FR 3.10. `capacity` alone cannot carry that mark: a
 * session may ask who is coming without limiting how many (F42), and such a
 * session would then look like one that asks nothing.
 *
 * What is **not** here is any read about one named person: how many signed up
 * is a number ({@link PluginProgramReads.countSignups}), and *who* did is the
 * core's business. A plug-in that could ask "does this account hold a seat"
 * would be reading a participant list through the back door.
 */

/** One session, in the shape the overbooking check needs it. */
export interface PluginProgramItem {
  readonly id: string;
  /** Which event it belongs to: a room of another event is not a candidate. */
  readonly eventId: string;
  /**
   * What the session is called (E56).
   *
   * The original, or the translation for the language a reader asked in — with
   * the core's field-by-field fallback (F95), so an untranslated session shows
   * its original rather than a gap.
   */
  readonly title: string;
  /** Absolute instants. Two sessions in one room may not overlap in time. */
  readonly startsAt: string;
  readonly endsAt: string;
  /**
   * Whether this session asks who is coming (FR 3.10, F42).
   *
   * The mark a personal plan needs (E55): where this is true, a seat is booked
   * in the event's programme, and nowhere else. Independent of `capacity` —
   * "as many as come" is a sign-up without a limit.
   */
  readonly registrationEnabled: boolean;
  /** The session's own limit, if it has one — not the room's. */
  readonly capacity: number | null;
}

export interface PluginProgramReads {
  /**
   * `null` when no session has that id. The title is the original.
   *
   * **No `locale` here, and that is a decision** (AP 9). The plan of this
   * phase had one arriving with the personal programme; when the package came,
   * the only caller of `findItem` was a write that checks a session exists and
   * answers 204, and a parameter no caller passes is the pretence E21 was
   * written against. It stays available for the release that has a reader for
   * it — a translated single session is a screen nobody has asked for yet.
   */
  findItem(itemId: string): Promise<PluginProgramItem | null>;
  /**
   * Every session of one event, in the order the programme has them (F40).
   *
   * With `locale`, the titles are the translations for that language where
   * one exists — the participant's reading (E56). Without it, the originals:
   * an organizer works in the language of their instance. An unknown event is
   * an empty list, not an error; a plug-in that needs the 404 has the event's
   * id from a route that already gave one.
   */
  listForEvent(
    eventId: string,
    locale?: string,
  ): Promise<readonly PluginProgramItem[]>;
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
