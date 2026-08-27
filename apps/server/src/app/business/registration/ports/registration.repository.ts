import type {
  CustomFieldValues,
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
  /** Answers to the event's configurable fields (F12), keyed by field key. */
  readonly customFields: CustomFieldValues;
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
  /** Already validated against this event's field definitions (F12). */
  readonly customFields: CustomFieldValues;
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
  readonly customFields?: CustomFieldValues;
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

/**
 * What the audience of an invitation is drawn from (FR 2.4, F24).
 *
 * Three of the filters are not the caller's to choose and are therefore not in
 * this type at all: confirmed only, this series only, and never an address that
 * has objected (E15). They are the rule, not a parameter — a query object that
 * could switch them off would be a query object somebody switches them off in.
 */
export interface SeriesContactSearch {
  readonly seriesId: string;
  /** Words that must *all* match, in first name, last name or address. */
  readonly terms: readonly string[];
  readonly offset: number;
  readonly limit: number;
}

/**
 * One address of a series, folded across every registration it has there.
 *
 * `registrationId` is the most recent of those registrations: the one whose
 * first name greets the person and whose id the objection link speaks for.
 */
export interface SeriesContactRecord {
  readonly registrationId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  /** How many events of this series this address is confirmed for. */
  readonly events: number;
  readonly lastRegisteredAt: Date;
}

export interface SeriesContactSlice {
  readonly rows: readonly SeriesContactRecord[];
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
  /**
   * One page of the addresses a series may invite, newest registration first.
   *
   * Folded by address rather than by row: somebody who attended three events of
   * the series is one contact, because they are one person and would otherwise
   * receive the invitation three times.
   */
  searchSeriesContacts(query: SeriesContactSearch): Promise<SeriesContactSlice>;
  /**
   * The subset of `registrationIds` that this series may actually invite.
   *
   * The same filter as {@link searchSeriesContacts}, without paging: what a
   * selection sent by a client is checked against, so an id that names a
   * registration of another series, an unconfirmed one or an address that has
   * objected simply is not in the answer (F55).
   */
  findSeriesContacts(
    seriesId: string,
    registrationIds: readonly string[],
  ): Promise<readonly SeriesContactRecord[]>;
  /**
   * Marks every registration of one address as not to be contacted again.
   *
   * Every row, across the whole instance (F57): the objection belongs to the
   * person, and a flag set on one registration would let the next series write
   * to them again. Returns how many rows were changed, which is how the caller
   * can tell an objection from a repeated one.
   */
  optOutByEmail(email: string): Promise<number>;
}

export const REGISTRATION_REPOSITORY = Symbol(
  'TREFARO_REGISTRATION_REPOSITORY',
);
