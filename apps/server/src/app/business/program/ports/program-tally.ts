/**
 * Counts about one event's programme — no rows.
 *
 * Deliberately separate from {@link ProgramItemRepository}, and for the same
 * reason {@link RegistrationTally} is separate from the registration repository:
 * the dashboard (FR 3.8) needs three numbers, and reading a whole programme to
 * arrive at them would mean fetching up to three hundred sessions with their
 * abstracts to answer "how many".
 *
 * Where this line runs: a port exists once the rows are large or unbounded.
 * Registrations are unbounded and programme items carry two kilobytes of
 * abstract each, so both have a tally; the registration *field definitions* are
 * capped at thirty tiny rows and the form editor reads them anyway, so counting
 * those in the business layer is honest rather than wasteful.
 */

/** What the programme tile of the dashboard says. */
export interface ProgramCounts {
  readonly items: number;
  /** Of those, how many ask who is coming (FR 3.10). */
  readonly withSignup: number;
  /** Seats claimed across the whole programme. */
  readonly signups: number;
}

export interface ProgramTally {
  /** Zeroes for an event without a programme, never `null`. */
  countForEvent(eventId: string): Promise<ProgramCounts>;
}

export const PROGRAM_TALLY = Symbol('TREFARO_PROGRAM_TALLY');
