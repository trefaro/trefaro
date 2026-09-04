import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProfileEmailTakenError,
  type NewUserProfile,
  type UserProfileChanges,
  type UserProfileRecord,
  type UserProfileRepository,
} from '../../business/profiles/ports/user-profile.repository';
import { UserProfileEntity } from '../entities';
import { isUniqueViolation } from './unique-violation';

/** PostgreSQL implementation of {@link UserProfileRepository}. */
@Injectable()
export class TypeormUserProfileRepository implements UserProfileRepository {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly repository: Repository<UserProfileEntity>,
  ) {}

  async findById(id: string): Promise<UserProfileRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toUserProfileRecord(row) : null;
  }

  async findByEmail(email: string): Promise<UserProfileRecord | null> {
    // Matches the functional unique index from the migration, so the lookup and
    // the constraint agree on what "the same address" means (E31).
    const row = await this.repository
      .createQueryBuilder('profile')
      .where('lower(profile.email) = lower(:email)', { email })
      .getOne();
    return row ? toUserProfileRecord(row) : null;
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
      return toUserProfileRecord(saved);
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
    if (changes.activityAreas !== undefined) {
      patch.activityAreas = changes.activityAreas;
    }
    if (changes.customFields !== undefined) {
      // Copied, because the port hands the answers over as `readonly` and
      // TypeORM writes into the object it is given.
      patch.customFields = { ...changes.customFields };
    }
    if (changes.searchable !== undefined) patch.searchable = changes.searchable;
    if (changes.confirmedAt !== undefined) {
      patch.confirmedAt = changes.confirmedAt;
    }

    if (Object.keys(patch).length > 0) {
      const result = await this.repository.update({ id }, patch);
      if ((result.affected ?? 0) === 0) return null;
    }
    return this.findById(id);
  }

  /**
   * Points the profile at a stored picture, or at none (F124).
   *
   * Through `update`, which also moves `updated_at` — and the picture's `?v=`
   * is built from that timestamp, so the URL changes exactly when the bytes do.
   * That is what lets the media route serve them `immutable` for a year.
   */
  async setAvatarPath(
    id: string,
    storedPath: string | null,
  ): Promise<UserProfileRecord | null> {
    const result = await this.repository.update(
      { id },
      { avatarPath: storedPath },
    );
    if ((result.affected ?? 0) === 0) return null;
    return this.findById(id);
  }
}

/**
 * One row as the business layer sees it.
 *
 * Exported because the session repository resolves a session and its owner in
 * one query and has to map the same entity — and a second copy of this function
 * is a copy that forgets the next column.
 */
export function toUserProfileRecord(row: UserProfileEntity): UserProfileRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    firstName: row.firstName,
    lastName: row.lastName,
    preferredLocale: row.preferredLocale,
    avatarPath: row.avatarPath,
    activityAreas: row.activityAreas,
    customFields: row.customFields ?? {},
    searchable: row.searchable,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
