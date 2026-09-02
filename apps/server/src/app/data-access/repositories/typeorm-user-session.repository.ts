import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import type {
  AuthenticatedParticipant,
  NewUserSession,
  UserSessionRepository,
} from '../../business/profiles/ports/user-session.repository';
import { UserSessionEntity } from '../entities';
import { toUserProfileRecord } from './typeorm-user-profile.repository';

/** PostgreSQL implementation of {@link UserSessionRepository}. */
@Injectable()
export class TypeormUserSessionRepository implements UserSessionRepository {
  constructor(
    @InjectRepository(UserSessionEntity)
    private readonly repository: Repository<UserSessionEntity>,
  ) {}

  async create(session: NewUserSession): Promise<void> {
    await this.repository.insert({
      userId: session.userId,
      tokenHash: session.tokenHash,
      lastSeenAt: new Date(),
      expiresAt: session.expiresAt,
    });
  }

  async findActive(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedParticipant | null> {
    // One query with the owner joined in: a participant request should cost a
    // single round trip, and an expired session must not resolve at all.
    const row = await this.repository.findOne({
      where: { tokenHash, expiresAt: MoreThan(now) },
      relations: { user: true },
    });
    if (!row) return null;

    return {
      sessionId: row.id,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
      profile: toUserProfileRecord(row.user),
    };
  }

  async touch(sessionId: string, seenAt: Date, expiresAt: Date): Promise<void> {
    await this.repository.update(
      { id: sessionId },
      { lastSeenAt: seenAt, expiresAt },
    );
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.repository.delete({ tokenHash });
  }

  async deleteForUserExcept(
    userId: string,
    keepSessionId: string,
  ): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId })
      .andWhere('id <> :keepSessionId', { keepSessionId })
      .execute();
    return result.affected ?? 0;
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThanOrEqual(now),
    });
    return result.affected ?? 0;
  }
}
