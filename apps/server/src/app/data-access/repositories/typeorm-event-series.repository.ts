import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
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

  async findByIds(
    ids: readonly string[],
  ): Promise<readonly EventSeriesRecord[]> {
    // `IN ()` is not valid SQL, and a query that can only come back empty is a
    // round trip for nothing.
    if (ids.length === 0) return [];
    const rows = await this.repository.findBy({ id: In([...ids]) });
    return rows.map(toRecord);
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

  /**
   * The path is written on its own, and the caller reads the row back.
   *
   * `update` rather than `save`, for the same reason `update` above does: a loaded entity
   * written back would carry every column it happens to hold, and this operation
   * is about exactly one of them. It also moves `updated_at`, which is what
   * makes the `?v=` in the public URL change when the picture does.
   */
  async setLogoPath(
    id: string,
    storedPath: string | null,
  ): Promise<EventSeriesRecord | null> {
    const result = await this.repository.update(
      { id },
      { logoPath: storedPath },
    );
    if ((result.affected ?? 0) === 0) return null;
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
