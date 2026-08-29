import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { TranslatedText } from '@trefaro/shared-models';

/** One translatable field: what it is called, and what it says in the original. */
export interface TranslationFieldSpec {
  readonly key: string;
  /** Catalogue key of the label — the same word the main form uses (F80). */
  readonly labelKey: string;
  readonly source: TranslatedText;
  readonly maxLength: number;
  /** A description is a paragraph; a name is a line. */
  readonly multiline?: boolean;
}

/** What one save carries: every field of one thing, in one language. */
export type TranslationDraft = Readonly<Record<string, TranslatedText>>;

/**
 * One thing, in one language, beside what it says in the original.
 *
 * A component rather than three copies of the markup: the series has two fields,
 * the event four and every session two, and the arrangement — original above,
 * translation below, empty means "use the original" — is the same decision each
 * time. Three copies would be three places to change it and two to forget.
 *
 * The original stands *next to* the box rather than inside it as a placeholder.
 * A placeholder disappears the moment somebody types, which is exactly when a
 * translator wants to compare; and an empty box has to keep meaning "no
 * translation" (E25), which text greyed into it would make ambiguous.
 */
@Component({
  selector: 'trefaro-translation-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <div class="fields">
      @for (field of fields(); track field.key) {
        <div class="field">
          <label [attr.for]="controlId(field.key)">
            {{ field.labelKey | transloco }}
          </label>
          @if (field.source) {
            <p class="source">
              <span class="source__label">
                {{ 'admin.translations.original' | transloco }}
              </span>
              {{ field.source }}
            </p>
          }
          @if (field.multiline) {
            <textarea
              [id]="controlId(field.key)"
              rows="4"
              [attr.maxlength]="field.maxLength"
              [value]="value(field.key)"
              [disabled]="busy()"
              (input)="edit(field.key, $event)"
            ></textarea>
          } @else {
            <input
              type="text"
              [id]="controlId(field.key)"
              [attr.maxlength]="field.maxLength"
              [value]="value(field.key)"
              [disabled]="busy()"
              (input)="edit(field.key, $event)"
            />
          }
        </div>
      }
    </div>

    <div class="actions">
      <button type="button" [disabled]="busy()" (click)="submit()">
        {{ 'admin.translations.save' | transloco }}
      </button>
      @if (stored()) {
        <button
          type="button"
          class="ghost"
          [disabled]="busy()"
          (click)="removed.emit()"
        >
          {{ 'admin.translations.remove' | transloco }}
        </button>
      }
    </div>
  `,
  styles: `
    .fields {
      display: grid;
      gap: 1rem;
      margin-block-end: 0.75rem;
    }

    .field {
      display: grid;
      gap: 0.3rem;
    }

    label {
      font-weight: 600;
    }

    .source {
      margin: 0;
      padding: 0.35rem 0.6rem;
      border-inline-start: 3px solid var(--trefaro-color-primary-soft, #ddd);
      background: var(--trefaro-color-surface-muted, #f6f6f6);
      color: var(--trefaro-color-text-muted, #555);
      white-space: pre-wrap;
    }

    .source__label {
      display: block;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    input,
    textarea {
      inline-size: 100%;
      font: inherit;
      padding: 0.4rem 0.5rem;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
  `,
})
export class TranslationFieldsComponent {
  readonly fields = input.required<readonly TranslationFieldSpec[]>();

  /** What is stored for this thing in this language, or `null` for nothing yet. */
  readonly translation = input<TranslationDraft | null>(null);

  /**
   * What this form *is*: one thing, in one language.
   *
   * It gives the boxes of two sections on one page distinct ids, and it is the
   * signal the draft is reset on — which is why the language belongs in it. Two
   * tabs neither of which has a translation yet both pass `null` below, so
   * without the language in here, switching between them would carry unsaved
   * typing from one language into another.
   */
  readonly section = input.required<string>();

  readonly busy = input(false);

  readonly saved = output<TranslationDraft>();
  readonly removed = output<void>();

  protected readonly draft = signal<Record<string, string>>({});

  constructor() {
    // Re-filled when this form becomes a different form — another tab, another
    // session — or when what is stored for it changes, which is what makes one
    // component serve every tab.
    //
    // `fields` is read **untracked**, and that is the whole of a defect the
    // browser found: a caller that builds the list in a template method hands
    // over a new array on every change detection run, so a tracked read would
    // re-run this effect while somebody is typing and reset the box they are
    // typing into. The list decides which keys the draft has; it is not a reason
    // to throw the draft away.
    effect(() => {
      this.section();
      const stored = this.translation() ?? {};
      const next: Record<string, string> = {};
      for (const field of untracked(() => this.fields())) {
        next[field.key] = stored[field.key] ?? '';
      }
      this.draft.set(next);
    });
  }

  protected stored(): boolean {
    return this.translation() !== null;
  }

  protected controlId(key: string): string {
    return `${this.section()}-${key}`;
  }

  /** What the box holds — a method, so it redraws when the draft changes. */
  protected value(key: string): string {
    return this.draft()[key] ?? '';
  }

  protected edit(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement)
      .value;
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  protected submit(): void {
    // Emitted as it was typed; the server trims and reads a blank field as "no
    // translation" (E25), so this side does not need a second opinion about it.
    this.saved.emit({ ...this.draft() });
  }
}
