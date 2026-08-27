import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type {
  CustomFieldValue,
  CustomFieldValues,
  RegistrationField,
  RegistrationFieldChange,
  RegistrationFieldInput,
  RegistrationFieldPublic,
} from '@trefaro/shared-models';
import {
  DEFAULT_UPLOAD_MAX_BYTES,
  MAX_CUSTOM_TEXT_LENGTH,
  MAX_FIELD_OPTIONS,
  MAX_FILE_FIELDS,
  MAX_REGISTRATION_FIELDS,
  MAX_SUBMISSION_BYTES,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_MAX_BYTES,
  UPLOAD_MIME_TYPES,
  UPLOAD_TYPES,
  formatBytes,
  uploadTypeLabel,
} from '@trefaro/shared-models';
import {
  matchesSignature,
  safeFileName,
  type UploadedFile,
} from '../attachments';
import { isSlug, slugify } from '../common/slug';
import { EventsService } from '../events';
import {
  REGISTRATION_FIELD_REPOSITORY,
  RegistrationFieldKeyTakenError,
  type RegistrationFieldRecord,
  type RegistrationFieldRepository,
} from './ports/registration-field.repository';

/**
 * What one submitted form turned out to hold, once checked against the fields.
 *
 * The two halves go to two different places — the values into the registration
 * row, the files into the attachment store — and they are returned together
 * because both were checked against the same definitions in the same pass.
 */
export interface CheckedSubmission {
  readonly customFields: CustomFieldValues;
  /** Ready to be stored: type verified, size checked, file name made safe. */
  readonly uploads: readonly UploadedFile[];
}

/** Used when a label transliterates to nothing usable — see `slugify`. */
const FALLBACK_KEY = 'field';

/** How many numbered variants of a key to try before asking for one. */
const MAX_KEY_ATTEMPTS = 50;

/**
 * Keys the core registration already owns (F35).
 *
 * A custom field under one of these would collide with a column of the same
 * meaning the moment anything flattens a registration into one record — the
 * participant export of phase 5, or a mail template. Cheaper to refuse six words
 * now than to discover the collision in a spreadsheet an organizer sent out.
 */
const RESERVED_KEYS: readonly string[] = [
  'email',
  'first-name',
  'last-name',
  'phone',
  'origin',
  'status',
];

/**
 * The configurable registration form (F12, FR 3.5, UC 07).
 *
 * Every organization asks something different, so FR 3.5 asks for fields the
 * organizer defines per event rather than a fixed form. This service owns both
 * ends of that: the definitions an organizer manages, and the validation of the
 * answers a participant sends.
 *
 * Both ends live here on purpose. The rule that decides whether an answer is
 * acceptable is the field definition itself, and a validator that sat anywhere
 * else would be a second copy of it — the kind of copy that drifts and then
 * accepts what the form refuses.
 *
 * What this service will not do:
 *
 * - **Change a field's type or its key** (F35). A select turned into a checkbox
 *   would leave every answer already given as an invalid value of the new type.
 *   Deleting the field and defining a new one is the honest way to say that.
 * - **Delete the answers of a deleted field** (F34). What somebody wrote is
 *   theirs; the definition is only the question. The overview shows leftover
 *   answers as no longer asked for instead of hiding them.
 */
@Injectable()
export class RegistrationFieldsService {
  constructor(
    @Inject(REGISTRATION_FIELD_REPOSITORY)
    private readonly fields: RegistrationFieldRepository,
    private readonly events: EventsService,
  ) {}

  /** One event's fields as the organizer manages them (FR 3.5). */
  async listForOrganizer(
    eventId: string,
  ): Promise<readonly RegistrationField[]> {
    // Resolving the event first turns an unknown id into a 404 rather than an
    // empty list, which would read as "this form has no extra fields".
    await this.events.getForOrganizer(eventId);
    return (await this.fields.findByEvent(eventId)).map(toField);
  }

