import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ProposalStatus } from '@trefaro/shared-models';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';
import {
  UnknownProposalTargetError,
  type CreateProposalInput,
  type ProposalRecord,
  type ProposalRepository,
  type ProposalSlice,
  type ProposalWindow,
} from '../business/ports/proposal.repository';
import { ProposalEntity } from './entities/proposal.entity';

/** PostgreSQL's foreign-key-violation SQLSTATE. */
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * The plug-in's own data access implementation (FR 3.13, FR 3.14).
 *
 * Everything a list does happens in SQL — the filter, the sort, the count and
 * the window — for the reason every other list of this application gives: a
 * service that reads all rows and slices the array afterwards is the version
 * that fails first at volume (F49).
 *
 * The visibility rule is part of the statement, not of a caller (F152):
 * {@link findForParticipant} cannot be asked for somebody else's pending
 * proposal, whatever it is passed. That is the one mistake that would publish a
 * rejected row, so it is made impossible rather than checked above.
 *
 * The sort is `created_at DESC` with the id as the last criterion, like every
 * paginated list here: two proposals submitted in the same millisecond must not
 * swap places between page one and page two.
 */
@Injectable()
export class TypeormProposalRepository implements ProposalRepository {
  constructor(
    @InjectRepository(ProposalEntity)
    private readonly repository: Repository<ProposalEntity>,
  ) {}

  findForParticipant(
    eventId: string,
    viewerId: string,
    window: ProposalWindow,
  ): Promise<ProposalSlice> {
    const builder = this.ofEvent(eventId).andWhere(
      new Brackets((where) =>
        where
          .where('proposal.status = :approved', { approved: 'approved' })
          .orWhere('proposal.author_id = :viewer', { viewer: viewerId }),
      ),
    );
    return this.page(builder, window);
  }

  findForEvent(
    eventId: string,
    status: ProposalStatus | undefined,
    window: ProposalWindow,
  ): Promise<ProposalSlice> {
    const builder = this.ofEvent(eventId);
    if (status) builder.andWhere('proposal.status = :status', { status });
    return this.page(builder, window);
  }

  async findById(id: string): Promise<ProposalRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async countByStatus(
    eventId: string,
  ): Promise<ReadonlyMap<ProposalStatus, number>> {
    const rows = await this.repository
      .createQueryBuilder('proposal')
      .select('proposal.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('proposal.event_id = :eventId', { eventId })
      .groupBy('proposal.status')
      .getRawMany<{ status: ProposalStatus; count: string }>();

    // `COUNT(*)` comes back as a string: PostgreSQL's `bigint` does not fit in
    // a double, so the driver hands it over as text rather than silently
    // rounding it. The number of proposals of one event does fit.
    return new Map(rows.map((row) => [row.status, Number(row.count)]));
  }

  async create(input: CreateProposalInput): Promise<ProposalRecord> {
    try {
      const saved = await this.repository.save(
        this.repository.create({ ...input, status: 'pending' }),
      );
      return toRecord(saved);
    } catch (error: unknown) {
      // An event deleted or an account closed between the page load and the
      // submission: a 404 rather than a 500, and translating it here is what
      // keeps the driver's error code out of the business layer.
      if (!isForeignKeyViolation(error)) throw error;
      throw new UnknownProposalTargetError(input.eventId);
    }
  }

  async decide(
    id: string,
    status: Exclude<ProposalStatus, 'pending'>,
    decidedAt: Date,
    decidedBy: string,
  ): Promise<ProposalRecord | null> {
    // Status and instant in one statement, because the check constraint refuses
    // any other combination — and `decided_by` beside them, because that is
    // what the three together mean (E51).
    const updated = await this.repository.update(
      { id },
      { status, decidedAt, decidedBy },
    );
    if (!updated.affected) return null;
    return this.findById(id);
  }

  /** Every statement here starts from one event: a proposal belongs to one. */
  private ofEvent(eventId: string): SelectQueryBuilder<ProposalEntity> {
    return this.repository
      .createQueryBuilder('proposal')
      .where('proposal.event_id = :eventId', { eventId });
  }

  /** The window and the count in one round trip, ordered for stable pages. */
  private async page(
    builder: SelectQueryBuilder<ProposalEntity>,
    window: ProposalWindow,
  ): Promise<ProposalSlice> {
    const [rows, total] = await builder
      .orderBy('proposal.created_at', 'DESC')
      .addOrderBy('proposal.id', 'DESC')
      .skip(window.offset)
      .take(window.limit)
      .getManyAndCount();

    return { rows: rows.map(toRecord), total };
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : undefined;
  return driverError?.code === FOREIGN_KEY_VIOLATION;
}

function toRecord(row: ProposalEntity): ProposalRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    authorId: row.authorId,
    title: row.title,
    description: row.description,
    status: row.status,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    createdAt: row.createdAt,
  };
}
