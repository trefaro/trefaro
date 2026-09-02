import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CustomFieldValue,
  CustomFieldValues,
  ProfileField,
  ProfileFieldChange,
  ProfileFieldInput,
  ProfileFieldPublic,
} from '@trefaro/shared-models';
import { MAX_PROFILE_FIELDS } from '@trefaro/shared-models';
import {
  checkAnswer,
  fieldLabel,
  firstFreeFieldKey,
  optionalHelpText,
  requestedFieldKey,
  selectOptions,
  unknownFieldKeys,
} from '../common/field-kit';
import {
  PROFILE_FIELD_REPOSITORY,
  ProfileFieldKeyTakenError,
  type ProfileFieldRecord,
  type ProfileFieldRepository,
} from './ports/profile-field.repository';

/** Said the same way wherever a question cannot be found any more. */
const GONE = 'This profile question no longer exists.';

/**
 * Keys the profile itself owns (F35).
 *
 * The same reasoning as the registration form's reserved list: a custom answer
 * under one of these would collide with a column of the same meaning the moment
 * anything flattens a profile into one record — a participant export, a mail
 * template, the profile view of the participant search. Cheaper to refuse eight
 * words now than to find the collision in a spreadsheet.
 */
const RESERVED_KEYS: readonly string[] = [
  'email',
  'first-name',
  'last-name',
  'activity-areas',
  'avatar',
  'password',
  'preferred-locale',
  'searchable',
];

/**
 * The configurable part of a profile (FR 4.3 — E35).
 *
 * The second field kit of this application, and deliberately not a second copy
 * of the first: what makes an answer acceptable, how a key is derived from a
 * label and what a selection field's choices are all live in
 * `business/common/field-kit.ts`, shared with `RegistrationFieldsService`. E35
 * promises "the same check against the definitions", and two validators for one
 * rule are two chances for one of them to accept what the other refuses.
 *
 * What is genuinely different from the registration kit — and each difference is
 * a decision:
 *
 * - **There is no event.** The questions are instance-wide, because a profile
 *   belongs to the person. A question that has to differ per event belongs in
 *   the registration form, which has had one since phase 1.
 * - **There is no file type** (F37). A file answer is an `attachment` row
 *   hanging off a registration, and a profile has no registration to hang it
 *   off. The one picture a profile carries is the avatar, which has a column and
 *   a route of its own.
 * - **A required question is required of the form, not of every profile.** A
 *   question added today must not make yesterday's profiles invalid — nobody
 *   gets locked out of their own account over an unanswered question. It is
 *   checked when a profile form is submitted, against the answers that form
 *   sent.
 *
 * The two rules it keeps from the registration kit unchanged are the ones that
 * cost the most to get wrong: a key never changes and a type never changes
 * (F35), and a deleted question keeps the answers already given (F34).
 */
@Injectable()
export class ProfileFieldsService {
  constructor(
    @Inject(PROFILE_FIELD_REPOSITORY)
    private readonly fields: ProfileFieldRepository,
  ) {}

  /** The whole form as the organizer manages it (FR 4.3). */
  async listForOrganizer(): Promise<readonly ProfileField[]> {
    return (await this.fields.findAll()).map(toField);
  }

  /**
   * The questions a profile form has to render.
   *
   * Behind a participant session rather than public: an anonymous visitor never
   * fills in a profile, and what an organization asks its community is not
   * something a stranger needs to read.
   */
  async listForParticipant(): Promise<readonly ProfileFieldPublic[]> {
    return (await this.fields.findAll()).map(toPublicField);
  }

  async create(input: ProfileFieldInput): Promise<ProfileField> {
    const existing = await this.fields.findAll();
    if (existing.length >= MAX_PROFILE_FIELDS) {
      throw new ConflictException(
        `A profile holds at most ${MAX_PROFILE_FIELDS} extra questions. ` +
          'Remove one before adding another.',
      );
    }

    const label = fieldLabel(input.label, 'participants');
    const key = firstFreeFieldKey(
      existing.map((field) => field.key),
      requestedFieldKey(input.key, label, RESERVED_KEYS, 'a profile'),
    );

    try {
      return toField(
        await this.fields.create({
          key,
          label,
          type: input.type,
          helpText: optionalHelpText(input.helpText),
          options: selectOptions(input.type === 'select', input.options),
          required: input.required ?? false,
          // Appended: a new question belongs at the end of the form, not in the
          // middle of one people have already filled in.
          sort: existing.length,
        }),
      );
    } catch (error: unknown) {
      throw this.translate(error);
    }
  }

