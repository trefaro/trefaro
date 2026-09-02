/**
 * The configurable part of a profile — the field kit of FR 4.3 (E35).
 *
 * The same idea as the registration form's field kit and deliberately the same
 * shape: every organization wants to know something different about the people
 * in its community — the local group, the languages somebody interprets, the
 * committee they sit on — and a fixed profile form would be too long for one
 * organization and too short for the next.
 *
 * Three things are different from `RegistrationFieldPublic`, and each of them is
 * a decision rather than an omission:
 *
 * 1. **There is no event.** A profile belongs to the person, not to an event, so
 *    these definitions are instance-wide (E35). A question that has to be asked
 *    differently per event belongs in the registration form, which already
 *    exists for exactly that.
 * 2. **There is no file type.** A file is not an answer in `custom_fields_json`
 *    (F37) but an `attachment` row hanging off a registration — and a profile
 *    has no registration to hang it on. The one picture a profile does carry is
 *    the avatar, which has its own route and its own column.
 * 3. **The answers are written as a whole.** A profile form is submitted
 *    complete, so `customFields` in a profile update either is absent (leave
 *    every answer alone) or is the full set of answers, checked against these
 *    definitions.
 *
 * Everything else is shared with the registration kit on purpose, down to the
 * value types: `CustomFieldValue` and `CustomFieldValues` are the same types,
 * the key is derived from the label and then immutable (F35), and a deleted
 * question keeps the answers already given (F34).
 */

/**
 * What a profile question can be.
 *
 * Text, a choice, or a tick — the three types whose answer fits in
 * `custom_fields_json`. `file` is missing for the reason above, and no numeric
 * type exists here either (the argument is in `registrations/field.ts`: a
 * decimal separator is a locale question nobody wants to answer per field).
 */
export type ProfileFieldType = 'text' | 'select' | 'checkbox';

export const PROFILE_FIELD_TYPES: readonly ProfileFieldType[] = [
  'text',
  'select',
  'checkbox',
];

/**
 * How many extra questions a profile may ask.
 *
 * Smaller than `MAX_REGISTRATION_FIELDS` (30), and the reason is who fills the
 * form in: a registration form is filled in once by somebody who wants to
 * attend, while this one is filled in by everybody in the community and is not
 * an application. Twenty is already more than any of the mockups asked for.
 */
export const MAX_PROFILE_FIELDS = 20;

/** The longest field of activity a profile may name (E36). */
export const MAX_ACTIVITY_AREAS_LENGTH = 200;

/** A profile question as a form has to render it. */
export interface ProfileFieldPublic {
  /** Stable; what the answer is stored under (F35). */
  readonly key: string;
  readonly label: string;
  readonly type: ProfileFieldType;
  /** Shown under the input — the place to say why something is asked. */
  readonly helpText: string | null;
  /** The choices of a select field; empty for every other type. */
  readonly options: readonly string[];
  /**
   * Whether the profile form may be submitted without it.
   *
   * Required means required *of the form*, not of every existing profile: a
   * question added today cannot make yesterday's profiles invalid, and nothing
   * locks somebody out of their account over an unanswered question.
   */
  readonly required: boolean;
}

/** A profile question as the organizer manages it. */
export interface ProfileField extends ProfileFieldPublic {
  readonly id: string;
  /** Position in the form, ascending and gapless. */
  readonly sort: number;
}

/**
 * What an organizer sends when defining a profile question.
 *
 * `key` is optional and normally left out — the server derives it from the
 * label, as it does everywhere else. It can be given for a field whose key has
 * to match something outside the application, and is then taken literally.
 */
export interface ProfileFieldInput {
  readonly label: string;
  readonly type: ProfileFieldType;
  readonly key?: string;
  readonly helpText?: string | null;
  readonly options?: readonly string[];
  readonly required?: boolean;
}

/** Changing a question: everything except its type and its key (F35). */
export type ProfileFieldChange = Partial<
  Omit<ProfileFieldInput, 'type' | 'key'>
>;

/**
 * A new order for the profile form — every id exactly once, in order.
 *
 * The whole list rather than "move this one up", for the reason
 * `RegistrationFieldOrder` gives: two requests that each move one field
 * otherwise interleave into an order neither organizer asked for.
 */
export interface ProfileFieldOrder {
  readonly ids: readonly string[];
}
