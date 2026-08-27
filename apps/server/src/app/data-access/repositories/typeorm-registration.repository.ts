import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  RegistrationExistsError,
  type NewRegistration,
  type RegistrationChanges,
  type RegistrationRecord,
  type RegistrationRepository,
} from '../../business/registration/ports/registration.repository';
import type { RegistrationTally } from '../../business/registration/ports/registration-tally';
import { RegistrationEntity } from '../entities';

/** PostgreSQL's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/**
 * PostgreSQL implementation of the two registration ports.
 *
 * One class for both because they read the same table; the split exists so the
 * events and series modules can be given the counts without the rows (E14).
 */
@Injectable()
export class TypeormRegistrationRepository
  implements RegistrationRepository, RegistrationTally
{
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly repository: Repository<RegistrationEntity>,
  ) {}

  async findById(id: string): Promise<RegistrationRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findByEventAndEmail(
    eventId: string,
    email: string,
  ): Promise<RegistrationRecord | null> {
    // `lower(email)` on both sides, matching the unique index: the caller
    // normalizes too, and this way neither is the single point of failure.
    const row = await this.repository
      .createQueryBuilder('registration')
      .where('registration.event_id = :eventId', { eventId })
      .andWhere('lower(registration.email) = lower(:email)', { email })
      .getOne();
    return row ? toRecord(row) : null;
  }

  async create(registration: NewRegistration): Promise<RegistrationRecord> {
    try {
      return toRecord(
        await this.repository.save(this.repository.create(registration)),
      );
    } catch (error: unknown) {
      throw isUniqueViolation(error)
        ? new RegistrationExistsError(registration.eventId, registration.email)
        : error;
    }
  }

  async update(
    id: string,
    changes: RegistrationChanges,
  ): Promise<RegistrationRecord | null> {
    const result = await this.repository.update({ id }, changes);
    if ((result.affected ?? 0) === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  confirmedForEvent(eventId: string): Promise<number> {
    return this.repository.countBy({ eventId, status: 'confirmed' });
  }

  confirmedForSeries(seriesId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('registration')
      .innerJoin('event', 'event', 'event.id = registration.event_id')
      .where('event.series_id = :seriesId', { seriesId })
      .andWhere('registration.status = :status', { status: 'confirmed' })
      .getCount();
  }
}

function isUniqueViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : (error as { code?: string } | undefined);
  return driverError?.code === UNIQUE_VIOLATION;
}

function toRecord(row: RegistrationEntity): RegistrationRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    origin: row.origin,
    status: row.status,
    newsletterOptIn: row.newsletterOptIn,
    contactOptOut: row.contactOptOut,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
