import type { BadRequestException } from '@nestjs/common';
import type { CustomFieldValue } from '@trefaro/shared-models';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  MAX_FIELD_OPTIONS,
} from '@trefaro/shared-models';
import { conflict, refuse } from './problem';
import { isSlug, slugify } from './slug';

/**
 * The rules of a field kit, in one copy (F12, FR 3.5, FR 4.3 — E35).
 *
 * There are two field kits in this application: the registration form of an
 * event (`registration_field`) and the profile questions of the instance
 * (`profile_field`). They differ in what they hang off — an event against
 * nothing at all — and in whether a file may be asked for. They do **not**
 * differ in what makes an answer acceptable, in how a key is derived from a
 * label, or in what a selection field's choices are.
 *
 * That last part is why this file exists rather than a second service with the
 * same private methods. E35 promises "the same check against the definitions",
 * and a second copy of a validator is the kind of copy that drifts and then
 * accepts what the other one refuses — which for a form means an answer that
 * one screen writes and the other cannot read.
 *
 * Everything here is a function. It needs no injector, so it is imported
 * directly rather than provided by `CommonModule`, like `slug.ts` beside it.
 */

/**
 * The three types whose answer fits in `custom_fields_json`.
 *
 * A file field is not among them, and that is not an omission: a file is not an
 * answer in the JSON (F37) but an `attachment` row, and only the registration
 * kit has a row for one to hang off.
 */
export type AnswerableFieldType = 'text' | 'select' | 'checkbox';

/** What {@link checkAnswer} needs to know about a field — no ids, no order. */
export interface AnswerableField {
  readonly label: string;
  readonly type: AnswerableFieldType;
  /** The choices of a select field; empty for every other type. */
  readonly options: readonly string[];
  readonly required: boolean;
}

/** Used when a label transliterates to nothing usable — see `slugify`. */
const FALLBACK_KEY = 'field';

/** How many numbered variants of a key to try before asking for one. */
const MAX_KEY_ATTEMPTS = 50;

/**
 * One answer, checked against one field.
 *
 * `undefined` means "not answered", which is only acceptable for a field that
 * is not required. The returned value is what gets stored — trimmed, and absent
 * when the question was left blank, so nothing writes an empty answer that
 * later reads as one that was given.
 */
export function checkAnswer(
  field: AnswerableField,
  value: CustomFieldValue | undefined,
): CustomFieldValue | undefined {
  if (field.type === 'checkbox') {
    if (value === undefined) {
      // A required checkbox has to be ticked, not merely answered (F36): a
      // consent box that accepts "no" is not a consent box.
      if (field.required) throw missingAnswer(field);
      return undefined;
    }
    if (typeof value !== 'boolean') {
      throw refuse('problem.field.checkbox', { label: field.label });
    }
    if (field.required && !value) throw missingAnswer(field);
    return value;
  }

  if (value !== undefined && typeof value !== 'string') {
    throw refuse('problem.field.takesText', { label: field.label });
  }

  // An empty string is no answer at all (F36): "answered with nothing" and
  // "not answered" are the same thing for a text or a selection field.
  const text = (value ?? '').trim();
  if (text.length === 0) {
    if (field.required) throw missingAnswer(field);
    return undefined;
  }

  if (field.type === 'select') {
    if (!field.options.includes(text)) {
      throw refuse('problem.field.notAChoice', {
        value: text,
        label: field.label,
      });
    }
    return text;
  }

  if (text.length > MAX_CUSTOM_TEXT_LENGTH) {
    throw refuse('problem.field.tooLong', {
      label: field.label,
      max: MAX_CUSTOM_TEXT_LENGTH,
    });
  }
  return text;
}

/** Said the same way for every kind of field, in every kind of form. */
export function missingAnswer(field: {
  readonly label: string;
}): BadRequestException {
  return refuse('problem.field.required', { label: field.label });
}

/** A label somebody reads — trimmed, and never empty. */
export function fieldLabel(value: string): string {
  const label = value.trim();
  if (label.length === 0) throw refuse('problem.field.labelMissing');
  return label;
}

/** An emptied help text means "no help text", not the empty string. */
export function optionalHelpText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The choices of a select field.
 *
 * Duplicates are dropped rather than refused — two identical entries in a
 * dropdown are a slip of the paste buffer, not an intention. A select without
 * any choice left is refused: an empty dropdown is a field nobody can fill in.
 */
export function selectOptions(
  isSelect: boolean,
  values: readonly string[] | undefined,
): readonly string[] {
  if (!isSelect) {
    if (values && values.length > 0) {
      throw refuse('problem.field.optionsWithoutSelect');
    }
    return [];
  }

  const options = [
    ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
  if (options.length === 0) throw refuse('problem.field.noChoices');
  if (options.length > MAX_FIELD_OPTIONS) {
    throw refuse('problem.field.tooManyChoices', { max: MAX_FIELD_OPTIONS });
  }
  return options;
}

/**
 * An explicit key is taken literally; otherwise the label decides (F35).
 *
 * Literally, and refused when it is not a key: a key is given precisely when it
 * has to match something outside this application, and quietly rewriting it
 * into something similar would defeat the only reason to send one.
 *
 * `reservedBy` is the refusal of whichever kit already uses the reserved keys,
 * so the message tells an organizer which form they collided with. A code per
 * kit rather than one code with the owner as a value: the owner stands in the
 * middle of the sentence, and German does not put it where English does (F79).
 */
export function requestedFieldKey(
  requested: string | undefined,
  label: string,
  reserved: readonly string[],
  reservedBy: ReservedFieldKeyProblem,
): string {
  const cleaned =
    requested === undefined ? slugify(label) : requested.trim().toLowerCase();
  if (requested !== undefined && !isSlug(cleaned)) {
    throw refuse('problem.field.keyShape');
  }
  if (reserved.includes(cleaned)) throw conflict(reservedBy, { key: cleaned });
  return cleaned;
}

/** Which kit a reserved key belongs to — see {@link requestedFieldKey}. */
export type ReservedFieldKeyProblem =
  | 'problem.field.keyReservedByProfile'
  | 'problem.field.keyReservedByRegistration';

/**
 * First free variant among the keys already taken: `diet`, then `diet-2`, …
 *
 * The same treatment an event's public address gets: two questions that shorten
 * to the same key are a normal thing to want, and refusing the second one would
 * be a dead end an organizer cannot see the cause of.
 */
export function firstFreeFieldKey(
  taken: Iterable<string>,
  base: string,
): string {
  const root = base || FALLBACK_KEY;
  const used = new Set(taken);

  for (let attempt = 1; attempt <= MAX_KEY_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 1 ? root : `${root}-${attempt}`;
    if (!used.has(candidate)) return candidate;
  }

  throw conflict('problem.field.noFreeKey', { root });
}

/**
 * The keys of an answer set that no field asked for.
 *
 * Returned rather than refused here, because the sentence differs per form —
 * what does not differ is that an unknown key is **refused and not dropped**:
 * a typo that disappears silently costs an answer nobody notices is missing.
 */
export function unknownFieldKeys(
  answers: Readonly<Record<string, unknown>>,
  known: ReadonlySet<string>,
): readonly string[] {
  return Object.keys(answers).filter((key) => !known.has(key));
}