  /**
   * Changes a question — everything except its type and its key.
   *
   * The label may be corrected at any time: the key an answer is stored under
   * does not follow it, which is exactly what lets a question be rephrased
   * without orphaning the answers already given.
   */
  async update(id: string, change: ProfileFieldChange): Promise<ProfileField> {
    const field = await this.require(id);

    const updated = await this.fields.update(id, {
      ...(change.label === undefined
        ? {}
        : { label: fieldLabel(change.label, 'participants') }),
      ...(change.helpText === undefined
        ? {}
        : { helpText: optionalHelpText(change.helpText) }),
      ...(change.options === undefined
        ? {}
        : { options: selectOptions(field.type === 'select', change.options) }),
      ...(change.required === undefined ? {} : { required: change.required }),
    });
    if (!updated) throw new NotFoundException(GONE);
    return toField(updated);
  }

  /**
   * Removes a question from the profile form (F34).
   *
   * Allowed whatever has already been answered, and **the answers stay**. What
   * somebody wrote about themselves is theirs; the definition was only the
   * question. Refusing to remove a question once a single person answered it
   * would leave an organizer who added one by mistake with no way out, and
   * there is no archive flag for a question that is simply no longer asked.
   *
   * The leftover answers sit in `user_profile.custom_fields_json` under their
   * key. Nothing renders them any more — which is the point of removing the
   * question — and if the same key is ever defined again, the old answers are
   * there and mean what they meant.
   */
  async delete(id: string): Promise<void> {
    if (!(await this.fields.delete(id))) throw new NotFoundException(GONE);
  }

  /**
   * A new order for the profile form (FR 4.3).
   *
   * The complete list of ids, checked to be exactly the questions there are: a
   * partial list would renumber some and leave the rest at positions that no
   * longer mean anything.
   */
  async reorder(ids: readonly string[]): Promise<readonly ProfileField[]> {
    const existing = await this.fields.findAll();

    const wanted = new Set(ids);
    if (wanted.size !== ids.length) {
      throw new BadRequestException('The new order lists a question twice.');
    }
    if (
      wanted.size !== existing.length ||
      existing.some((field) => !wanted.has(field.id))
    ) {
      throw new BadRequestException(
        'The new order has to list every profile question exactly once — ' +
          'reload the form and try again.',
      );
    }

    return (await this.fields.reorder(ids)).map(toField);
  }

  /**
   * Checks one submitted profile form against the questions (E35).
   *
   * Returns what is to be stored: values trimmed, only the questions that were
   * answered, in the order the form asks them.
   *
   * The whole set at once, and that is what makes "required" meaningful: a
   * partial patch could not tell an unanswered required question from one the
   * form did not show. A profile update that leaves `customFields` out
   * therefore never reaches this method — the answers stay exactly as they are.
   *
   * An **unknown key is refused, not dropped**. The global validation pipe
   * already does that for the request's own properties; this is the same rule
   * one level down, for the same reason: a typo in a key that disappears
   * silently costs an answer nobody notices is missing.
   */
  async validateAnswers(
    answers: CustomFieldValues,
  ): Promise<CustomFieldValues> {
    const definitions = await this.fields.findAll();

    const known = new Set(definitions.map((field) => field.key));
    const unknown = unknownFieldKeys(answers, known);
    if (unknown.length > 0) {
      throw new BadRequestException(
        `This profile has no question called ${unknown
          .map((key) => `"${key}"`)
          .join(', ')}.`,
      );
    }

    const stored: Record<string, CustomFieldValue> = {};
    for (const field of definitions) {
      const value = checkAnswer(field, answers[field.key]);
      if (value !== undefined) stored[field.key] = value;
    }
    return stored;
  }

  private async require(id: string): Promise<ProfileFieldRecord> {
    const found = await this.fields.findById(id);
    if (!found) throw new NotFoundException(GONE);
    return found;
  }

  private translate(error: unknown): unknown {
    return error instanceof ProfileFieldKeyTakenError
      ? new ConflictException(`${error.message} — please give it another one.`)
      : error;
  }
}

function toField(record: ProfileFieldRecord): ProfileField {
  return { ...toPublicField(record), id: record.id, sort: record.sort };
}

function toPublicField(record: ProfileFieldRecord): ProfileFieldPublic {
  return {
    key: record.key,
    label: record.label,
    type: record.type,
    helpText: record.helpText,
    options: record.options,
    required: record.required,
  };
}
