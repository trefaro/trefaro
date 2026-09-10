import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import {
  UnknownProgramItemError,
  type PlanRepository,
} from '../business/ports/plan.repository';
import { PlanEntryEntity } from './entities/plan-entry.entity';

/** PostgreSQL's foreign-key-violation SQLSTATE. */
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * The plug-in's own data access implementation (FR 3.17).
 *
 * Three statements, and two of them carry a rule the business layer must not be
 * able to get wrong (F152). Both writes are single statements rather than
 * read-then-write: two taps on a slow connection are the version of the race
 * this screen actually has, and a check above the database would lose it.
 */
@Injectable()
export class TypeormPlanRepository implements PlanRepository {
  constructor(
    @InjectRepository(PlanEntryEntity)
    private readonly repository: Repository<PlanEntryEntity>,
  ) {}

  async findSelected(
    userId: string,
    programItemIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    // An event without a programme asks nothing: `IN ()` is not valid SQL, and
    // a query that can only come back empty is a round trip for nothing.
    if (programItemIds.length === 0) return new Set();

    const rows = await this.repository.find({
      select: { programItemId: true },
      where: { userId, programItemId: In([...programItemIds]) },
    });
    return new Set(rows.map((row) => row.programItemId));
  }

  async add(
    userId: string,
    programItemId: string,
    addedAt: Date,
  ): Promise<void> {
    try {
      await this.repository
        .createQueryBuilder()
        .insert()
        .into(PlanEntryEntity)
        .values({ userId, programItemId, addedAt })
        // The primary key decides: a session already in the plan stays in it
        // with the time it went in, and nothing about that is an error.
        .orIgnore()
        .execute();
    } catch (error: unknown) {
      // A session deleted between reading the programme and ticking the box:
      // a 404 rather than a 500, and translating it here is what keeps the
      // driver's error code out of the business layer.
      if (!isForeignKeyViolation(error)) throw error;
      throw new UnknownProgramItemError(programItemId);
    }
  }

  async remove(userId: string, programItemId: string): Promise<void> {
    // No report of what it found. "Not in the plan" is the state the caller
    // asked for, and answering differently would make an idempotent route
    // depend on whether somebody had already pressed the button.
    await this.repository.delete({ userId, programItemId });
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : undefined;
  return driverError?.code === FOREIGN_KEY_VIOLATION;
}