  /**
   * The fields the public registration form has to render.
   *
   * Through the public event lookup, so the form of a draft event — or of an
   * event in a series nobody can see — is not readable either (F26).
   */
  async listPublic(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<readonly RegistrationFieldPublic[]> {
    const event = await this.events.getPublic(seriesSlug, eventSlug);
    return (await this.fields.findByEvent(event.id)).map(toPublicField);
  }

  async create(
    eventId: string,
    input: RegistrationFieldInput,
  ): Promise<RegistrationField> {
    await this.events.getForOrganizer(eventId);

    const existing = await this.fields.findByEvent(eventId);
    if (existing.length >= MAX_REGISTRATION_FIELDS) {
      throw new ConflictException(
        `A registration form holds at most ${MAX_REGISTRATION_FIELDS} extra ` +
          'fields. Remove one before adding another.',
      );
    }

    if (input.type === 'file') {
      const files = existing.filter((field) => field.type === 'file').length;
      if (files >= MAX_FILE_FIELDS) {
        throw new ConflictException(
          `A form asks for at most ${MAX_FILE_FIELDS} files. Remove one ` +
            'before adding another.',
        );
      }
    }

    const label = this.label(input.label);
    const key = this.availableKey(
      existing,
      this.requestedKey(input.key, label),
    );

    try {
      return toField(
        await this.fields.create({
          eventId,
          key,
          label,
          type: input.type,
          helpText: optional(input.helpText),
          options: this.options(input.type, input.options),
          accept: this.accept(input.type, input.accept),
          maxSizeBytes: this.maxSize(input.type, input.maxSizeBytes),
          required: input.required ?? false,
          // Appended: a new question belongs at the end of the form, not in the
          // middle of one people are already filling in.
          sort: existing.length,
        }),
      );
    } catch (error: unknown) {
      throw this.translate(error);
    }
  }

  /**
   * Changes a field — everything except its type and its key.
   *
   * The label may be corrected at any time: the key an answer is stored under
   * does not follow it, which is exactly what lets a question be rephrased
   * without orphaning the answers already given.
   */
  async update(
    id: string,
    change: RegistrationFieldChange,
  ): Promise<RegistrationField> {
    const field = await this.require(id);

    const updated = await this.fields.update(id, {
      ...(change.label === undefined
        ? {}
        : { label: this.label(change.label) }),
      ...(change.helpText === undefined
        ? {}
        : { helpText: optional(change.helpText) }),
      ...(change.options === undefined
        ? {}
        : { options: this.options(field.type, change.options) }),
      ...(change.accept === undefined
        ? {}
        : { accept: this.accept(field.type, change.accept) }),
      ...(change.maxSizeBytes === undefined
        ? {}
        : { maxSizeBytes: this.maxSize(field.type, change.maxSizeBytes) }),
      ...(change.required === undefined ? {} : { required: change.required }),
    });
    if (!updated) throw new NotFoundException(GONE);
    return toField(updated);
  }

  /**
   * Removes a field from the form (F34).
   *
   * Allowed whatever has already been answered. The alternative — refusing once
   * a single participant answered — would leave an organizer who added a field
   * by mistake with no way out, and there is no archive flag for a question that
   * is simply no longer asked.
   *
   * The answers stay in `registration.custom_fields_json`. They are what people
   * wrote, and the participant overview shows them under their key rather than
   * dropping them silently.
   */
  async delete(id: string): Promise<void> {
    if (!(await this.fields.delete(id))) throw new NotFoundException(GONE);
  }

  /**
   * A new order for one event's form (FR 3.5).
   *
   * The complete list of ids, checked to be exactly this event's fields: a
   * partial list would renumber some fields and leave the rest at positions that
   * no longer mean anything.
   */
  async reorder(
    eventId: string,
    ids: readonly string[],
  ): Promise<readonly RegistrationField[]> {
    await this.events.getForOrganizer(eventId);
    const existing = await this.fields.findByEvent(eventId);

    const wanted = new Set(ids);
    if (wanted.size !== ids.length) {
      throw new BadRequestException('The new order lists a field twice.');
    }
    if (
      wanted.size !== existing.length ||
      existing.some((field) => !wanted.has(field.id))
    ) {
      throw new BadRequestException(
        'The new order has to list every field of this event exactly once — ' +
          'reload the form and try again.',
      );
    }

    return (await this.fields.reorder(eventId, ids)).map(toField);
  }

  /**
   * Checks one submitted form against this event's fields (F12).
   *
   * Returns what is to be stored: values trimmed, only the fields that were
   * answered, in the order the form asks them — and the files, checked against
   * the same definitions in the same pass.
   *
   * An **unknown key is refused, not dropped**, and that holds for a file part
   * as much as for a value. The global validation pipe already does it for the
   * request's own properties; this is the same rule one level down, and for the
   * same reason: a typo in a key that disappears silently costs an answer nobody
   * notices is missing.
   *
   * Nothing here writes anything. Every check happens before the registration
   * row and before a single byte reaches the volume, so a refused form leaves no
   * pending registration, no mail and no file behind.
   */
  async validateSubmission(
    eventId: string,
    answers: CustomFieldValues | undefined,
    files: readonly UploadedFile[] = [],
  ): Promise<CheckedSubmission> {
    const definitions = await this.fields.findByEvent(eventId);
    const given = answers ?? {};

    const known = new Map(definitions.map((field) => [field.key, field]));
    const unknown = Object.keys(given).filter((key) => !known.has(key));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `This registration form has no field called ${unknown
          .map((key) => `"${key}"`)
          .join(', ')}.`,
      );
    }
    this.assertFilesBelong(known, files);
    this.assertFitsInOneRequest(files);

