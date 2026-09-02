/**
 * Port for participant accounts (FR 4.1, FR 4.3).
 *
 * The business layer knows this interface; the data access layer implements it.
 */

import type { CustomFieldValues } from '@trefaro/shared-models';

/** A participant as the business layer sees them — no ORM types. */
export interface UserProfileRecord {
  readonly id: string;
  /** Stored as entered, compared case-insensitively. The identity (E31). */
  readonly email: string;
  readonly passwordHash: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly preferredLocale: string;
  /**
   * Where the profile picture is kept, or `null` (F124).
   *
   * A stored path below `avatars/`, never handed out: what a client gets is the
   * URL of the media route, built from the id and `updatedAt`.
   */
  readonly avatarPath: string | null;
  /** What this person works on, as free text (E36). */
  readonly activityAreas: string | null;
  /** The answers to the instance's profile questions, by field key (E35). */
  readonly customFields: CustomFieldValues;
  /** Whether this profile may be found and written to (E37, F13). */
  readonly searchable: boolean;
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
 * Two fields are absent on purpose, for two different reasons:
 *
 * - **`email`**, because the address is the identity (E31). The registrations of
 *   a person are found by it, and changing it would cut the history rather than
 *   carry it along.
 * - **`avatarPath`**, because a form that can empty a path column empties it by
 *   accident eventually (F116). The picture is written through
 *   {@link UserProfileRepository.setAvatarPath}, which is the only caller that
 *   also knows whether the file behind the old path still has to go.
 *
 * Every field here is optional, and an absent one means "leave it alone". The
 * two that may be cleared say so in their type: `activityAreas` takes `null`
 * for "no longer stated", and so does `customFields` — as an empty object.
 */
export interface UserProfileChanges {
  readonly passwordHash?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly preferredLocale?: string;
  readonly activityAreas?: string | null;
  readonly customFields?: CustomFieldValues;
  readonly searchable?: boolean;
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
  /**
   * Points the profile at a stored picture, or at none (F124, F116).
   *
   * Its own method rather than a field of {@link UserProfileChanges}, the same
   * cut `setLogoPath` makes: the column names a file in the upload volume, so
   * every write to it has a file to write or unlink beside it, and it must not
   * be reachable from a form that saves whatever it happens to hold.
   *
   * `null` when the account was already gone; otherwise the row as it now is,
   * with the `updatedAt` the picture's `?v=` is built from.
   */
  setAvatarPath(
    id: string,
    storedPath: string | null,
  ): Promise<UserProfileRecord | null>;
}

export const USER_PROFILE_REPOSITORY = Symbol(
  'TREFARO_USER_PROFILE_REPOSITORY',
);
