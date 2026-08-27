import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  NewProgramItem,
  ProgramItemChanges,
  ProgramItemRecord,
  ProgramItemRepository,
} from '../../business/program/ports/program-item.repository';
import { ProgramItemEntity } from '../entities';

/** PostgreSQL implementation of the programme port (FR 3.7). */
@Injectable()
export class TypeormProgramItemRepository implements ProgramItemRepository {
  constructor(
    @InjectRepository(ProgramItemEntity)
    private readonly repository: Repository<ProgramItemEntity>,
  ) {}

  async findByEvent(eventId: string): Promise<readonly ProgramItemRecord[]> {
    const rows = await this.repository.find({
      where: { eventId },
      // The clock decides the order (F40); the id breaks a tie the same way
      // everywhere else in this application, so two parallel sessions do not
      // swap between two reads.
      order: { startsAt: 'ASC', endsAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<ProgramItemRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async create(item: NewProgramItem): Promise<ProgramItemRecord> {
    return toRecord(
      await this.repository.save(this.repository.create({ ...item })),
    );
  }

  async update(
    id: string,
    changes: ProgramItemChanges,
  ): Promise<ProgramItemRecord | null> {
    const result = await this.repository.update({ id }, { ...changes });
    if ((result.affected ?? 0) === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}

function toRecord(row: ProgramItemEntity): ProgramItemRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    speaker: row.speaker,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
