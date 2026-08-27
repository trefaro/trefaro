import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type {
  ProgramItemParticipant,
  ProgramItemSignupRecord,
  ProgramItemSignupRepository,
  SignUpOutcome,
  SignUpRequest,
} from '../../business/program/ports/program-item-signup.repository';
import { ProgramItemSignupEntity, RegistrationEntity } from '../entities';

/** PostgreSQL's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/**
 * PostgreSQL implementation of the sign-up port (FR 3.10).
 *
 * The interesting method is {@link signUp}: it is the one place in the
 * application where a limit has to hold against two people acting at the same
 * instant. Counting and then inserting cannot do that — both transactions read
 * "one seat left" and both insert. So the session row is locked for the duration
 * (`FOR UPDATE`), which makes the count and the insert one decision, and the
 * unique index catches the simpler race of one person clicking twice.
 */
@Injectable()
export class TypeormProgramItemSignupRepository implements ProgramItemSignupRepository {
  constructor(
    @InjectRepository(ProgramItemSignupEntity)
    private readonly repository: Repository<ProgramItemSignupEntity>,
  ) {}

  async findByRegistration(
    registrationId: string,
  ): Promise<readonly ProgramItemSignupRecord[]> {
    const rows = await this.repository.find({
      where: { registrationId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      programItemId: row.programItemId,
      registrationId: row.registrationId,
      createdAt: row.createdAt,
    }));
  }

  async countByItems(
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    // An empty list would become `IN ()`, which is not SQL. It is also the
    // normal case for an event with no programme at all.
    if (itemIds.length === 0) return new Map();

    const rows = await this.repository
      .createQueryBuilder('signup')
      .select('signup.program_item_id', 'itemId')
      .addSelect('COUNT(*)::int', 'total')
      .where('signup.program_item_id IN (:...itemIds)', { itemIds })
      .groupBy('signup.program_item_id')
      .getRawMany<{ itemId: string; total: number }>();

    return new Map(rows.map((row) => [row.itemId, Number(row.total)]));
  }

  async signUp(request: SignUpRequest): Promise<SignUpOutcome> {
    const { programItemId, registrationId, capacity } = request;

    return this.repository.manager.transaction(
      async (manager): Promise<SignUpOutcome> => {
        const signups = manager.getRepository(ProgramItemSignupEntity);

        if (capacity !== null) {
          // The serialization point. Locking the session row rather than the
          // sign-ups, because the rows that decide the answer are the ones that
          // do not exist yet — and only the parent row can be locked for those.
          await manager.query(
            'SELECT 1 FROM program_item WHERE id = $1 FOR UPDATE',
            [programItemId],
          );
          const taken = await signups.countBy({ programItemId });
          if (taken >= capacity) {
            // Not before the count: somebody who already has a seat in a full
            // session must be told they have one, not that it is full.
            const mine = await signups.countBy({
              programItemId,
              registrationId,
            });
            return mine > 0 ? 'already-signed-up' : 'full';
          }
        }

        try {
          await signups.insert({ programItemId, registrationId });
        } catch (error: unknown) {
          if (!isUniqueViolation(error)) throw error;
          return 'already-signed-up';
        }
        return 'created';
      },
    );
  }

  async signOff(
    programItemId: string,
    registrationId: string,
  ): Promise<boolean> {
    const result = await this.repository.delete({
      programItemId,
      registrationId,
    });
    return (result.affected ?? 0) > 0;
  }

  async findParticipants(
    programItemId: string,
  ): Promise<readonly ProgramItemParticipant[]> {
    // One query with a join rather than a list of ids the caller resolves: the
    // organizer's load view is read per session, and a query per attendee is how
    // that view becomes the slow one.
    const rows = await this.repository
      .createQueryBuilder('signup')
      .innerJoin(
        RegistrationEntity,
        'registration',
        'registration.id = signup.registration_id',
      )
      .select('signup.registration_id', 'registrationId')
      .addSelect('signup.created_at', 'signedUpAt')
      .addSelect('registration.first_name', 'firstName')
      .addSelect('registration.last_name', 'lastName')
      .addSelect('registration.email', 'email')
      .where('signup.program_item_id = :programItemId', { programItemId })
      // The order seats were claimed in, with the id last so two reads agree.
      .orderBy('signup.created_at', 'ASC')
      .addOrderBy('signup.registration_id', 'ASC')
      .getRawMany<{
        registrationId: string;
        signedUpAt: Date;
        firstName: string;
        lastName: string;
        email: string;
      }>();

    return rows.map((row) => ({
      registrationId: row.registrationId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      signedUpAt: row.signedUpAt,
    }));
  }
}

function isUniqueViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : undefined;
  return driverError?.code === UNIQUE_VIOLATION;
}
