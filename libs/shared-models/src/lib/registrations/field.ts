/**
 * The configurable registration form — the field kit (F12, FR 3.5).
 *
 * Every organization asks something different: a conference needs the passport
 * name for the visa letter, a workshop needs dietary requirements, a general
 * assembly needs the member number. Hard-coding those would either make the
 * form too long for everybody or too short for somebody, which is why FR 3.5
 * asks for fields an organizer defines per event.
 *
 * Three properties of these types carry decisions rather than data:
 *
 * 1. **The key is not the label** (F35). The label is what participants read and
 *    what an organizer may correct at any time; the key is what an answer is
 *    stored under and never changes afterwards. Renaming "Where do you come
 *    from?" must not orphan four hundred answers.
 * 2. **An option is its own value.** A select field holds plain strings, so what
 *    the participant chose and what the overview shows are the same text — there
 *    is no mapping table that can go stale.
 * 3. **A file answer is not a value** (F37). The three other types answer with
 *    something that fits in `custom_fields_json`; a file answers with bytes, and
 *    those live in an `attachment` row of their own. Nothing about the file is
 *    duplicated into the JSON, so there is no second copy of it to disagree with
 *    the first.
 */

export type RegistrationFieldType = 'text' | 'select' | 'checkbox' | 'file';

export const REGISTRATION_FIELD_TYPES: readonly RegistrationFieldType[] = [
  'text',
  'select',
  'checkbox',
  'file',
];

/**
 * The three field types whose answer is a value.
 *
 * `file` is the odd one out of the four: its answer is bytes in an `attachment`
 * row rather than an entry in `custom_fields_json` (F37). Anything that renders
 * or checks an *answer* therefore deals with these three — and the profile
 * field kit, which has no registration to hang bytes off, never had a fourth
 * (E35).
 */
export type AnswerableFieldType = Exclude<RegistrationFieldType, 'file'>;

/**
 * A field whose answer is a value, as a form has to draw it.
 *
 * What the two field kits have in common, and the reason the participant client
 * has one form component rather than two (E35): a registration question and a
 * profile question are drawn, labelled and described identically, and only the
 * registration kit adds a fourth type with bytes behind it. Declared here
 * rather than in either kit, because it belongs to neither — the registration
 * kit's own type widens it, the profile kit's *is* it.
 *
 * The server holds the same shape one field narrower, for the same reason:
 * `AnswerableField` in `business/common/field-kit.ts` needs no key to check an
 * answer against a definition (F138). Shared is the rule, not the table.
 */
export interface AnswerableField {
  /** Stable; what the answer is stored under (F35). */
  readonly key: string;
  readonly label: string;
  readonly type: AnswerableFieldType;
  /** Shown under the input — the place to say why something is asked. */
  readonly helpText: string | null;
  /** The choices of a select field; empty for every other type. */
  readonly options: readonly string[];
  /**
   * Whether the form may be submitted without it.
   *
   * Required means required *of the form*, not of every row that already
   * exists: a question added today cannot make yesterday's answers invalid.
   */
  readonly required: boolean;
}

/**
 * What one answer can be.
 *
 * A checkbox answers `true` or `false`; text and select answer with a string.
 * There is no number type: an organizer asking for a number gets a text field,
 * and inventing a numeric type would mean deciding what "invalid" means for
 * every locale's decimal separator.
 */
export type CustomFieldValue = string | boolean;

/** The answers of one registration, keyed by field key. */
export type CustomFieldValues = Readonly<Record<string, CustomFieldValue>>;

/**
 * How long a text answer may be.
 *
 * One bound for every text field rather than a per-field setting: a paragraph
 * fits, and an organizer who has to choose a number for each question is being
 * asked a question they have no way to answer.
 */
export const MAX_CUSTOM_TEXT_LENGTH = 500;

/** As many fields as an organizer can reasonably ask a stranger to fill in. */
export const MAX_REGISTRATION_FIELDS = 30;

/** Beyond this many choices a select field is a text field with extra steps. */
export const MAX_FIELD_OPTIONS = 50;

