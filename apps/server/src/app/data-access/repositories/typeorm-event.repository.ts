import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import {
  EventSlugTakenError,
  type EventChanges,
  type EventRecord,
  type EventRepository,
  type NewEvent,
} from '../../business/events/ports/event.repository';
import { EventEntity } from '../entities';

/** PostgreSQL's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/** PostgreSQL implementation of {@link EventRepository}. */
@Injectable()
export class TypeormEventRepository implements EventRepository {
  constructor(
    @InjectRepository(EventEntity)
    private readonly repository: Repository<EventEntity>,
  ) {}

  async findBySeries(seriesId: string): Promise<readonly EventRecord[]> {
    // Date order, ascending: both the organizer's series page and the
    // participant's split this list into upcoming and past (FR 2.3).
    const rows = await this.repository.find({
      where: { seriesId },
      order: { startsAt: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async findPublishedBySeries(
    seriesId: string,
  ): Promise<readonly EventRecord[]> {
    const rows = await this.repository.find({
      where: { seriesId, status: 'published' },
      order: { startsAt: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<EventRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<readonly EventRecord[]> {
    // `IN ()` is not valid SQL, and a query that can only come back empty is a
    // round trip for nothing.
    if (ids.length === 0) return [];
    const rows = await this.repository.findBy({ id: In([...ids]) });
    return rows.map(toRecord);
  }

  async findBySlug(
    seriesId: string,
    slug: string,
  ): Promise<EventRecord | null> {
    const row = await this.repository.findOneBy({ seriesId, slug });
    return row ? toRecord(row) : null;
  }

  async create(event: NewEvent): Promise<EventRecord> {
    try {
      return toRecord(
        await this.repository.save(
          this.repository.create({
            ...event,
            languages: [...event.languages],
            logoPath: null,
          }),
        ),
      );
    } catch (error: unknown) {
      throw this.translate(error, event.seriesId, event.slug);
    }
  }

  async update(id: string, changes: EventChanges): Promise<EventRecord | null> {
    // `languages` is pulled out of the spread because the port declares it
    // readonly and TypeORM's update type does not accept a readonly array.
    const { languages, ...rest } = changes;
    try {
      const result = await this.repository.update(
        { id },
        {
          ...rest,
          ...(languages === undefined ? {} : { languages: [...languages] }),
        },
      );
      if ((result.affected ?? 0) === 0) return null;
    } catch (error: unknown) {
      throw this.translate(error, '', changes.slug ?? '');
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
  ): Promise<EventRecord | null> {
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

  private translate(error: unknown, seriesId: string, slug: string): unknown {
    // The unique index is the authority on whether an address is free; checking
    // first and writing second would still lose a race.
    return isUniqueViolation(error)
      ? new EventSlugTakenError(seriesId, slug)
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

function toRecord(row: EventEntity): EventRecord {
  return {
    id: row.id,
    seriesId: row.seriesId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logoPath: row.logoPath,
    eventType: row.eventType,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    onlineUrl: row.onlineUrl,
    languages: row.languages,
    status: row.status,
    followUpBody: row.followUpBody,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
