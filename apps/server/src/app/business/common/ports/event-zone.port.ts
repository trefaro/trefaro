/**
 * The zone one event is read in (E8) — nothing else about it.
 *
 * An event's `starts_at` is an absolute instant and its `timezone` says where
 * that instant is meant to be read; the programme of both clients renders in
 * it, and since plug-in API 1.3.0 so does a plug-in (E69). The host's read port
 * stamps the zone onto every session it hands over, and to do that it needs one
 * field of one row.
 *
 * Deliberately not {@link EventRepository} handed to the plug-in seam. That
 * port creates, renames and deletes events, and the adapter that publishes
 * sessions to plug-ins has no business holding it — the same cut
 * {@link ProfileDirectory} makes against the profile repository and
 * {@link ProgramTally} against the programme's. One method, one field, and no
 * way to ask this port anything else.
 */
export interface EventZones {
  /**
   * The IANA zone of one event, or `null` when no event has that id.
   *
   * `null` is not a zone to fall back from: a session whose event cannot be
   * read is a session that is being deleted, and the host answers "nothing"
   * rather than inventing a clock for it.
   */
  zoneOf(eventId: string): Promise<string | null>;
}

export const EVENT_ZONES = Symbol('TREFARO_EVENT_ZONES');
