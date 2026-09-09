import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import {
  UnknownTicketRegistrationError,
  type AdmissionResult,
  type IssueTicketInput,
  type TicketRecord,
  type TicketRepository,
} from '../business/ports/ticket.repository';
import { TicketEntity } from './entities/ticket.entity';

/** PostgreSQL's foreign-key-violation SQLSTATE. */
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * The plug-in's own data access implementation (FR 3.16).
 *
 * Two statements carry rules the business layer must not be able to get wrong
 * (F152), and both are written as one statement rather than as read-then-write
 * — which is the version that loses a race at a door where two phones scan the
 * same ticket:
 *
 * - **Issuing** is `INSERT … ON CONFLICT DO NOTHING` followed by reading the
 *   ids back, in one round trip per page. Two tabs opening the same ticket page
 *   get one code, and the loser of the race gets the winner's row rather than
 *   an error.
 * - **Checking in** writes `checked_in_at` only `WHERE checked_in_at IS NULL`
 *   and then reads the row as it now stands. A second scan therefore reads back
 *   the **first** instant, which is what "already here, since 09:12" is made of
 *   — and there is no window in which two admissions of one person disagree.
 */
@Injectable()
export class TypeormTicketRepository implements TicketRepository {
  constructor(
    @InjectRepository(TicketEntity)
    private readonly repository: Repository<TicketEntity>,
  ) {}

  async findMany(
    registrationIds: readonly string[],
  ): Promise<ReadonlyMap<string, TicketRecord>> {
    // An empty page asks nothing: `IN ()` is not valid SQL, and a query that
    // can only come back empty is a round trip for nothing.
    if (registrationIds.length === 0) return new Map();

    const rows = await this.repository.findBy({
      registrationId: In([...registrationIds]),
    });
    return index(rows);
  }

  async issue(
    inputs: readonly IssueTicketInput[],
  ): Promise<ReadonlyMap<string, TicketRecord>> {
    if (inputs.length === 0) return new Map();

    try {
      await this.repository
        .createQueryBuilder()
        .insert()
        .into(TicketEntity)
        .values(
          inputs.map((input) => ({
            registrationId: input.registrationId,
            code: input.code,
            issuedAt: input.issuedAt,
          })),
        )
        // The primary key decides: a registration that already has a ticket
        // keeps the one it has, and nothing about that is an error (E53).
        .orIgnore()
        .execute();
    } catch (error: unknown) {
      // A registration deleted between reading the list and issuing the code:
      // a 404 rather than a 500, and translating it here is what keeps the
      // driver's error code out of the business layer.
      if (!isForeignKeyViolation(error)) throw error;
      throw new UnknownTicketRegistrationError(inputs[0].registrationId);
    }

    return this.findMany(inputs.map((input) => input.registrationId));
  }

  async findByCode(code: string): Promise<TicketRecord | null> {
    const row = await this.repository.findOneBy({ code });
    return row ? toRecord(row) : null;
  }

  async checkIn(
    code: string,
    checkedInAt: Date,
    checkedInBy: string,
  ): Promise<AdmissionResult | null> {
    // Only where nobody has been let in yet: the first admission is the one
    // that counts, and a second scan must not move the instant it reads back.
    const written = await this.repository
      .createQueryBuilder()
      .update(TicketEntity)
      .set({ checkedInAt, checkedInBy })
      .where('code = :code', { code })
      .andWhere('checked_in_at IS NULL')
      .execute();

    // Read the row back as well: zero rows updated means either "no such code"
    // or "already here", and only the row itself can say which of the two.
    const ticket = await this.findByCode(code);
    if (!ticket) return null;
    return { ticket, admitted: (written.affected ?? 0) > 0 };
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : undefined;
  return driverError?.code === FOREIGN_KEY_VIOLATION;
}

function index(
  rows: readonly TicketEntity[],
): ReadonlyMap<string, TicketRecord> {
  return new Map(rows.map((row) => [row.registrationId, toRecord(row)]));
}

function toRecord(row: TicketEntity): TicketRecord {
  return {
    registrationId: row.registrationId,
    code: row.code,
    issuedAt: row.issuedAt,
    checkedInAt: row.checkedInAt,
    checkedInBy: row.checkedInBy,
  };
}
