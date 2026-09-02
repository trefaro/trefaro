import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  OrganizerEvent,
  RegistrationField,
  RegistrationFieldType,
} from '@trefaro/shared-models';
import {
  DEFAULT_UPLOAD_MAX_BYTES,
  MAX_FIELD_HELP_LENGTH,
  MAX_FIELD_LABEL_LENGTH,
  MAX_REGISTRATION_FIELDS,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
  formatBytes,
  uploadTypeLabelKey,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import {
  choiceLines,
  inputChecked,
  inputNumber,
  inputValue,
  lines,
} from '../../features/fields/field-editing';
import { fieldTypeKey } from '../../features/i18n/labels';
import { RegistrationFieldsAdminService } from '../../features/registrations/registration-fields-admin.service';

/** What the row's inputs hold until they are saved. */
interface FieldDraft {
  label: string;
  helpText: string;
  /** One choice per line — see the note in the template. */
  optionsText: string;
  /** Accepted MIME types of a file field, from the catalogue (F38). */
  accept: string[];
  /** The size limit as an organizer states it; stored in bytes. */
  maxSizeMb: number;
  required: boolean;
}

/** Bytes are what the field stores; megabytes are what a person types. */
const BYTES_PER_MB = 1024 * 1024;

function toMegabytes(bytes: number | null): number {
  return (
    Math.round(((bytes ?? DEFAULT_UPLOAD_MAX_BYTES) / BYTES_PER_MB) * 10) / 10
  );
}

function toBytes(megabytes: number): number {
  const bytes = Math.round(megabytes * BYTES_PER_MB);
  return Math.min(MAX_UPLOAD_BYTES, Math.max(MIN_UPLOAD_MAX_BYTES, bytes));
}

/**
 * Building the registration form of one event (F12, FR 3.5, UC 07).
 *
 * FR 3.5 asks for a form the organizer configures, because every organization
 * asks something different: a conference needs the passport name for the visa
 * letter, a workshop needs dietary requirements. The five fields the
 * registration always has — first name, last name, e-mail, phone, origin — are
 * not managed here; everything beyond them is.
 *
 * Two interface decisions worth naming:
 *
 * 1. **The choices of a selection field are one text box, one choice per line.**
 *    A list of inputs with add and remove buttons is more machinery for a
 *    smaller gain; typing four lines is something everybody can already do.
 * 2. **A field's key is shown but not editable.** It is what the answers are
 *    stored under, and the whole point of separating it from the label is that
 *    rephrasing a question leaves the answers where they are.
 *
 * The badge on a row and the "kind of answer" box draw from the same four keys.
 * The badge used to print the stored word — `select` — and giving it a second,
 * shorter vocabulary would mean two names for one thing in one screen.
 */
@Component({
  selector: 'trefaro-registration-fields-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    <header class="head">
      <div>
        <h1>{{ 'admin.fields.title' | transloco }}</h1>
        <p class="meta">
          @if (event(); as item) {
            <a [routerLink]="['/series', seriesId(), 'events', item.id]">
              {{ item.name }}
            </a>
          }
          <span>{{ 'admin.fields.intro' | transloco }}</span>
        </p>
      </div>
      <a
        class="back"
        [routerLink]="['/series', seriesId(), 'events', eventId()]"
      >
        {{ 'admin.events.back' | transloco }}
      </a>
    </header>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    <section aria-labelledby="fields-heading">
      <h2 id="fields-heading">
        {{ 'admin.fields.yourQuestions' | transloco }}
      </h2>

      @if (fields().length === 0) {
        <p class="meta">
          {{
            (loading() ? 'common.loading' : 'admin.fields.empty') | transloco
          }}
        </p>
      }

      <ol class="fields">
        @for (field of fields(); track field.id; let index = $index) {
          <li class="field">
            <div class="field__head">
              <span class="badge">
                {{ typeKey(field.type) | transloco }}
              </span>
              <span class="meta">
                {{ 'admin.fields.storedAs' | transloco: { key: field.key } }}
              </span>
              <div class="field__order">
                <button
                  type="button"
                  [attr.aria-label]="
                    'admin.fields.moveUp' | transloco: { label: field.label }
                  "
                  [disabled]="index === 0 || busy()"
                  (click)="move(index, -1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  [attr.aria-label]="
                    'admin.fields.moveDown' | transloco: { label: field.label }
                  "
                  [disabled]="index === fields().length - 1 || busy()"
                  (click)="move(index, 1)"
                >
                  ↓
                </button>
              </div>
            </div>

            <label>
              <span>{{ 'admin.fields.question' | transloco }}</span>
              <input
                [attr.maxlength]="maxLabelLength"
                [value]="draft(field.id).label"
                (input)="edit(field.id, { label: value($event) })"
              />
            </label>

            <label>
              <span>{{ 'admin.fields.explanation' | transloco }}</span>
              <input
                [attr.maxlength]="maxHelpLength"
                [placeholder]="
                  'admin.fields.explanationPlaceholder' | transloco
                "
                [value]="draft(field.id).helpText"
                (input)="edit(field.id, { helpText: value($event) })"
              />
            </label>

            @if (field.type === 'select') {
              <label>
                <span>{{ 'admin.fields.choices' | transloco }}</span>
                <textarea
                  rows="4"
                  [value]="draft(field.id).optionsText"
                  (input)="edit(field.id, { optionsText: value($event) })"
                ></textarea>
              </label>
              <small class="meta">
                {{ 'admin.fields.choicesHint' | transloco }}
              </small>
            }

            @if (field.type === 'file') {
              <fieldset class="types">
                <legend>{{ 'admin.fields.acceptedTypes' | transloco }}</legend>
                @for (type of uploadTypes; track type.mimeType) {
                  <label class="check">
                    <input
                      type="checkbox"
                      [checked]="draft(field.id).accept.includes(type.mimeType)"
                      (change)="toggle(field.id, type.mimeType)"
                    />
                    <span>{{ typeLabelKey(type.mimeType) | transloco }}</span>
                  </label>
                }
              </fieldset>
              <label>
                <span>{{ 'admin.fields.maxSize' | transloco }}</span>
                <input
                  type="number"
                  [attr.min]="minMegabytes"
                  [attr.max]="maxMegabytes"
                  step="0.5"
                  [value]="draft(field.id).maxSizeMb"
                  (input)="edit(field.id, { maxSizeMb: number($event) })"
                />
              </label>
              <small class="meta">
                {{
                  'admin.fields.maxSizeHint' | transloco: { limit: ceiling() }
                }}
              </small>
            }

            <label class="check">
              <input
                type="checkbox"
                [checked]="draft(field.id).required"
                (change)="edit(field.id, { required: checked($event) })"
              />
              <span>
                {{
                  (field.type === 'checkbox'
                    ? 'admin.fields.requiredTicked'
                    : 'admin.fields.required'
                  ) | transloco
                }}
              </span>
            </label>

            <div class="field__actions">
              <button
                type="button"
                [disabled]="busy() || !changed(field)"
                (click)="save(field)"
              >
                {{ 'admin.common.save' | transloco }}
              </button>
              <button
                type="button"
                class="danger"
                [disabled]="busy()"
                (click)="remove(field)"
              >
                {{ 'admin.common.delete' | transloco }}
              </button>
            </div>
          </li>
        }
      </ol>
    </section>

    <section aria-labelledby="add-heading">
      <h2 id="add-heading">{{ 'admin.fields.addHeading' | transloco }}</h2>
      @if (full()) {
        <p class="meta">
          {{ 'admin.fields.full' | transloco: { count: maxFields } }}
        </p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="add()" novalidate>
          <label>
            <span>{{ 'admin.fields.question' | transloco }}</span>
            <input
              formControlName="label"
              [attr.maxlength]="maxLabelLength"
              [placeholder]="'admin.fields.questionPlaceholder' | transloco"
            />
          </label>

          <label>
            <span>{{ 'admin.fields.answerKind' | transloco }}</span>
            <select formControlName="type">
              @for (type of fieldTypes; track type) {
                <option [value]="type">{{ typeKey(type) | transloco }}</option>
              }
            </select>
          </label>

          @if (newType() === 'select') {
            <label>
              <span>{{ 'admin.fields.choices' | transloco }}</span>
              <textarea
                formControlName="optionsText"
                rows="4"
                [placeholder]="'admin.fields.choicesPlaceholder' | transloco"
              ></textarea>
            </label>
            <small class="meta">
              {{ 'admin.fields.choicesHint' | transloco }}
            </small>
          }

          @if (newType() === 'file') {
            <fieldset class="types">
              <legend>{{ 'admin.fields.acceptedTypes' | transloco }}</legend>
              @for (type of uploadTypes; track type.mimeType) {
                <label class="check">
                  <input
                    type="checkbox"
                    [checked]="newAccept().includes(type.mimeType)"
                    (change)="toggleNew(type.mimeType)"
                  />
                  <span>{{ typeLabelKey(type.mimeType) | transloco }}</span>
                </label>
              }
            </fieldset>
            <label>
              <span>{{ 'admin.fields.maxSize' | transloco }}</span>
              <input
                formControlName="maxSizeMb"
                type="number"
                [attr.min]="minMegabytes"
                [attr.max]="maxMegabytes"
                step="0.5"
              />
            </label>
            <small class="meta">
              {{ 'admin.fields.fileHint' | transloco: { limit: ceiling() } }}
            </small>
          }

          <label>
            <span>{{ 'admin.fields.explanation' | transloco }}</span>
            <input
              formControlName="helpText"
              [attr.maxlength]="maxHelpLength"
              [placeholder]="'admin.fields.explanationPlaceholder' | transloco"
            />
          </label>

          <label class="check">
            <input formControlName="required" type="checkbox" />
            <span>{{ 'admin.fields.required' | transloco }}</span>
          </label>

          <button type="submit" [disabled]="busy()">
            {{ 'admin.fields.add' | transloco }}
          </button>
        </form>
      }
    </section>
  `,
  styles: `
    .head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .error {
      padding: 0.6rem 0.8rem;
      border-radius: 0.4rem;
      background: color-mix(in oklab, currentColor 8%, transparent);
      color: var(--trefaro-color-primary-strong);
    }

    section {
      margin-block-start: 2rem;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
      border-radius: 0.5rem;
      max-inline-size: 40rem;
    }

    .types {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      margin: 0;
      padding: 0.6rem 0.8rem;
      border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
      border-radius: 0.4rem;
    }

    .types legend {
      padding-inline: 0.3rem;
      font-weight: 600;
    }

    .field__head {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .field__order {
      margin-inline-start: auto;
      display: flex;
      gap: 0.3rem;
    }

    .badge {
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      background: color-mix(
        in oklab,
        var(--trefaro-color-accent) 25%,
        transparent
      );
      font-size: 0.8rem;
      font-weight: 600;
    }

    code {
      font-size: 0.85rem;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      max-inline-size: 40rem;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    label > span {
      font-weight: 600;
    }

    input,
    select,
    textarea {
      padding: 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    .check {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
    }

    .check > span {
      font-weight: 400;
    }

    .check input {
      inline-size: 1.1rem;
      block-size: 1.1rem;
    }

    .field__actions {
      display: flex;
      gap: 0.5rem;
    }

    button {
      align-self: start;
      padding: 0.45rem 0.9rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    button[type='submit'] {
      border: 0;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
    }

    button:disabled {
      opacity: 0.5;
    }

    .danger {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class RegistrationFieldsPage {
  /** Both bound from the route by `withComponentInputBinding()`. */
  readonly seriesId = input.required<string>();
  readonly eventId = input.required<string>();

  protected readonly maxLabelLength = MAX_FIELD_LABEL_LENGTH;
  protected readonly maxHelpLength = MAX_FIELD_HELP_LENGTH;
  protected readonly maxFields = MAX_REGISTRATION_FIELDS;
  protected readonly uploadTypes = UPLOAD_TYPES;
  protected readonly minMegabytes = toMegabytes(MIN_UPLOAD_MAX_BYTES);
  protected readonly maxMegabytes = toMegabytes(MAX_UPLOAD_BYTES);
  protected readonly typeLabelKey = uploadTypeLabelKey;
  /** The four kinds of answer, in the order the box offers them. */
  protected readonly fieldTypes: readonly RegistrationFieldType[] = [
    'text',
    'select',
    'checkbox',
    'file',
  ];

  private readonly i18n = inject(TranslationService);

  /** A size is a format, so it follows the reader rather than the event (F78). */
  protected ceiling(): string {
    return formatBytes(MAX_UPLOAD_BYTES, this.i18n.locale());
  }

  /**
   * Shared with the profile form's editor, because the word is the same word
   * (F83): both name a *stored* type, and two vocabularies for one stored word
   * would be two places a rewording can land in.
   */
  protected readonly typeKey = fieldTypeKey;

  private readonly fieldsService = inject(RegistrationFieldsAdminService);
  private readonly events = inject(EventsAdminService);

  protected readonly event = signal<OrganizerEvent | null>(null);
  protected readonly fields = signal<readonly RegistrationField[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  /** What the row inputs hold, keyed by field id, until Save is pressed. */
  private readonly drafts = signal<Record<string, FieldDraft>>({});

  protected readonly full = computed(
    () => this.fields().length >= MAX_REGISTRATION_FIELDS,
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    label: ['', Validators.required],
    type: ['text' as RegistrationFieldType],
    optionsText: [''],
    maxSizeMb: [toMegabytes(DEFAULT_UPLOAD_MAX_BYTES)],
    helpText: [''],
    required: [false],
  });

  /**
   * The accepted types of the question being added.
   *
   * A signal rather than a form control: what a checkbox list holds is a set,
   * and a `FormArray` of booleans would only make the mapping to MIME types
   * somebody else's problem.
   */
  protected readonly newAccept = signal<string[]>([]);

  /**
   * The kind of answer the new question asks — mirrored into a signal.
   *
   * A form control's value is not reactive on its own, and the choices box has
   * to appear the moment "one of several choices" is picked.
   */
  protected readonly newType = signal<RegistrationFieldType>('text');

  constructor() {
    this.form.controls.type.valueChanges.subscribe((type) =>
      this.newType.set(type),
    );

    effect(() => {
      void this.loadEvent(this.eventId());
    });

    effect(() => {
      void this.loadFields(this.eventId());
    });
  }

  protected readonly value = inputValue;
  protected readonly checked = inputChecked;
  protected readonly number = inputNumber;

  /** Ticks or unticks one accepted type of the question being added. */
  protected toggleNew(mimeType: string): void {
    this.newAccept.update((accept) =>
      accept.includes(mimeType)
        ? accept.filter((entry) => entry !== mimeType)
        : [...accept, mimeType],
    );
  }

  /** The same for a question that already exists. */
  protected toggle(id: string, mimeType: string): void {
    const accept = this.draft(id).accept;
    this.edit(id, {
      accept: accept.includes(mimeType)
        ? accept.filter((entry) => entry !== mimeType)
        : [...accept, mimeType],
    });
  }

  protected draft(id: string): FieldDraft {
    return this.drafts()[id] ?? blankDraft();
  }

  protected edit(id: string, patch: Partial<FieldDraft>): void {
    this.drafts.update((drafts) => ({
      ...drafts,
      [id]: { ...this.draft(id), ...patch },
    }));
  }

  /** Whether this row differs from what the server holds. */
  protected changed(field: RegistrationField): boolean {
    const draft = this.draft(field.id);
    const saved = draftOf(field);
    return (
      draft.label !== saved.label ||
      draft.helpText !== saved.helpText ||
      draft.optionsText !== saved.optionsText ||
      draft.accept.join(',') !== saved.accept.join(',') ||
      draft.maxSizeMb !== saved.maxSizeMb ||
      draft.required !== saved.required
    );
  }

  protected async add(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    await this.change(async () => {
      await this.fieldsService.create(this.eventId(), {
        label: raw.label,
        type: raw.type,
        helpText: raw.helpText.trim() || null,
        options: raw.type === 'select' ? lines(raw.optionsText) : [],
        // Only where they mean something: the server refuses accepted types on
        // a field that is not a file field, and it is right to.
        ...(raw.type === 'file'
          ? {
              accept: this.newAccept(),
              maxSizeBytes: toBytes(raw.maxSizeMb),
            }
          : {}),
        required: raw.required,
      });
      this.form.reset({
        type: raw.type,
        maxSizeMb: toMegabytes(DEFAULT_UPLOAD_MAX_BYTES),
      });
      this.newAccept.set([]);
    });
  }

  protected async save(field: RegistrationField): Promise<void> {
    const draft = this.draft(field.id);
    await this.change(() =>
      this.fieldsService.update(field.id, {
        label: draft.label,
        helpText: draft.helpText.trim() || null,
        required: draft.required,
        // Only a selection field has choices, and the server refuses them for
        // any other type — so they are only sent where they mean something.
        ...(field.type === 'select'
          ? { options: lines(draft.optionsText) }
          : {}),
        ...(field.type === 'file'
          ? { accept: draft.accept, maxSizeBytes: toBytes(draft.maxSizeMb) }
          : {}),
      }),
    );
  }

  protected async remove(field: RegistrationField): Promise<void> {
    const question = this.i18n.translate('admin.fields.confirmRemove', {
      label: field.label,
    });
    if (!confirm(question)) {
      return;
    }
    await this.change(() => this.fieldsService.remove(field.id));
  }

  /**
   * Moves one question by one position.
   *
   * Sent as the complete new order, never as "move this one": two organizers
   * each moving a field would otherwise interleave into an order neither asked
   * for.
   */
  protected async move(index: number, offset: number): Promise<void> {
    const ids = this.fields().map((field) => field.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;

    [ids[index], ids[target]] = [ids[target], ids[index]];
    await this.change(async () => {
      this.apply(await this.fieldsService.reorder(this.eventId(), ids));
    });
  }

  private async loadEvent(eventId: string): Promise<void> {
    try {
      this.event.set(await this.events.get(eventId));
    } catch (error: unknown) {
      this.event.set(null);
      this.report(error, 'admin.events.errorMissing');
    }
  }

  private async loadFields(eventId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.apply(await this.fieldsService.list(eventId));
      this.error.set(null);
    } catch (error: unknown) {
      this.report(error, 'admin.fields.errorLoad');
    } finally {
      this.loading.set(false);
    }
  }

  /** Replaces the list and the drafts that belong to it in one step. */
  private apply(fields: readonly RegistrationField[]): void {
    this.fields.set(fields);
    this.drafts.set(
      Object.fromEntries(fields.map((field) => [field.id, draftOf(field)])),
    );
  }

  private async change(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      // Read back rather than patched in place: the server owns the order and
      // the keys, and both can differ from what was sent.
      this.apply(await this.fieldsService.list(this.eventId()));
    } catch (error: unknown) {
      this.report(error, 'admin.fields.errorSave');
    } finally {
      this.busy.set(false);
    }
  }

  private report(error: unknown, key: string): void {
    this.error.set(problemOf(error, key));
  }
}

function blankDraft(): FieldDraft {
  return {
    label: '',
    helpText: '',
    optionsText: '',
    accept: [],
    maxSizeMb: toMegabytes(DEFAULT_UPLOAD_MAX_BYTES),
    required: false,
  };
}

function draftOf(field: RegistrationField): FieldDraft {
  return {
    label: field.label,
    helpText: field.helpText ?? '',
    optionsText: choiceLines(field.options),
    accept: [...field.accept],
    maxSizeMb: toMegabytes(field.maxSizeBytes),
    required: field.required,
  };
}
