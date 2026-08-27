import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ProgramCounts,
  ProgramTally,
} from '../../business/program/ports/program-tally';
import type {
  NewProgramItem,
  ProgramItemChanges,
  ProgramItemRecord,
  ProgramItemRepository,
} from '../../business/program/ports/program-item.repository';
import { ProgramItemEntity } from '../entities';

/**
 * PostgreSQL implementation of the programme port (FR 3.7).
 *
 * Also implements {@link ProgramTally}, the narrow counting port the dashboard
 * uses (FR 3.8) — one class, two ports, the same arrangement the registration
 * repository has with its tally. The counts are aggregated in the database
 * rather than by reading the programme: three hundred sessions with their
 * abstracts is a lot of bytes to move for three numbers.
 */
@Injectable()
export class TypeormProgramItemRepository
  implements ProgramItemRepository, ProgramTally
{
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

  async countForEvent(eventId: string): Promise<ProgramCounts> {
    // Two aggregates rather than the programme itself: three hundred sessions
    // with their abstracts is a lot of bytes to move for three numbers. The
    // seats are counted through the sessions of this event — the sign-up table
    // has no event column of its own, which is right: a seat belongs to a
    // session, and the session knows the event.
    const [sessions, seats] = await Promise.all([
      this.repository
        .createQueryBuilder('item')
        .select('COUNT(*)::int', 'items')
        .addSelect(
          'COUNT(*) FILTER (WHERE item.registration_enabled)::int',
          'withSignup',
        )
        .where('item.event_id = :eventId', { eventId })
        .getRawOne<{ items: number; withSignup: number }>(),
      this.repository
        .createQueryBuilder('item')
        .innerJoin(
          'program_item_signup',
          'signup',
          'signup.program_item_id = item.id',
        )
        .select('COUNT(*)::int', 'signups')
        .where('item.event_id = :eventId', { eventId })
        .getRawOne<{ signups: number }>(),
    ]);

    return {
      items: Number(sessions?.items ?? 0),
      withSignup: Number(sessions?.withSignup ?? 0),
      signups: Number(seats?.signups ?? 0),
    };
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
    registrationEnabled: row.registrationEnabled,
    capacity: row.capacity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