export const MAX_FIELD_LABEL_LENGTH = 200;
export const MAX_FIELD_HELP_LENGTH = 500;
export const MAX_FIELD_OPTION_LENGTH = 200;
/** Fits `MAX_SLUG_LENGTH` on the server, which derives keys from labels. */
export const MAX_FIELD_KEY_LENGTH = 80;

/** A field as the registration form needs to render it. */
export interface RegistrationFieldPublic {
  /** Stable; what the answer is stored under. */
  readonly key: string;
  readonly label: string;
  readonly type: RegistrationFieldType;
  /** Shown under the input — the place to explain why something is asked. */
  readonly helpText: string | null;
  /** The choices of a select field; empty for every other type. */
  readonly options: readonly string[];
  /**
   * The MIME types a file field accepts; empty for every other type.
   *
   * Chosen from {@link UPLOAD_TYPES} rather than typed (F38), and non-empty for
   * a file field: a field that accepts everything is a field that accepts an
   * executable.
   */
  readonly accept: readonly string[];
  /** The largest file this field takes, in bytes; `null` for every other type. */
  readonly maxSizeBytes: number | null;
  /**
   * Whether the form may be submitted without it.
   *
   * A required checkbox has to be ticked, not merely answered (F36) — a consent
   * box that accepts "no" is not a consent box.
   */
  readonly required: boolean;
}

/** A field as the organizer manages it. */
export interface RegistrationField extends RegistrationFieldPublic {
  readonly id: string;
  readonly eventId: string;
  /** Position in the form, ascending and gapless. */
  readonly sort: number;
}

/**
 * What an organizer sends when defining a field.
 *
 * `key` is optional and normally left out: the server derives it from the label,
 * the same way it derives an event's public address from its name. It can be
 * given for a field whose key has to match something outside the application.
 */
export interface RegistrationFieldInput {
  readonly label: string;
  readonly type: RegistrationFieldType;
  readonly key?: string;
  readonly helpText?: string | null;
  readonly options?: readonly string[];
  readonly accept?: readonly string[];
  /** Defaults to {@link DEFAULT_UPLOAD_MAX_BYTES} for a file field. */
  readonly maxSizeBytes?: number;
  readonly required?: boolean;
}

/** Changing a field: everything except its type, which its answers depend on. */
export type RegistrationFieldChange = Partial<
  Omit<RegistrationFieldInput, 'type' | 'key'>
>;

/**
 * A new order for one event's fields — the complete list of ids, in order.
 *
 * The whole list rather than "move this one up": two requests that each move a
 * field can otherwise interleave into an order neither organizer asked for.
 */
export interface RegistrationFieldOrder {
  readonly ids: readonly string[];
}

/**
 * The two words a ticked box can read as, in the reader's language.
 *
 * Passed in rather than looked up: this library knows no catalogue, and a tick
 * is shown in three places in two clients, each of which has one (NFR 4).
 */
export interface AnswerWords {
  readonly yes: string;
  readonly no: string;
}

/**
 * How an answer reads in a table or a detail view.
 *
 * In one place, because the overview, the detail panel and later the export all
 * have to say the same thing about the same answer — and because "false" is not
 * what an organizer should read where "no" is meant.
 *
 * The two words are an **argument, and a required one** (AP 13 of phase 3):
 * until then this function answered `yes` and `no` in English and both clients
 * printed that as it came, in screens an organization reads in its own language
 * (NFR 4). A default would have kept that bug available, so there is none —
 * whoever formats an answer says in which words. The dash for an unanswered
 * question stays here: it is punctuation, not a word.
 *
 * Not for a file field: what was uploaded is an {@link AttachmentSummary}, and
 * a file field with nothing uploaded reads as the same dash as any other
 * unanswered question.
 */
export function formatAnswer(
  value: CustomFieldValue | undefined,
  words: AnswerWords,
): string {
  if (value === undefined || value === '') return '—';
  if (value === true) return words.yes;
  if (value === false) return words.no;
  return value;
}
