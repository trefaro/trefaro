import type {
  ParticipantSort,
  RegistrationCounts,
  RegistrationStatus,
  RegistrationWeek,
  SortDirection,
} from '@trefaro/shared-models';

/**
 * Port for event registrations (FR 3.5).
 *
 * The business layer knows this interface; the data access layer implements it.
 * One rule is delegated to the database on purpose: a registration is unique per
 * event and address (E10), and only a unique index can say that without losing
 * a race between two simultaneous submissions of the same form.
 */

/** A registration row in business-layer terms — no ORM types. */
export interface RegistrationRecord {
  readonly id: string;
  readonly eventId: string;
  /** Stored lower-cased and trimmed; see `NewRegistration.email`. */
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly origin: string | null;
  readonly status: RegistrationStatus;
  readonly newsletterOptIn: boolean;
  /** Set once the participant objects to being invited again (E15). */
  readonly contactOptOut: boolean;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewRegistration {
  readonly eventId: string;
  /**
   * Already normalized by the service.
   *
   * Comparing addresses case-insensitively is not optional — someone who typed
   * `Anna@example.org` and later `anna@example.org` is one person, and two rows
   * would show up as two participants in the overview that FR 3.3 calls the most
   * important screen in the product.
   */
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly origin: string | null;
  readonly status: RegistrationStatus;
  readonly newsletterOptIn: boolean;
}

/** Only the fields actually given are written. */
export interface RegistrationChanges {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string | null;
  readonly origin?: string | null;
  readonly status?: RegistrationStatus;
  readonly newsletterOptIn?: boolean;
  readonly contactOptOut?: boolean;
  readonly confirmedAt?: Date | null;
}

/** Raised when this address is already registered for this event (E10). */
export class RegistrationExistsError extends Error {
  constructor(
    readonly eventId: string,
    readonly email: string,
  ) {
    super('This address is already registered for this event');
    this.name = 'RegistrationExistsError';
  }
}

/**
 * What the participant overview asks the database for (FR 3.3).
 *
 * Deliberately not the client's query object: the service has already resolved
 * the defaults, clamped the page size and split the search into words, so the
 * data access layer receives something it can translate into SQL without making
 * a single product decision.
 */
export interface RegistrationSearch {
  readonly eventId: string;
  /**
   * Words that must *all* match, each of them in first name, last name or
   * e-mail. Already trimmed and lower-cased; an empty array means no filter.
   */
  readonly terms: readonly string[];
  readonly status: RegistrationStatus | null;
  readonly sort: ParticipantSort;
  readonly direction: SortDirection;
  readonly offset: number;
  readonly limit: number;
}

/** One page, plus how many rows the filter matched in total. */
export interface RegistrationSlice {
  readonly rows: readonly RegistrationRecord[];
  readonly total: number;
}

export interface RegistrationRepository {
  findById(id: string): Promise<RegistrationRecord | null>;
  /** Case-insensitive; the caller passes a normalized address. */
  findByEventAndEmail(
    eventId: string,
    email: string,
  ): Promise<RegistrationRecord | null>;
  /** @throws RegistrationExistsError */
  create(registration: NewRegistration): Promise<RegistrationRecord>;
  /** `null` when no registration has that id. */
  update(
    id: string,
    changes: RegistrationChanges,
  ): Promise<RegistrationRecord | null>;
  /** False when the registration was already gone. */
  delete(id: string): Promise<boolean>;
  /** One page of one event's registrations, filtered, sorted and counted. */
  search(query: RegistrationSearch): Promise<RegistrationSlice>;
  /** All four numbers of one event in one query, whatever the table filter is. */
  countByStatus(eventId: string): Promise<RegistrationCounts>;
  /**
   * Registrations per calendar week, oldest first, weeks without any omitted.
   *
   * The week is cut in `timezone`, the event's own zone (E8): an organizer in
   * Cologne reading a graph of a Nairobi event still wants the weeks the event
   * lives in, and a registration at 00:30 local time must not count towards the
   * previous week because the server happens to run on UTC.
   */
  weeklyTotals(
    eventId: string,
    timezone: string,
  ): Promise<readonly RegistrationWeek[]>;
}

export const REGISTRATION_REPOSITORY = Symbol(
  'TREFARO_REGISTRATION_REPOSITORY',
);
