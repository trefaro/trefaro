import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type { ProfileField, ProfileFieldType } from '@trefaro/shared-models';
import {
  MAX_FIELD_HELP_LENGTH,
  MAX_FIELD_LABEL_LENGTH,
  MAX_PROFILE_FIELDS,
  PROFILE_FIELD_TYPES,
} from '@trefaro/shared-models';
import {
  choiceLines,
  inputChecked,
  inputValue,
  lines,
} from '../../features/fields/field-editing';
import { fieldTypeKey } from '../../features/i18n/labels';
import { ProfileFieldsAdminService } from '../../features/profiles/profile-fields-admin.service';

/** What a row's inputs hold until they are saved. */
interface FieldDraft {
  label: string;
  helpText: string;
  /** One choice per line — see the note in the template. */
  optionsText: string;
  required: boolean;
}

/**
 * What this organization asks the people in its community (E35, FR 4.3).
 *
 * The profile's own fields — name, picture, language, field of activity — are
 * not managed here; everything beyond them is. Which is the whole point: a
 * network of local groups needs to know which group somebody belongs to, an
 * interpreters' pool needs their languages, and a fixed profile form would be
 * too long for one organization and too short for the next.
 *
 * The neighbour of this page is the registration form's editor, and the two are
 * deliberately still two pages (F138). What they share is what they must not do
 * differently — the "one choice per line" rule and the word for a kind of
 * answer. What they do not share is the shape of the thing they edit: these
 * questions have no event above them (F122) and no file type below them (F37),
 * and a component parameterized over both differences would be longer than
 * either page.
 *
 * Three interface decisions, all inherited from that neighbour on purpose —
 * an organizer should not have to learn two field editors:
 *
 * 1. **The choices of a selection field are one text box, one choice per line.**
 * 2. **A field's key is shown but not editable** (F35). It is what the answers
 *    are stored under, and separating it from the label is what lets a question
 *    be rephrased without orphaning the answers.
 * 3. **Deleting a question keeps the answers** (F34). The confirmation says so,
 *    because "delete" usually does not mean that.
 */
