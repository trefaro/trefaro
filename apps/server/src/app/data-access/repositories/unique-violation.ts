import { QueryFailedError } from 'typeorm';

/** PostgreSQL's `unique_violation` — the one SQLSTATE this layer reads by name. */
const UNIQUE_VIOLATION = '23505';

/**
 * Whether a failed write hit a unique index.
 *
 * Eight repositories asked this with eight copies of the same six lines until
 * AP 13 of phase 3 pulled them together — F138 puts the move at the third
 * caller, and this was well past it. It stays **inside** the data access layer
 * on purpose: a SQLSTATE is a fact about PostgreSQL, and the business layer is
 * not allowed to learn one. What travels upwards is a `ConflictException` or a
 * `null`, decided per caller, because "this slug is taken" and "this address
 * has already registered" are not the same answer.
 *
 * Two error shapes are recognised, and that is the drift this extraction found:
 * seven copies read the wrapped **and** the bare object, one read only the
 * wrapped one. The wider reading is the one kept — a `code` of `23505` means
 * the same thing whoever threw it, so it is a superset and no caller changes
 * behaviour.
 */
export function isUniqueViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : (error as { code?: string } | undefined);
  return driverError?.code === UNIQUE_VIOLATION;
}
