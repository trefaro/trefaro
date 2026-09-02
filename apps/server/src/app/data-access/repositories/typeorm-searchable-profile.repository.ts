import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import type {
  SearchableProfileRecord,
  SearchableProfileRepository,
  SearchableProfileSearch,
  SearchableProfileSlice,
} from '../../business/common/ports/searchable-profile.repository';
import { UserProfileEntity } from '../entities';

/**
 * PostgreSQL implementation of {@link SearchableProfileRepository} (FR 4.4).
 *
 * The opt-in is part of every statement here, never of a caller: both queries
 * start from {@link visible}, which is `searchable = true` **and** a confirmed
 * address. That is the whole privacy rule of E37 in one place — a profile that
 * did not say yes cannot be returned by this class, whatever it is asked.
 *
 * Confirmed as well as opted in, because an unconfirmed account is not yet
 * known to belong to anybody (E32): the address has not answered. Somebody
 * could otherwise register a stranger's address, tick `searchable` and have a
 * row with that stranger's name in the directory.
 *
 * The search itself is what F32 decided for the participant overview and F126
 * repeats here: one `ILIKE '%word%'` per word, `AND`-joined, no `pg_trgm`. A
 * database extension would buy milliseconds at the cost of an instance that a
 * small organization cannot install.
 */
@Injectable()
export class TypeormSearchableProfileRepository implements SearchableProfileRepository {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly repository: Repository<UserProfileEntity>,
  ) {}

  /**
   * One page of the directory (FR 4.4).
   *
   * Everything happens in SQL — the two filters, the sort, the count and the
   * window — for the reason the participant overview gives: a service that
   * reads every profile and slices the array afterwards is the version that
   * fails first at volume.
   */
  async search(
    query: SearchableProfileSearch,
  ): Promise<SearchableProfileSlice> {
    const builder = this.visible().andWhere('profile.id <> :viewer', {
      viewer: query.excludeId,
    });

    // One condition per word, all of them required: "amina okonkwo" finds the
    // person whichever order the two names are typed in.
    query.terms.forEach((term, index) => {
      const key = `term${index}`;
      builder.andWhere(
        `(profile.first_name ILIKE :${key}` +
          ` OR profile.last_name ILIKE :${key}` +
          ` OR profile.activity_areas ILIKE :${key})`,
        { [key]: contains(term) },
      );
    });

    // The second box narrows to the field of activity alone (E36) — how
    // somebody looks for a person they do not know by name.
    query.activityTerms.forEach((term, index) => {
      const key = `area${index}`;
      builder.andWhere(`profile.activity_areas ILIKE :${key}`, {
        [key]: contains(term),
      });
    });

    const [rows, total] = await builder
      .orderBy('profile.last_name', 'ASC')
      .addOrderBy('profile.first_name', 'ASC')
      // A unique tie-breaker, always last: without one, two people of the same
      // name can swap places between two pages and one of them disappears from
      // a list they are on.
      .addOrderBy('profile.id', 'ASC')
      .offset(query.offset)
      .limit(query.limit)
      .getManyAndCount();

    return { rows: rows.map(toRecord), total };
  }

  async findVisible(id: string): Promise<SearchableProfileRecord | null> {
    // The same three conditions as the list, which is the point of having them
    // in one place: the route that fetches a single profile is the one that
    // would otherwise forget the opt-in.
    const row = await this.visible()
      .andWhere('profile.id = :id', { id })
      .getOne();
    return row ? toRecord(row) : null;
  }

  /** Everything the directory may ever return — the opt-in of E37 as SQL. */
  private visible(): SelectQueryBuilder<UserProfileEntity> {
    return this.repository
      .createQueryBuilder('profile')
      .where('profile.searchable = true')
      .andWhere('profile.confirmed_at IS NOT NULL');
  }
}

/**
 * A term as a `LIKE` pattern, with the wildcards made literal.
 *
 * The twin of `escapeLike` in `typeorm-registration.repository.ts`, and
 * deliberately a second copy rather than a shared helper: two callers are two
 * callers, the third is where something moves out (F138). What must not drift
 * is the reason — without the escape, searching for `%` matches everybody and
 * searching for `_` matches every one-character difference, and a filter that
 * quietly stops filtering is worse than one that finds nothing.
 */
function contains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

function toRecord(row: UserProfileEntity): SearchableProfileRecord {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarPath: row.avatarPath,
    activityAreas: row.activityAreas,
    customFields: row.customFields,
    // The picture's `?v=` is built from this, so a new avatar is a new URL.
    updatedAt: row.updatedAt,
  };
}
