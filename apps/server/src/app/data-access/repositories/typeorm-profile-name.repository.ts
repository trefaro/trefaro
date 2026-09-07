import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, IsNull, Repository } from 'typeorm';
import type {
  ProfileNameRecord,
  ProfileNameRepository,
} from '../../business/profiles/ports/profile-name.repository';
import { UserProfileEntity } from '../entities';

/**
 * PostgreSQL implementation of {@link ProfileNameRepository} (E58).
 *
 * Two rules live in the statement rather than in a caller (F152):
 *
 * - **Only confirmed accounts.** An unconfirmed address has not answered, so the
 *   name on it is not yet known to belong to anybody (E32) — and somebody could
 *   otherwise register a stranger's address and have that stranger's name appear
 *   under a forum post.
 * - **Only the four columns a name and a picture need.** No address, no password
 *   hash, no `searchable`: the select list is the access rule, so no amount of
 *   refactoring above this line can widen it.
 *
 * An empty id list is answered without asking the database — `IN ()` is not
 * valid SQL, and a list of nothing has no rows either way.
 */
@Injectable()
export class TypeormProfileNameRepository implements ProfileNameRepository {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly repository: Repository<UserProfileEntity>,
  ) {}

  async findNames(
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, ProfileNameRecord>> {
    const wanted = [...new Set(ids)];
    if (wanted.length === 0) return new Map();

    const rows = await this.repository.find({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarPath: true,
        updatedAt: true,
      },
      where: { id: In(wanted), confirmedAt: Not(IsNull()) },
    });

    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          avatarPath: row.avatarPath,
          updatedAt: row.updatedAt,
        },
      ]),
    );
  }
}
