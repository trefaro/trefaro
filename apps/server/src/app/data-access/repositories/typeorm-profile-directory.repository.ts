import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ProfileDirectory } from '../../business/common/ports/profile-directory.port';
import { UserProfileEntity } from '../entities';

/**
 * PostgreSQL implementation of {@link ProfileDirectory}.
 *
 * The two queries that take an address compare `lower(email)`, which is what
 * the functional unique index of the table is built on (E31) — so the lookup
 * and the constraint agree on what "the same address" means, and neither of
 * them has to be told twice. The third takes an id and hands the address back
 * as it was typed: the registration side lower-cases what it compares, and a
 * port that pre-normalized would be normalizing for a caller it cannot see.
 */
@Injectable()
export class TypeormProfileDirectory implements ProfileDirectory {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly repository: Repository<UserProfileEntity>,
  ) {}

  async withAccount(emails: readonly string[]): Promise<ReadonlySet<string>> {
    // An empty page asks nothing: `IN ()` is not valid SQL, and a query that
    // can only come back empty is a round trip for nothing.
    if (emails.length === 0) return new Set();

    const wanted = new Map(
      emails.map((email) => [email.trim().toLowerCase(), email] as const),
    );

    const rows = await this.repository
      .createQueryBuilder('profile')
      .select('lower(profile.email)', 'email')
      .where('lower(profile.email) IN (:...addresses)', {
        addresses: [...wanted.keys()],
      })
      // Confirmed only — see the port: an account whose double opt-in is
      // outstanding cannot be logged into (E32).
      .andWhere('profile.confirmed_at IS NOT NULL')
      .getRawMany<{ email: string }>();

    // Answered in the caller's spelling, so a page of registrations can be
    // matched against this set without normalizing a second time.
    return new Set(rows.map((row) => wanted.get(row.email)).filter(isAddress));
  }

  async addressOf(participantId: string): Promise<string | null> {
    const row = await this.repository
      .createQueryBuilder('profile')
      .select('profile.email', 'email')
      .where('profile.id = :id', { id: participantId })
      // Confirmed only, and in the statement (F152, E32): the caller that
      // forgot it would be handing out registrations to an address nobody has
      // proven they hold.
      .andWhere('profile.confirmed_at IS NOT NULL')
      .getRawOne<{ email: string }>();

    return row?.email ?? null;
  }

  async localeFor(email: string): Promise<string | null> {
    const row = await this.repository
      .createQueryBuilder('profile')
      .select('profile.preferred_locale', 'locale')
      .where('lower(profile.email) = lower(:email)', { email })
      .getRawOne<{ locale: string | null }>();

    // Trimmed to nothing counts as nothing: the column is `NOT NULL`, so a
    // blank value would otherwise travel on as a language tag.
    const locale = row?.locale?.trim();
    return locale ? locale : null;
  }
}

function isAddress(value: string | undefined): value is string {
  return value !== undefined;
}
