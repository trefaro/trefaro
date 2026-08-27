import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  UnknownEventError,
  type CreateRoomInput,
  type RoomRecord,
  type RoomRepository,
} from '../business/ports/room.repository';
import { RoomEntity } from './entities/room.entity';

/** PostgreSQL's foreign-key-violation SQLSTATE. */
const FOREIGN_KEY_VIOLATION = '23503';

/** The plug-in's own data access implementation. */
@Injectable()
export class TypeormRoomRepository implements RoomRepository {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly repository: Repository<RoomEntity>,
  ) {}

  async findByEvent(eventId: string): Promise<readonly RoomRecord[]> {
    const rows = await this.repository.find({
      where: { eventId },
      order: { name: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<RoomRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateRoomInput): Promise<RoomRecord> {
    try {
      const saved = await this.repository.save(this.repository.create(input));
      return toRecord(saved);
    } catch (error: unknown) {
      // The foreign key on `event_id`, added in AP 9: an unknown event is a 404,
      // and translating it here is what keeps the driver's error code out of the
      // business layer.
      if (!isForeignKeyViolation(error)) throw error;
      throw new UnknownEventError(input.eventId);
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : undefined;
  return driverError?.code === FOREIGN_KEY_VIOLATION;
}

function toRecord(row: RoomEntity): RoomRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    capacity: row.capacity,
    floor: row.floor,
    description: row.description,
  };
}
