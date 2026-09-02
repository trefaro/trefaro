import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  ProfileFieldKeyTakenError,
  type NewProfileField,
  type ProfileFieldChanges,
  type ProfileFieldRecord,
  type ProfileFieldRepository,
} from '../../business/profiles/ports/profile-field.repository';
import { ProfileFieldEntity } from '../entities';

/** PostgreSQL's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/** PostgreSQL implementation of the profile field kit port (FR 4.3, E35). */
@Injectable()
export class TypeormProfileFieldRepository implements ProfileFieldRepository {
  constructor(
    @InjectRepository(ProfileFieldEntity)
    private readonly repository: Repository<ProfileFieldEntity>,
  ) {}

  async findAll(): Promise<readonly ProfileFieldRecord[]> {
    const rows = await this.repository.find({
      // The id breaks a tie the same way everywhere else in this application:
      // two questions sharing a position must not swap between two reads.
      order: { sort: 'ASC', id: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<ProfileFieldRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async create(field: NewProfileField): Promise<ProfileFieldRecord> {
    try {
      return toRecord(
        await this.repository.save(
          this.repository.create({ ...field, options: [...field.options] }),
        ),
      );
    } catch (error: unknown) {
      throw isUniqueViolation(error)
        ? new ProfileFieldKeyTakenError(field.key)
        : error;
    }
  }

  async update(
    id: string,
    changes: ProfileFieldChanges,
  ): Promise<ProfileFieldRecord | null> {
    const { options, ...rest } = changes;
    const result = await this.repository.update(
      { id },
      // The list is copied: the port hands it over as `readonly`, and TypeORM
      // writes into what it is given.
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
   * Renumbers the profile form to `0 … n-1`.
   *
   * In one transaction, because a form read halfway through would otherwise be
   * missing a question or show one twice — and every participant editing their
   * profile reads this table.
   */
  async reorder(
    orderedIds: readonly string[],
  ): Promise<readonly ProfileFieldRecord[]> {
    await this.repository.manager.transaction(async (manager) => {
      const fields = manager.getRepository(ProfileFieldEntity);
      for (const [sort, id] of orderedIds.entries()) {
        await fields.update({ id }, { sort });
      }
    });
    return this.findAll();
  }
}

function isUniqueViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : (error as { code?: string } | undefined);
  return driverError?.code === UNIQUE_VIOLATION;
}

function toRecord(row: ProfileFieldEntity): ProfileFieldRecord {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    helpText: row.helpText,
    options: row.options ?? [],
    required: row.required,
    sort: row.sort,
  };
}
