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
import type { ApiError } from '@trefaro/shared-http';
import type {
  OrganizerEvent,
  RegistrationField,
  RegistrationFieldType,
} from '@trefaro/shared-models';
import {
  MAX_FIELD_HELP_LENGTH,
  MAX_FIELD_LABEL_LENGTH,
  MAX_REGISTRATION_FIELDS,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { RegistrationFieldsAdminService } from '../../features/registrations/registration-fields-admin.service';

/** What the row's inputs hold until they are saved. */
interface FieldDraft {
  label: string;
  helpText: string;
  /** One choice per line — see the note in the template. */
  optionsText: string;
  required: boolean;
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
 */
@Component({
  selector: 'trefaro-registration-fields-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <header class="head">
      <div>
        <h1>Registration form</h1>
        <p class="meta">
          @if (event(); as item) {
            <a [routerLink]="['/series', seriesId(), 'events', item.id]">
              {{ item.name }}
            </a>
          }
          <span>
            Name, e-mail, phone and where somebody is coming from are always
            asked. Everything below is yours.
          </span>
        </p>
      </div>
      <a
        class="back"
        [routerLink]="['/series', seriesId(), 'events', eventId()]"
      >
        Back to the event
      </a>
    </header>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <section aria-labelledby="fields-heading">
      <h2 id="fields-heading">Your questions</h2>

      @if (fields().length === 0) {
        <p class="meta">
          {{
            loading()
              ? 'Loading…'
              : 'No extra questions yet. The form asks the five standard fields.'
          }}
        </p>
      }

      <ol class="fields">
        @for (field of fields(); track field.id; let index = $index) {
          <li class="field">
            <div class="field__head">
              <span class="badge">{{ field.type }}</span>
              <span class="meta">
                answers stored as <code>{{ field.key }}</code>
              </span>
              <div class="field__order">
                <button
                  type="button"
                  [attr.aria-label]="'Move ' + field.label + ' up'"
                  [disabled]="index === 0 || busy()"
                  (click)="move(index, -1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  [attr.aria-label]="'Move ' + field.label + ' down'"
                  [disabled]="index === fields().length - 1 || busy()"
                  (click)="move(index, 1)"
                >
                  ↓
                </button>
              </div>
            </div>

            <label>
              <span>Question</span>
              <input
                [attr.maxlength]="maxLabelLength"
                [value]="draft(field.id).label"
                (input)="edit(field.id, { label: value($event) })"
              />
            </label>

            <label>
              <span>Explanation</span>
              <input
                [attr.maxlength]="maxHelpLength"
                placeholder="Optional — say why it is asked"
                [value]="draft(field.id).helpText"
                (input)="edit(field.id, { helpText: value($event) })"
              />
            </label>

            @if (field.type === 'select') {
              <label>
                <span>Choices</span>
                <textarea
                  rows="4"
                  [value]="draft(field.id).optionsText"
                  (input)="edit(field.id, { optionsText: value($event) })"
                ></textarea>
              </label>
              <small class="meta">One choice per line.</small>
            }

            <label class="check">
              <input
                type="checkbox"
                [checked]="draft(field.id).required"
                (change)="edit(field.id, { required: checked($event) })"
              />
              <span>
                {{
                  field.type === 'checkbox'
                    ? 'Has to be ticked to register'
                    : 'Has to be answered to register'
                }}
              </span>
            </label>

            <div class="field__actions">
              <button
                type="button"
                [disabled]="busy() || !changed(field)"
                (click)="save(field)"
              >
                Save
              </button>
              <button
                type="button"
                class="danger"
                [disabled]="busy()"
                (click)="remove(field)"
              >
                Delete
              </button>
            </div>
          </li>
        }
      </ol>
    </section>

    <section aria-labelledby="add-heading">
      <h2 id="add-heading">Add a question</h2>
      @if (full()) {
        <p class="meta">
          A form holds at most {{ maxFields }} extra questions. Delete one to
          add another.
        </p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="add()" novalidate>
          <label>
            <span>Question</span>
            <input
              formControlName="label"
              [attr.maxlength]="maxLabelLength"
              placeholder="Dietary requirements"
            />
          </label>

          <label>
            <span>Kind of answer</span>
            <select formControlName="type">
              <option value="text">Text</option>
              <option value="select">One of several choices</option>
              <option value="checkbox">Yes or no</option>
            </select>
          </label>

          @if (newType() === 'select') {
            <label>
              <span>Choices</span>
              <textarea
                formControlName="optionsText"
                rows="4"
                placeholder="Vegan&#10;Vegetarian&#10;No preference"
              ></textarea>
            </label>
            <small class="meta">One choice per line.</small>
          }

          <label>
            <span>Explanation</span>
            <input
              formControlName="helpText"
              [attr.maxlength]="maxHelpLength"
              placeholder="Optional — say why it is asked"
            />
          </label>

          <label class="check">
            <input formControlName="required" type="checkbox" />
            <span>Has to be answered to register</span>
          </label>

          <button type="submit" [disabled]="busy()">Add question</button>
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

  private readonly fieldsService = inject(RegistrationFieldsAdminService);
  private readonly events = inject(EventsAdminService);

  protected readonly event = signal<OrganizerEvent | null>(null);
  protected readonly fields = signal<readonly RegistrationField[]>([]);
  protected readonly error = signal<string | null>(null);
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
    helpText: [''],
    required: [false],
  });

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

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
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
        required: raw.required,
      });
      this.form.reset({ type: raw.type });
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
      }),
    );
  }

  protected async remove(field: RegistrationField): Promise<void> {
    if (
      !confirm(
        `Remove "${field.label}" from the form? Answers people have already ` +
          'given are kept — the participant overview shows them as no longer ' +
          'asked for.',
      )
    ) {
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
      this.report(error, 'This event no longer exists.');
    }
  }

  private async loadFields(eventId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.apply(await this.fieldsService.list(eventId));
      this.error.set(null);
    } catch (error: unknown) {
      this.report(error, 'The registration form could not be loaded.');
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
      this.report(error, 'The change could not be saved.');
    } finally {
      this.busy.set(false);
    }
  }

  private report(error: unknown, fallback: string): void {
    this.error.set((error as ApiError)?.message ?? fallback);
  }
}

function blankDraft(): FieldDraft {
  return { label: '', helpText: '', optionsText: '', required: false };
}

function draftOf(field: RegistrationField): FieldDraft {
  return {
    label: field.label,
    helpText: field.helpText ?? '',
    optionsText: field.options.join('\n'),
    required: field.required,
  };
}

/** A text box of choices, one per line, blank lines dropped. */
function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