    const stored: Record<string, CustomFieldValue> = {};
    const uploads: UploadedFile[] = [];
    for (const field of definitions) {
      if (field.type === 'file') {
        const upload = this.upload(field, files, given[field.key]);
        if (upload) uploads.push(upload);
        continue;
      }
      const value = this.answer(field, given[field.key]);
      if (value !== undefined) stored[field.key] = value;
    }
    return { customFields: stored, uploads };
  }

  /**
   * Refuses a submission larger than one request may carry.
   *
   * Before the per-field checks, because this is about the request rather than
   * about any one answer — and 413 rather than 400, like the per-file ceiling the
   * multipart parser enforces. The reverse proxy of a production instance has a
   * body limit of its own; this one sits below it so that the answer comes from
   * the application and says what is wrong.
   */
  private assertFitsInOneRequest(files: readonly UploadedFile[]): void {
    const total = files.reduce((sum, file) => sum + file.bytes.length, 0);
    if (total > MAX_SUBMISSION_BYTES) {
      throw new PayloadTooLargeException(
        `One registration carries at most ${formatBytes(MAX_SUBMISSION_BYTES)} ` +
          `of files; these are ${formatBytes(total)}. Please send fewer or ` +
          'smaller files.',
      );
    }
  }

  /**
   * Refuses a file part that no file field asked for.
   *
   * Two cases, told apart because they are different mistakes: a part naming a
   * field that does not exist, and a part naming a field that exists but does not
   * ask for a file.
   */
  private assertFilesBelong(
    known: Map<string, RegistrationFieldRecord>,
    files: readonly UploadedFile[],
  ): void {
    for (const upload of files) {
      const field = known.get(upload.fieldKey);
      if (!field) {
        throw new BadRequestException(
          `This registration form has no field called "${upload.fieldKey}".`,
        );
      }
      if (field.type !== 'file') {
        throw new BadRequestException(
          `"${field.label}" is not answered with a file.`,
        );
      }
    }
  }

  /**
   * One uploaded file, checked against one file field (E9).
   *
   * Four checks, in the order in which they get cheaper to be wrong about: the
   * field is answered at all, the type is one the field accepts, the size is
   * within its limit, and the bytes are actually of that type. The last one is
   * the reason the others are not enough — the type of a multipart part is set by
   * whoever sends the request.
   */
  private upload(
    field: RegistrationFieldRecord,
    files: readonly UploadedFile[],
    value: CustomFieldValue | undefined,
  ): UploadedFile | undefined {
    if (value !== undefined) {
      throw new BadRequestException(
        `"${field.label}" is answered with a file, not with a value.`,
      );
    }

    const parts = files.filter((upload) => upload.fieldKey === field.key);
    if (parts.length > 1) {
      throw new BadRequestException(
        `"${field.label}" takes one file, and ${parts.length} were sent.`,
      );
    }

    const upload = parts[0];
    if (!upload) {
      if (field.required) throw this.missing(field);
      return undefined;
    }

    if (upload.bytes.length === 0) {
      throw new BadRequestException(`The file for "${field.label}" is empty.`);
    }

    // A browser may append a charset; the type is what precedes it.
    const mimeType = (upload.mimeType.split(';')[0] ?? '').trim().toLowerCase();
    if (!field.accept.includes(mimeType)) {
      throw new BadRequestException(
        `"${field.label}" takes ${field.accept
          .map(uploadTypeLabel)
          .join(', ')} — this file says it is ${mimeType || 'of no type'}.`,
      );
    }

    const limit = field.maxSizeBytes ?? MAX_UPLOAD_BYTES;
    if (upload.bytes.length > limit) {
      throw new BadRequestException(
        `"${field.label}" takes files up to ${formatBytes(limit)}; this one is ` +
          `${formatBytes(upload.bytes.length)}.`,
      );
    }

    if (!matchesSignature(mimeType, upload.bytes)) {
      throw new BadRequestException(
        `This file is not ${uploadTypeLabel(mimeType)}, whatever it is called.`,
      );
    }

    return {
      fieldKey: field.key,
      fileName: safeFileName(upload.fileName),
      mimeType,
      bytes: upload.bytes,
    };
  }

  /**
   * One answer, checked against one field.
   *
   * `undefined` means "not answered" — which is only acceptable for a field that
   * is not required.
   */
  private answer(
    field: RegistrationFieldRecord,
    value: CustomFieldValue | undefined,
  ): CustomFieldValue | undefined {
    if (field.type === 'checkbox') {
      if (value === undefined) {
        // A required checkbox has to be ticked, not merely answered (F36): a
        // consent box that accepts "no" is not a consent box.
        if (field.required) throw this.missing(field);
        return undefined;
      }
      if (typeof value !== 'boolean') {
        throw new BadRequestException(
          `"${field.label}" is a checkbox and takes true or false.`,
        );
      }
      if (field.required && !value) throw this.missing(field);
      return value;
    }

    if (value !== undefined && typeof value !== 'string') {
      throw new BadRequestException(`"${field.label}" takes text.`);
    }

    // An empty string is no answer at all (F36): "answered with nothing" and
    // "not answered" are the same thing for a text or a selection field.
    const text = (value ?? '').trim();
    if (text.length === 0) {
      if (field.required) throw this.missing(field);
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

  private missing(field: RegistrationFieldRecord): BadRequestException {
    return new BadRequestException(`"${field.label}" is required.`);
  }

  private async require(id: string): Promise<RegistrationFieldRecord> {
    const found = await this.fields.findById(id);
    if (!found) throw new NotFoundException(GONE);
    return found;
  }

  private label(value: string): string {
    const label = value.trim();
    if (label.length === 0) {
      throw new BadRequestException('A field needs a label participants read.');
    }
    return label;
  }

  /**
   * The choices of a select field.
   *
   * Duplicates are dropped rather than refused — two identical entries in a
   * dropdown are a slip of the paste buffer, not an intention. A select without
   * any choice left is refused: an empty dropdown is a field nobody can fill in.
   */
  private options(
    type: RegistrationFieldRecord['type'],
    values: readonly string[] | undefined,
  ): readonly string[] {
    if (type !== 'select') {
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
   * The file types a field accepts (F38).
   *
   * From the catalogue and never free text: an allowlist an organizer types is a
   * way to accept an executable, and choosing between five named formats is a
   * question somebody organizing a conference can answer — "which MIME types
   * should this instance store" is not.
   *
   * Non-empty for a file field, for the same reason a select needs a choice: a
   * field that accepts everything is the one setting nobody meant to make.
   */
  private accept(
    type: RegistrationFieldRecord['type'],
    values: readonly string[] | undefined,
  ): readonly string[] {
    if (type !== 'file') {
      if (values && values.length > 0) {
        throw new BadRequestException(
          'Only a file field has accepted file types.',
        );
      }
      return [];
    }

    const accept = [
      ...new Set(
        (values ?? [])
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (accept.length === 0) {
      throw new BadRequestException(
        'A file field needs at least one accepted file type.',
      );
    }

    const unsupported = accept.filter(
      (mimeType) => !UPLOAD_MIME_TYPES.includes(mimeType),
    );
    if (unsupported.length > 0) {
      throw new BadRequestException(
        `This instance does not store ${unsupported.join(', ')}. It accepts ` +
          `${UPLOAD_TYPES.map((entry) => entry.label).join(', ')}.`,
      );
    }
    return accept;
  }

  /**
   * The size limit of a file field, in bytes.
   *
   * The organizer's limit fits the document they are asking for; the ceiling
   * {@link MAX_UPLOAD_BYTES} is what this server will read at all, and it is not
   * negotiable per field because the endpoint that accepts files is public.
   */
  private maxSize(
    type: RegistrationFieldRecord['type'],
    value: number | null | undefined,
  ): number | null {
    if (type !== 'file') {
      if (value !== undefined && value !== null) {
        throw new BadRequestException('Only a file field has a size limit.');
      }
      return null;
    }

    const bytes = value ?? DEFAULT_UPLOAD_MAX_BYTES;
    if (
      !Number.isInteger(bytes) ||
      bytes < MIN_UPLOAD_MAX_BYTES ||
      bytes > MAX_UPLOAD_BYTES
    ) {
      throw new BadRequestException(
        `A file field's limit is between ${formatBytes(MIN_UPLOAD_MAX_BYTES)} ` +
          `and ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      );
    }
    return bytes;
  }

  /**
   * An explicit key is taken literally; otherwise the label decides.
   *
   * Literally, and refused when it is not a key: a key is given precisely when
   * it has to match something outside this application, and quietly rewriting it
   * into something similar would defeat the only reason to send one.
   */
  private requestedKey(requested: string | undefined, label: string): string {
    const cleaned =
      requested === undefined ? slugify(label) : requested.trim().toLowerCase();
    if (requested !== undefined && !isSlug(cleaned)) {
      throw new BadRequestException(
        'A field key is made of lower-case letters, digits and single hyphens.',
      );
    }
    if (RESERVED_KEYS.includes(cleaned)) {
      throw new ConflictException(
        `"${cleaned}" is what the registration already calls one of its own ` +
          'fields. Please phrase the question differently, or give the field ' +
          'its own key.',
      );
    }
    return cleaned;
  }

  /**
   * First free variant within the event: `diet`, then `diet-2`, …
   *
   * The same treatment an event's public address gets: two questions that
   * shorten to the same key are a normal thing to want, and refusing the second
   * one would be a dead end an organizer cannot see the cause of.
   */
  private availableKey(
    existing: readonly RegistrationFieldRecord[],
    base: string,
  ): string {
    const root = base || FALLBACK_KEY;
    const taken = new Set(existing.map((field) => field.key));

    for (let attempt = 1; attempt <= MAX_KEY_ATTEMPTS; attempt += 1) {
      const candidate = attempt === 1 ? root : `${root}-${attempt}`;
      if (!taken.has(candidate)) return candidate;
    }

    throw new ConflictException(
      `Could not derive a free key from "${root}" — please give the field one.`,
    );
  }

  private translate(error: unknown): unknown {
    return error instanceof RegistrationFieldKeyTakenError
      ? new ConflictException(`${error.message} — please give it another one.`)
      : error;
  }
}

/** Said the same way wherever a field cannot be found any more. */
const GONE = 'This registration field no longer exists.';

/** An emptied help text means "no help text", not the empty string. */
function optional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toField(record: RegistrationFieldRecord): RegistrationField {
  return {
    ...toPublicField(record),
    id: record.id,
    eventId: record.eventId,
    sort: record.sort,
  };
}

function toPublicField(
  record: RegistrationFieldRecord,
): RegistrationFieldPublic {
  return {
    key: record.key,
    label: record.label,
    type: record.type,
    helpText: record.helpText,
    options: record.options,
    accept: record.accept,
    maxSizeBytes: record.maxSizeBytes,
    required: record.required,
  };
}
