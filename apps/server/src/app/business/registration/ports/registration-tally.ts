/**
 * Counts of confirmed registrations — nothing else.
 *
 * Deliberately separate from {@link RegistrationRepository}: the events and
 * series modules need these numbers to enforce E14 ("a series or event with
 * confirmed registrations may only be archived"), and they must not gain the
 * ability to read participant data on the way. A narrow port is also the honest
 * description of what they are allowed to know — how many, not who.
 */
export interface RegistrationTally {
  confirmedForEvent(eventId: string): Promise<number>;
  /** Across every event of the series. */
  confirmedForSeries(seriesId: string): Promise<number>;
}

export const REGISTRATION_TALLY = Symbol('TREFARO_REGISTRATION_TALLY');
