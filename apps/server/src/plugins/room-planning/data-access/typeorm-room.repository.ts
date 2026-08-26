import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CreateRoomInput,
  RoomRecord,
  RoomRepository,
} from '../business/ports/room.repository';
import { RoomEntity } from './entities/room.entity';

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

  async create(input: CreateRoomInput): Promise<RoomRecord> {
    const saved = await this.repository.save(this.repository.create(input));
    return toRecord(saved);
  }
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
