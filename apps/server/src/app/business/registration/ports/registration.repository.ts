import type { RegistrationStatus } from '@trefaro/shared-models';

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
}

export const REGISTRATION_REPOSITORY = Symbol('TREFARO_REGISTRATION_REPOSITORY');
