/**
 * Payloads of the personal programme plug-in (FR 3.17, P3).
 *
 * In `shared-models` like the other four plug-ins', and for the same reason: a
 * client that loads a plug-in's bundle shares the **models** with it, never the
 * implementation. The plug-in's server DTOs implement these interfaces, so a
 * field that drifts is a build error rather than a failed request.
 *
 * The plug-in's key and its catalogue namespace are declared by its server
 * descriptor; what lives here is only what travels over HTTP.
 */

/** The plug-in's stable key — also its `module_config.module_key`. */
export const PERSONAL_PROGRAM_MODULE_KEY = 'personal-program';

/**
 * One session of an event, with the reader's own mark on it (E55).
 *
 * The whole programme travels, not just the selection: a plan one can only
 * read is a list one cannot change, and the screen that adds a session is the
 * screen that shows the ones not yet added. `inPlan` is what makes it personal.
 *
 * **`registrationEnabled` and `capacity` are about the session, never about
 * people.** They are here so a row can say where a *seat* is booked — which
 * this plug-in does not do (E55) and the event's programme does. What is
 * deliberately absent is the sign-up count: how full a workshop is belongs to
 * the organizer's plan (E50) and to the programme itself, and a personal plan
 * that showed it would be a second occupancy screen.
 */
export interface PersonalProgramItem {
  readonly programItemId: string;
  /**
   * The session's title, translated for the reader where somebody translated
   * it and the original where nobody has (E56, F95).
   */
  readonly title: string;
  /** ISO 8601 instants — rendered in the reader's own clock. */
  readonly startsAt: string;
  readonly endsAt: string;
  /** Whether this session asks who is coming (FR 3.10, F42). */
  readonly registrationEnabled: boolean;
  /** Seats, or `null` for "as many as come". Only ever set with sign-up on. */
  readonly capacity: number | null;
  /** Whether the reader has put this session in their plan. */
  readonly inPlan: boolean;
}