@Component({
  selector: 'trefaro-profile-fields-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <header class="head">
      <div>
        <h1>{{ 'admin.profileFields.title' | transloco }}</h1>
        <p class="meta">
          <span>{{ 'admin.profileFields.intro' | transloco }}</span>
        </p>
      </div>
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
        {{ 'admin.profileFields.yourQuestions' | transloco }}
      </h2>

      @if (fields().length === 0) {
        <p class="meta">
          {{
            (loading() ? 'common.loading' : 'admin.profileFields.empty')
              | transloco
          }}
        </p>
      }

      <ol class="fields">
        @for (field of fields(); track field.id; let index = $index) {
          <li class="field">
            <div class="field__head">
              <span class="badge">{{ typeKey(field.type) | transloco }}</span>
              <span class="meta">
                {{
                  'admin.profileFields.storedAs' | transloco: { key: field.key }
                }}
              </span>
              <div class="field__order">
                <button
                  type="button"
                  [attr.aria-label]="
                    'admin.profileFields.moveUp'
                      | transloco: { label: field.label }
                  "
                  [disabled]="index === 0 || busy()"
                  (click)="move(index, -1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  [attr.aria-label]="
                    'admin.profileFields.moveDown'
                      | transloco: { label: field.label }
                  "
                  [disabled]="index === fields().length - 1 || busy()"
                  (click)="move(index, 1)"
                >
                  ↓
                </button>
              </div>
            </div>

            <label>
              <span>{{ 'admin.profileFields.question' | transloco }}</span>
              <input
                [attr.maxlength]="maxLabelLength"
                [value]="draft(field.id).label"
                (input)="edit(field.id, { label: value($event) })"
              />
            </label>

            <label>
              <span>{{ 'admin.profileFields.explanation' | transloco }}</span>
              <input
                [attr.maxlength]="maxHelpLength"
                [placeholder]="
                  'admin.profileFields.explanationPlaceholder' | transloco
                "
                [value]="draft(field.id).helpText"
                (input)="edit(field.id, { helpText: value($event) })"
              />
            </label>

            @if (field.type === 'select') {
              <label>
                <span>{{ 'admin.profileFields.choices' | transloco }}</span>
                <textarea
                  rows="4"
                  [value]="draft(field.id).optionsText"
                  (input)="edit(field.id, { optionsText: value($event) })"
                ></textarea>
              </label>
              <small class="meta">
                {{ 'admin.profileFields.choicesHint' | transloco }}
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
                    ? 'admin.profileFields.requiredTicked'
                    : 'admin.profileFields.required'
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
      @if (fields().length > 0) {
        <p class="meta">
          {{ 'admin.profileFields.deletionKeepsAnswers' | transloco }}
        </p>
      }
    </section>

    <section aria-labelledby="add-heading">
      <h2 id="add-heading">
        {{ 'admin.profileFields.addHeading' | transloco }}
      </h2>
      @if (full()) {
        <p class="meta">
          {{ 'admin.profileFields.full' | transloco: { count: maxFields } }}
        </p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="add()" novalidate>
          <label>
            <span>{{ 'admin.profileFields.question' | transloco }}</span>
            <input
              formControlName="label"
              [attr.maxlength]="maxLabelLength"
              [placeholder]="
                'admin.profileFields.questionPlaceholder' | transloco
              "
            />
          </label>

          <label>
            <span>{{ 'admin.profileFields.answerKind' | transloco }}</span>
            <select formControlName="type">
              @for (type of fieldTypes; track type) {
                <option [value]="type">{{ typeKey(type) | transloco }}</option>
              }
            </select>
          </label>

          @if (newType() === 'select') {
            <label>
              <span>{{ 'admin.profileFields.choices' | transloco }}</span>
              <textarea
                formControlName="optionsText"
                rows="4"
                [placeholder]="
                  'admin.profileFields.choicesPlaceholder' | transloco
                "
              ></textarea>
            </label>
            <small class="meta">
              {{ 'admin.profileFields.choicesHint' | transloco }}
            </small>
          }

          <label>
            <span>{{ 'admin.profileFields.explanation' | transloco }}</span>
            <input
              formControlName="helpText"
              [attr.maxlength]="maxHelpLength"
              [placeholder]="
                'admin.profileFields.explanationPlaceholder' | transloco
              "
            />
          </label>

          <label class="check">
            <input formControlName="required" type="checkbox" />
            <span>{{ 'admin.profileFields.required' | transloco }}</span>
          </label>

          <button type="submit" [disabled]="busy()">
            {{ 'admin.profileFields.add' | transloco }}
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
      margin: 0 0 0.8rem;
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
export class ProfileFieldsPage {
  protected readonly maxLabelLength = MAX_FIELD_LABEL_LENGTH;
  protected readonly maxHelpLength = MAX_FIELD_HELP_LENGTH;
  protected readonly maxFields = MAX_PROFILE_FIELDS;
  /** The three kinds of answer, in the order the box offers them. */
  protected readonly fieldTypes = PROFILE_FIELD_TYPES;
  protected readonly typeKey = fieldTypeKey;
  protected readonly value = inputValue;
  protected readonly checked = inputChecked;

  private readonly fieldsService = inject(ProfileFieldsAdminService);
  private readonly i18n = inject(TranslationService);

  protected readonly fields = signal<readonly ProfileField[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  /** What the row inputs hold, keyed by field id, until Save is pressed. */
  private readonly drafts = signal<Record<string, FieldDraft>>({});

  protected readonly full = computed(
    () => this.fields().length >= MAX_PROFILE_FIELDS,
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    label: ['', Validators.required],
    type: ['text' as ProfileFieldType],
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
  protected readonly newType = signal<ProfileFieldType>('text');

  constructor() {
    this.form.controls.type.valueChanges.subscribe((type) =>
      this.newType.set(type),
    );

    effect(() => {
      void this.load();
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
  protected changed(field: ProfileField): boolean {
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
      await this.fieldsService.create({
        label: raw.label,
        type: raw.type,
        helpText: raw.helpText.trim() || null,
        // Only where they mean something: the server refuses choices on a
        // field that is not a selection field, and it is right to.
        options: raw.type === 'select' ? lines(raw.optionsText) : [],
        required: raw.required,
      });
      this.form.reset({ type: raw.type });
    });
  }

  protected async save(field: ProfileField): Promise<void> {
    const draft = this.draft(field.id);
    await this.change(() =>
      this.fieldsService.update(field.id, {
        label: draft.label,
        helpText: draft.helpText.trim() || null,
        required: draft.required,
        ...(field.type === 'select'
          ? { options: lines(draft.optionsText) }
          : {}),
      }),
    );
  }

  protected async remove(field: ProfileField): Promise<void> {
    // The confirmation says that the answers stay (F34): "delete" normally
    // means the data goes with the question, and here it does not.
    const question = this.i18n.translate('admin.profileFields.confirmRemove', {
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
      this.apply(await this.fieldsService.reorder(ids));
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.apply(await this.fieldsService.list());
      this.error.set(null);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.profileFields.errorLoad'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Replaces the list and the drafts that belong to it in one step. */
  private apply(fields: readonly ProfileField[]): void {
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
      this.apply(await this.fieldsService.list());
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.profileFields.errorSave'));
    } finally {
      this.busy.set(false);
    }
  }
}

function blankDraft(): FieldDraft {
  return { label: '', helpText: '', optionsText: '', required: false };
}

function draftOf(field: ProfileField): FieldDraft {
  return {
    label: field.label,
    helpText: field.helpText ?? '',
    optionsText: choiceLines(field.options),
    required: field.required,
  };
}
