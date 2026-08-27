import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  EventSeriesSlugTakenError,
  type EventSeriesChanges,
  type EventSeriesRecord,
  type EventSeriesRepository,
  type NewEventSeries,
} from '../../business/event-series/ports/event-series.repository';
import { EventSeriesEntity } from '../entities';

/** PostgreSQL's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/** PostgreSQL implementation of {@link EventSeriesRepository}. */
@Injectable()
export class TypeormEventSeriesRepository implements EventSeriesRepository {
  constructor(
    @InjectRepository(EventSeriesEntity)
    private readonly repository: Repository<EventSeriesEntity>,
  ) {}

  async findAll(): Promise<readonly EventSeriesRecord[]> {
    // By name: an organization with a handful of series wants them where it
    // left them, not reordered by an edit.
    const rows = await this.repository.find({ order: { name: 'ASC' } });
    return rows.map(toRecord);
  }

  async findPublished(): Promise<readonly EventSeriesRecord[]> {
    const rows = await this.repository.find({
      where: { status: 'published' },
      order: { name: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<EventSeriesRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findBySlug(slug: string): Promise<EventSeriesRecord | null> {
    const row = await this.repository.findOneBy({ slug });
    return row ? toRecord(row) : null;
  }

  async create(series: NewEventSeries): Promise<EventSeriesRecord> {
    try {
      return toRecord(
        await this.repository.save(
          this.repository.create({ ...series, logoPath: null }),
        ),
      );
    } catch (error: unknown) {
      throw this.translate(error, series.slug);
    }
  }

  async update(
    id: string,
    changes: EventSeriesChanges,
  ): Promise<EventSeriesRecord | null> {
    try {
      const result = await this.repository.update({ id }, changes);
      if ((result.affected ?? 0) === 0) return null;
    } catch (error: unknown) {
      throw this.translate(error, changes.slug ?? '');
    }
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  private translate(error: unknown, slug: string): unknown {
    // The unique index is the authority on whether an address is free; checking
    // first and writing second would still lose a race.
    return isUniqueViolation(error)
      ? new EventSeriesSlugTakenError(slug)
      : error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : (error as { code?: string } | undefined);
  return driverError?.code === UNIQUE_VIOLATION;
}

function toRecord(row: EventSeriesEntity): EventSeriesRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logoPath: row.logoPath,
    websiteUrl: row.websiteUrl,
    contactEmail: row.contactEmail,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
