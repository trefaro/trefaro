import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdminEmailTakenError,
  type AdminUserRecord,
  type AdminUserRepository,
  type NewAdminUser,
} from '../../business/login/ports/admin-user.repository';
import { AdminUserEntity } from '../entities';
import { isUniqueViolation } from './unique-violation';

/** PostgreSQL implementation of {@link AdminUserRepository}. */
@Injectable()
export class TypeormAdminUserRepository implements AdminUserRepository {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly repository: Repository<AdminUserEntity>,
  ) {}

  count(): Promise<number> {
    return this.repository.count();
  }

  async findAll(): Promise<readonly AdminUserRecord[]> {
    const rows = await this.repository.find({ order: { email: 'ASC' } });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<AdminUserRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    // Matches the functional unique index from the migration, so the lookup and
    // the constraint agree on what "the same address" means.
    const row = await this.repository
      .createQueryBuilder('admin')
      .where('lower(admin.email) = lower(:email)', { email })
      .getOne();
    return row ? toRecord(row) : null;
  }

  async create(user: NewAdminUser): Promise<AdminUserRecord> {
    try {
      const saved = await this.repository.save(
        this.repository.create({
          email: user.email,
          name: user.name,
          passwordHash: user.passwordHash,
          lastLoginAt: null,
        }),
      );
      return toRecord(saved);
    } catch (error: unknown) {
      // Checking first and inserting second would still lose a race; the
      // constraint is the authority, so the error is translated instead.
      if (isUniqueViolation(error)) {
        throw new AdminEmailTakenError(user.email);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await this.repository.update({ id }, { lastLoginAt: at });
  }
}

function toRecord(row: AdminUserEntity): AdminUserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  };
}
