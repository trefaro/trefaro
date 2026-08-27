import type { RegistrationFieldType } from '@trefaro/shared-models';

/**
 * Port for the configurable registration fields (F12, FR 3.5).
 *
 * The business layer knows this interface; the data access layer implements it.
 * Two rules are delegated to the database on purpose:
 *
 * - **A key is unique per event.** A unique index decides that, not a
 *   check-then-insert, because two organizers defining a field at the same
 *   moment would otherwise both be told the key is free.
 * - **The order is rewritten as a whole.** {@link RegistrationFieldRepository
 *   .reorder} runs in one transaction, so a form is never briefly missing a
 *   field or showing one twice.
 */

/** A field definition in business-layer terms — no ORM types. */
export interface RegistrationFieldRecord {
  readonly id: string;
  readonly eventId: string;
  readonly key: string;
  readonly label: string;
  readonly type: RegistrationFieldType;
  readonly helpText: string | null;
  readonly options: readonly string[];
  readonly required: boolean;
  readonly sort: number;
}

export interface NewRegistrationField {
  readonly eventId: string;
  /** Already derived and checked by the service. */
  readonly key: string;
  readonly label: string;
  readonly type: RegistrationFieldType;
  readonly helpText: string | null;
  readonly options: readonly string[];
  readonly required: boolean;
  readonly sort: number;
}

/** Only the fields actually given are written. Type and key never change. */
export interface RegistrationFieldChanges {
  readonly label?: string;
  readonly helpText?: string | null;
  readonly options?: readonly string[];
  readonly required?: boolean;
}

/** Raised when this event already has a field under that key. */
export class RegistrationFieldKeyTakenError extends Error {
  constructor(
    readonly eventId: string,
    readonly key: string,
  ) {
    super(`This event already has a field with the key "${key}"`);
    this.name = 'RegistrationFieldKeyTakenError';
  }
}

export interface RegistrationFieldRepository {
  /** One event's fields in form order, ascending by `sort`. */
  findByEvent(eventId: string): Promise<readonly RegistrationFieldRecord[]>;
  findById(id: string): Promise<RegistrationFieldRecord | null>;
  /** @throws RegistrationFieldKeyTakenError */
  create(field: NewRegistrationField): Promise<RegistrationFieldRecord>;
  /** `null` when no field has that id. */
  update(
    id: string,
    changes: RegistrationFieldChanges,
  ): Promise<RegistrationFieldRecord | null>;
  /** False when the field was already gone. */
  delete(id: string): Promise<boolean>;
  /**
   * Renumbers one event's fields to `0 … n-1` in the given order, atomically.
   *
   * The caller has already checked that the ids are exactly this event's fields;
   * returns the fields in their new order.
   */
  reorder(
    eventId: string,
    orderedIds: readonly string[],
  ): Promise<readonly RegistrationFieldRecord[]>;
}

export const REGISTRATION_FIELD_REPOSITORY = Symbol(
  'TREFARO_REGISTRATION_FIELD_REPOSITORY',
);
