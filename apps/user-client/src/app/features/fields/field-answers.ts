import {
  FormControl,
  FormRecord,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  type AnswerableField,
  type CustomFieldValue,
  type CustomFieldValues,
} from '@trefaro/shared-models';

/**
 * One answer, as a form holds it.
 *
 * `string | boolean` rather than two control types: a checkbox answers with a
 * boolean and the other two with a string, and the value that travels to the
 * server is that same union (`CustomFieldValue`).
 */
export type AnswerControl = FormControl<CustomFieldValue>;

/**
 * The answers of one form, keyed by field key.
 *
 * A `FormRecord` rather than a typed group: the control names are not known
 * until the definitions have been read, which is the case it exists for.
 */
export type AnswerRecord = FormRecord<AnswerControl>;

/** What a control starts on when nothing has been answered yet. */
export function blankAnswer(field: AnswerableField): CustomFieldValue {
  return field.type === 'checkbox' ? false : '';
}

/**
 * What the browser checks before the request goes out.
 *
 * A courtesy, not the rule: the server checks the same things against the same
 * definitions and is what decides (E35). `requiredTrue` for a checkbox, because
 * a required tick has to be ticked rather than merely answered.
 */
export function validatorsFor(field: AnswerableField): ValidatorFn[] {
  const validators: ValidatorFn[] = [];
  if (field.required) {
    validators.push(
      field.type === 'checkbox' ? Validators.requiredTrue : Validators.required,
    );
  }
  if (field.type === 'text') {
    validators.push(Validators.maxLength(MAX_CUSTOM_TEXT_LENGTH));
  }
  return validators;
}

/**
 * Brings the record's controls in line with the definitions.
 *
 * Existing controls are kept rather than rebuilt: both forms that use this run
 * it again whenever their inputs are re-emitted, and a fresh record would throw
 * away what somebody has already typed.
 *
 * A control is removed when its field is gone, which is the one case where
 * something typed *is* dropped — there is nowhere to send it any more. The
 * answers already stored under that key are a different matter and stay where
 * they are (F34).
 */
export function syncAnswers(
  record: AnswerRecord,
  fields: readonly AnswerableField[],
): void {
  const wanted = new Map(fields.map((field) => [field.key, field]));

  for (const key of Object.keys(record.controls)) {
    if (!wanted.has(key)) record.removeControl(key);
  }
  for (const [key, field] of wanted) {
    if (record.contains(key)) continue;
    record.addControl(
      key,
      new FormControl<CustomFieldValue>(blankAnswer(field), {
        nonNullable: true,
        validators: validatorsFor(field),
      }),
    );
  }
}

/**
 * Puts stored answers into the controls (FR 4.3).
 *
 * For a form that edits something that already exists, which the registration
 * form does not: it starts empty by definition. Called once per profile, never
 * on every re-emit — a second call would undo whatever has been typed since.
 *
 * An answer whose type does not match its field is ignored rather than coerced.
 * That happens when a question was retyped, which cannot happen (F35), or when
 * an answer outlived the question it was given to (F34) — and in the second
 * case there is no control to put it in anyway.
 */
export function fillAnswers(
  record: AnswerRecord,
  fields: readonly AnswerableField[],
  answers: CustomFieldValues,
): void {
  for (const field of fields) {
    const control = record.controls[field.key];
    if (!control) continue;

    const stored = answers[field.key];
    const expected = field.type === 'checkbox' ? 'boolean' : 'string';
    control.setValue(typeof stored === expected ? stored : blankAnswer(field));
  }
}
