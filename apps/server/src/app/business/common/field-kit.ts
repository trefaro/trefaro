import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CustomFieldValue } from '@trefaro/shared-models';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  MAX_FIELD_OPTIONS,
} from '@trefaro/shared-models';
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
      throw new BadRequestException(
        `"${field.label}" is a checkbox and takes true or false.`,
      );
    }
    if (field.required && !value) throw missingAnswer(field);
    return value;
  }

  if (value !== undefined && typeof value !== 'string') {
    throw new BadRequestException(`"${field.label}" takes text.`);
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
      throw new BadRequestException(
        `"${text}" is not one of the choices for "${field.label}".`,
      );
    }
    return text;
  }

  if (text.length > MAX_CUSTOM_TEXT_LENGTH) {
    throw new BadRequestException(
      `"${field.label}" takes at most ${MAX_CUSTOM_TEXT_LENGTH} characters.`,
    );
  }
  return text;
}

/** Said the same way for every kind of field, in every kind of form. */
export function missingAnswer(field: {
  readonly label: string;
}): BadRequestException {
  return new BadRequestException(`"${field.label}" is required.`);
}

/** A label somebody reads — trimmed, and never empty. */
export function fieldLabel(value: string, readers: string): string {
  const label = value.trim();
  if (label.length === 0) {
    throw new BadRequestException(`A field needs a label ${readers} read.`);
  }
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
      throw new BadRequestException(
        'Only a selection field has choices to offer.',
      );
    }
    return [];
  }

  const options = [
    ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
  if (options.length === 0) {
    throw new BadRequestException(
      'A selection field needs at least one choice.',
    );
  }
  if (options.length > MAX_FIELD_OPTIONS) {
    throw new BadRequestException(
      `A selection field offers at most ${MAX_FIELD_OPTIONS} choices — ` +
        'beyond that a text field asks the question better.',
    );
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
 * `owns` names whoever already uses the reserved keys, so the message tells an
 * organizer which form they collided with ("the registration", "a profile").
 */
export function requestedFieldKey(
  requested: string | undefined,
  label: string,
  reserved: readonly string[],
  owns: string,
): string {
  const cleaned =
    requested === undefined ? slugify(label) : requested.trim().toLowerCase();
  if (requested !== undefined && !isSlug(cleaned)) {
    throw new BadRequestException(
      'A field key is made of lower-case letters, digits and single hyphens.',
    );
  }
  if (reserved.includes(cleaned)) {
    throw new ConflictException(
      `"${cleaned}" is what ${owns} already calls one of its own fields. ` +
        'Please phrase the question differently, or give the field its own key.',
    );
  }
  return cleaned;
}

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

  throw new ConflictException(
    `Could not derive a free key from "${root}" — please give the field one.`,
  );
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
