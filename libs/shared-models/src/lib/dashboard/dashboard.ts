import type { OrganizerEvent } from '../events/event';
import type { MediaLinkSummary } from '../media-links/media-link';
import type {
  ParticipantRow,
  RegistrationCounts,
} from '../registrations/participant';

/**
 * The dashboard of one event (FR 3.8, UC 05).
 *
 * The mockups draw it as KPI tiles that are links, plus a table of the latest
 * registrations — the organizer's home for a single event. Three decisions are
 * baked into the shape below:
 *
 * 1. **One request, one screen.** Everything the dashboard shows arrives
 *    together, so the tiles do not appear one after another as four requests
 *    come back. It also keeps the client from downloading rows in order to count
 *    them: the numbers are counted where the data is (E13's "count instead of
 *    read" rule applies to summaries as much as to tables).
 * 2. **No tile for a module that does not exist yet.** The mockup's tiles for
 *    new messages (phase 3) and for programme proposals and the forum (phase 4)
 *    are absent from this type rather than present as a hard zero. A zero is a
 *    statement about data; "no such tile" is the truth while the module is not
 *    built, and a dashboard full of zeros teaches an organizer to ignore it.
 * 3. **The latest registrations are rows, not a second page of the table.** Five
 *    of them, newest first, with the e-mail address in the row — the same
 *    correction from the thesis' usability test that gave the participant
 *    overview its e-mail column (E13) applies here too.
 */

/** What the programme tile says (FR 3.7, FR 3.10). */
export interface ProgramSummary {
  /** Sessions in the programme. */
  readonly items: number;
  /** Of those, how many ask who is coming. */
  readonly withSignup: number;
  /** Seats claimed across the whole programme. */
  readonly signups: number;
}

/** What the registration form tile says (F12). */
export interface RegistrationFormSummary {
  /** Questions an organizer added beyond the standard fields. */
  readonly questions: number;
  readonly required: number;
}

/** Everything one dashboard renders. */
export interface EventDashboard {
  readonly event: OrganizerEvent;
  /**
   * Public address of the series this event is in.
   *
   * Needed to show the address participants are given, which is nested because
   * slugs are unique per parent rather than globally (E7, F28) — see
   * {@link publicEventPath}.
   */
  readonly seriesSlug: string;
  /** Of the whole event, by status — what the participants tile counts. */
  readonly registrations: RegistrationCounts;
  /** Newest first, at most {@link DASHBOARD_LATEST_REGISTRATIONS} of them. */
  readonly latestRegistrations: readonly ParticipantRow[];
  readonly program: ProgramSummary;
  readonly form: RegistrationFormSummary;
  /**
   * The media links of this event, or `null` when the module is switched off.
   *
   * `null` rather than four zeros, and that is rule 2 above applied to a module
   * that *can* exist: an organization that switched `media-links` off (FR 1.5)
   * gets no tile, because a tile leading to an API that answers 404 (F53) would
   * be a dead end drawn as a feature.
   */
  readonly mediaLinks: MediaLinkSummary | null;
}

/**
 * How many recent registrations the dashboard lists.
 *
 * Few on purpose: the point of the table is "who arrived since I last looked",
 * and the participant overview is one click away for everything else.
 */
export const DASHBOARD_LATEST_REGISTRATIONS = 5;
