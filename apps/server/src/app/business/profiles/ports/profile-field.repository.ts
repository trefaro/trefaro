import type { ProfileFieldType } from '@trefaro/shared-models';

/**
 * Port for the configurable profile questions (FR 4.3 — E35).
 *
 * The business layer knows this interface; the data access layer implements it.
 * A port of its own rather than a reuse of `RegistrationFieldRepository`, and
 * that is worth spelling out because the plan for this work package expected the
 * opposite: the two kits share their *rules*, not their table. This one has no
 * `event_id` to filter by, so every read here is instance-wide, and its key is
 * unique across the instance rather than per event. A port parameterised over
 * "the thing a field hangs off" would have had one implementation per table
 * anyway, plus a type that means nothing on its own — and it would have made the
 * registration form's questions and the profile's look interchangeable, which
 * they are not.
 *
 * What is genuinely shared lives in `business/common/field-kit.ts`: what makes
 * an answer acceptable, how a key comes from a label, and what a selection
 * field's choices are.
 *
 * Two rules are delegated to the database on purpose, exactly as they are for
 * the registration kit:
 *
 * - **A key is unique.** A unique index decides that, not a check-then-insert,
 *   because two organizers defining a question at the same moment would
 *   otherwise both be told the key is free.
 * - **The order is rewritten as a whole.** {@link ProfileFieldRepository
 *   .reorder} runs in one transaction, so the form is never briefly missing a
 *   question or showing one twice.
 */

/** A question in business-layer terms — no ORM types. */
export interface ProfileFieldRecord {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: ProfileFieldType;
  readonly helpText: string | null;
  readonly options: readonly string[];
  readonly required: boolean;
  readonly sort: number;
}

export interface NewProfileField {
  /** Already derived and checked by the service. */
  readonly key: string;
  readonly label: string;
  readonly type: ProfileFieldType;
  readonly helpText: string | null;
  readonly options: readonly string[];
  readonly required: boolean;
  readonly sort: number;
}

/** Only the fields actually given are written. Type and key never change. */
export interface ProfileFieldChanges {
  readonly label?: string;
  readonly helpText?: string | null;
  readonly options?: readonly string[];
  readonly required?: boolean;
}

/** Raised when the instance already has a question under that key. */
export class ProfileFieldKeyTakenError extends Error {
  constructor(readonly key: string) {
    super(`A profile question with the key "${key}" already exists`);
    this.name = 'ProfileFieldKeyTakenError';
  }
}

export interface ProfileFieldRepository {
  /** The whole form, in form order, ascending by `sort`. */
  findAll(): Promise<readonly ProfileFieldRecord[]>;
  findById(id: string): Promise<ProfileFieldRecord | null>;
  /** @throws ProfileFieldKeyTakenError */
  create(field: NewProfileField): Promise<ProfileFieldRecord>;
  /** `null` when no question has that id. */
  update(
    id: string,
    changes: ProfileFieldChanges,
  ): Promise<ProfileFieldRecord | null>;
  /** False when the question was already gone. */
  delete(id: string): Promise<boolean>;
  /**
   * Renumbers the form to `0 … n-1` in the given order, atomically.
   *
   * The caller has already checked that the ids are exactly the questions there
   * are; returns them in their new order.
   */
  reorder(
    orderedIds: readonly string[],
  ): Promise<readonly ProfileFieldRecord[]>;
}

export const PROFILE_FIELD_REPOSITORY = Symbol(
  'TREFARO_PROFILE_FIELD_REPOSITORY',
);
