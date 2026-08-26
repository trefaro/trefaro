import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import type {
  AdminSessionRepository,
  AuthenticatedAdmin,
  NewAdminSession,
} from '../../business/login/ports/admin-session.repository';
import { AdminSessionEntity } from '../entities';

/** PostgreSQL implementation of {@link AdminSessionRepository}. */
@Injectable()
export class TypeormAdminSessionRepository implements AdminSessionRepository {
  constructor(
    @InjectRepository(AdminSessionEntity)
    private readonly repository: Repository<AdminSessionEntity>,
  ) {}

  async create(session: NewAdminSession): Promise<void> {
    await this.repository.insert({
      adminUserId: session.adminUserId,
      tokenHash: session.tokenHash,
      userAgent: session.userAgent,
      lastSeenAt: new Date(),
      expiresAt: session.expiresAt,
    });
  }

  async findActive(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedAdmin | null> {
    // One query with the owner joined in: an administrative request should cost
    // a single round trip, and an expired session must not resolve at all.
    const row = await this.repository.findOne({
      where: { tokenHash, expiresAt: MoreThan(now) },
      relations: { adminUser: true },
    });
    if (!row) return null;

    return {
      sessionId: row.id,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
      admin: {
        id: row.adminUser.id,
        email: row.adminUser.email,
        name: row.adminUser.name,
        passwordHash: row.adminUser.passwordHash,
        createdAt: row.adminUser.createdAt,
        lastLoginAt: row.adminUser.lastLoginAt,
      },
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

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThanOrEqual(now),
    });
    return result.affected ?? 0;
  }
}
