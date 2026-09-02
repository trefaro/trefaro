import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  ProfileEmailTakenError,
  type NewUserProfile,
  type UserProfileChanges,
  type UserProfileRecord,
  type UserProfileRepository,
} from '../../business/profiles/ports/user-profile.repository';
import { UserProfileEntity } from '../entities';

/** PostgreSQL's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/** PostgreSQL implementation of {@link UserProfileRepository}. */
@Injectable()
export class TypeormUserProfileRepository implements UserProfileRepository {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly repository: Repository<UserProfileEntity>,
  ) {}

  async findById(id: string): Promise<UserProfileRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findByEmail(email: string): Promise<UserProfileRecord | null> {
    // Matches the functional unique index from the migration, so the lookup and
    // the constraint agree on what "the same address" means (E31).
    const row = await this.repository
      .createQueryBuilder('profile')
      .where('lower(profile.email) = lower(:email)', { email })
      .getOne();
    return row ? toRecord(row) : null;
  }

  async create(profile: NewUserProfile): Promise<UserProfileRecord> {
    try {
      const saved = await this.repository.save(
        this.repository.create({
          email: profile.email,
          passwordHash: profile.passwordHash,
          firstName: profile.firstName,
          lastName: profile.lastName,
          preferredLocale: profile.preferredLocale,
          confirmedAt: null,
        }),
      );
      return toRecord(saved);
    } catch (error: unknown) {
      // Checking first and inserting second would still lose a race; the
      // constraint is the authority, so the error is translated instead.
      if (isUniqueViolation(error)) {
        throw new ProfileEmailTakenError(profile.email);
      }
      throw error;
    }
  }

  async update(
    id: string,
    changes: UserProfileChanges,
  ): Promise<UserProfileRecord | null> {
    // An absent field means "leave it alone", so nothing is written for it —
    // `update` with an undefined value would be TypeORM ignoring it anyway, and
    // an explicit filter says so where a reader can see it.
    const patch: Partial<UserProfileEntity> = {};
    if (changes.passwordHash !== undefined) {
      patch.passwordHash = changes.passwordHash;
    }
    if (changes.firstName !== undefined) patch.firstName = changes.firstName;
    if (changes.lastName !== undefined) patch.lastName = changes.lastName;
    if (changes.preferredLocale !== undefined) {
      patch.preferredLocale = changes.preferredLocale;
    }
    if (changes.confirmedAt !== undefined) {
      patch.confirmedAt = changes.confirmedAt;
    }

    if (Object.keys(patch).length > 0) {
      const result = await this.repository.update({ id }, patch);
      if ((result.affected ?? 0) === 0) return null;
    }
    return this.findById(id);
  }
}

function isUniqueViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : (error as { code?: string } | undefined);
  return driverError?.code === UNIQUE_VIOLATION;
}

function toRecord(row: UserProfileEntity): UserProfileRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    firstName: row.firstName,
    lastName: row.lastName,
    preferredLocale: row.preferredLocale,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
