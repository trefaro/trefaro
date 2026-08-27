import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  RegistrationFieldKeyTakenError,
  type NewRegistrationField,
  type RegistrationFieldChanges,
  type RegistrationFieldRecord,
  type RegistrationFieldRepository,
} from '../../business/registration/ports/registration-field.repository';
import { RegistrationFieldEntity } from '../entities';

/** PostgreSQL's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/** PostgreSQL implementation of the field kit port (F12). */
@Injectable()
export class TypeormRegistrationFieldRepository implements RegistrationFieldRepository {
  constructor(
    @InjectRepository(RegistrationFieldEntity)
    private readonly repository: Repository<RegistrationFieldEntity>,
  ) {}

  async findByEvent(
    eventId: string,
  ): Promise<readonly RegistrationFieldRecord[]> {
    const rows = await this.repository.find({
      where: { eventId },
      // The id breaks a tie the same way everywhere else in this application:
      // two fields sharing a position must not swap between two reads.
      order: { sort: 'ASC', id: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<RegistrationFieldRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async create(field: NewRegistrationField): Promise<RegistrationFieldRecord> {
    try {
      return toRecord(
        await this.repository.save(
          this.repository.create({ ...field, options: [...field.options] }),
        ),
      );
    } catch (error: unknown) {
      throw isUniqueViolation(error)
        ? new RegistrationFieldKeyTakenError(field.eventId, field.key)
        : error;
    }
  }

  async update(
    id: string,
    changes: RegistrationFieldChanges,
  ): Promise<RegistrationFieldRecord | null> {
    const { options, ...rest } = changes;
    const result = await this.repository.update(
      { id },
      // The options are copied: the port hands them over as `readonly`, and
      // TypeORM writes into what it is given.
      { ...rest, ...(options === undefined ? {} : { options: [...options] }) },
    );
    if ((result.affected ?? 0) === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Renumbers one event's fields to `0 … n-1`.
   *
   * In one transaction, because a form read halfway through would otherwise be
   * missing a field or show one twice — and the public registration page reads
   * this table on every visit.
   */
  async reorder(
    eventId: string,
    orderedIds: readonly string[],
  ): Promise<readonly RegistrationFieldRecord[]> {
    await this.repository.manager.transaction(async (manager) => {
      const fields = manager.getRepository(RegistrationFieldEntity);
      for (const [sort, id] of orderedIds.entries()) {
        await fields.update({ id, eventId }, { sort });
      }
    });
    return this.findByEvent(eventId);
  }
}

function isUniqueViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : (error as { code?: string } | undefined);
  return driverError?.code === UNIQUE_VIOLATION;
}

function toRecord(row: RegistrationFieldEntity): RegistrationFieldRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    key: row.key,
    label: row.label,
    type: row.type,
    helpText: row.helpText,
    options: row.options ?? [],
    required: row.required,
    sort: row.sort,
  };
}
