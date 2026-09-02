/**
 * Port for participant accounts (FR 4.1, FR 4.3).
 *
 * The business layer knows this interface; the data access layer implements it.
 */

/** A participant as the business layer sees them — no ORM types. */
export interface UserProfileRecord {
  readonly id: string;
  /** Stored as entered, compared case-insensitively. The identity (E31). */
  readonly email: string;
  readonly passwordHash: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly preferredLocale: string;
  /** `null` while the double opt-in is still outstanding (E32). */
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewUserProfile {
  readonly email: string;
  readonly passwordHash: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly preferredLocale: string;
}

/**
 * What may still change about an account.
 *
 * `email` is absent on purpose: the address is the identity (E31), the
 * registrations of a person are found by it, and changing it would cut the
 * history rather than carry it along. Every field is optional, and an absent one
 * means "leave it alone" — never "set it to null".
 */
export interface UserProfileChanges {
  readonly passwordHash?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly preferredLocale?: string;
  readonly confirmedAt?: Date;
}

/**
 * Raised by {@link UserProfileRepository.create} when the address already has an
 * account. A business-layer error on purpose: uniqueness is a rule of the domain
 * that happens to be enforced by an index — and the rule here is E31, not a
 * detail of PostgreSQL.
 */
export class ProfileEmailTakenError extends Error {
  constructor(readonly email: string) {
    super(`An account for the address "${email}" already exists`);
    this.name = 'ProfileEmailTakenError';
  }
}

export interface UserProfileRepository {
  findById(id: string): Promise<UserProfileRecord | null>;
  /** Case-insensitive: an address is one address regardless of spelling. */
  findByEmail(email: string): Promise<UserProfileRecord | null>;
  /** @throws ProfileEmailTakenError */
  create(profile: NewUserProfile): Promise<UserProfileRecord>;
  /** `null` when the account was already gone. */
  update(
    id: string,
    changes: UserProfileChanges,
  ): Promise<UserProfileRecord | null>;
}

export const USER_PROFILE_REPOSITORY = Symbol(
  'TREFARO_USER_PROFILE_REPOSITORY',
);
