/**
 * Port for administrator accounts (FR 1.2).
 *
 * The business layer knows this interface; the data access layer implements it.
 */

/** An administrator as the business layer sees them — no ORM types. */
export interface AdminUserRecord {
  readonly id: string;
  /** Stored as entered, compared case-insensitively. */
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
}

export interface NewAdminUser {
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
}

/**
 * Raised by {@link AdminUserRepository.create} when the address already belongs
 * to an account. A business-layer error on purpose: uniqueness is a rule of the
 * domain that happens to be enforced by an index.
 */
export class AdminEmailTakenError extends Error {
  constructor(readonly email: string) {
    super(`An administrator with the address "${email}" already exists`);
    this.name = 'AdminEmailTakenError';
  }
}

export interface AdminUserRepository {
  count(): Promise<number>;
  findAll(): Promise<readonly AdminUserRecord[]>;
  findById(id: string): Promise<AdminUserRecord | null>;
  /** Case-insensitive: an address is one address regardless of spelling. */
  findByEmail(email: string): Promise<AdminUserRecord | null>;
  /** @throws AdminEmailTakenError */
  create(user: NewAdminUser): Promise<AdminUserRecord>;
  /** Returns false when the account was already gone. */
  delete(id: string): Promise<boolean>;
  recordLogin(id: string, at: Date): Promise<void>;
}

export const ADMIN_USER_REPOSITORY = Symbol('TREFARO_ADMIN_USER_REPOSITORY');
