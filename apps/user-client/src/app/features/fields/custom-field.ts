import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  type AnswerableField,
} from '@trefaro/shared-models';
import type { AnswerControl } from './field-answers';

/**
 * One configured question and the input that answers it (E35).
 *
 * The component both field kits are drawn by: the registration form of an event
 * (F12) and the profile form of this instance (FR 4.3) ask different questions
 * for different reasons, but a question is written down the same way in both —
 * label, the asterisk if it is required, the right input for its type, and the
 * explanation underneath, tied to the input so a screen reader reads it as part
 * of the question rather than as loose text.
 *
 * Three decisions worth naming:
 *
 * 1. **The control is handed in, not looked up.** `[formControl]` with a control
 *    the caller owns, rather than `formControlName` resolved out of the
 *    surrounding form: this component then works wherever it is placed and can
 *    be tested with one control and no form around it. Both callers keep their
 *    answers in an `AnswerRecord` and pass the member for this field.
 * 2. **A file field cannot be drawn here.** Its answer is bytes, not a value
 *    (F37), and its input has no control the form can own — so the registration
 *    form draws that one branch itself. Shared is what both kits do the same,
 *    not what looks similar (F138).
 * 3. **The styles live here.** View encapsulation means the page's own rules do
 *    not reach into this template, and a question that looked different from the
 *    five fixed fields beside it would be the visible seam of an internal
 *    decision.
 */
@Component({
  selector: 'trefaro-custom-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    @switch (field().type) {
      @case ('checkbox') {
        <label class="check">
          <input
            type="checkbox"
            [formControl]="control()"
            [attr.aria-describedby]="describedBy()"
          />
          <span>{{ label() }}</span>
        </label>
      }
      @case ('select') {
        <label>
          <span>{{ label() }}</span>
          <select
            [formControl]="control()"
            [attr.aria-describedby]="describedBy()"
          >
            <!-- An empty first option, so nothing is answered by accident for
                 somebody who scrolled past. -->
            <option value="">{{ 'fields.choose' | transloco }}</option>
            @for (option of field().options; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>
      }
      @default {
        <label>
          <span>{{ label() }}</span>
          <input
            [formControl]="control()"
            [attr.maxlength]="maxTextLength"
            [attr.aria-describedby]="describedBy()"
          />
        </label>
      }
    }
    @if (field().helpText; as help) {
      <small class="hint" [id]="hintId()">{{ help }}</small>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
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
    select {
      padding: 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    .check {
      flex-direction: row;
      align-items: start;
      gap: 0.6rem;
    }

    .check > span {
      font-weight: 400;
    }

    .check input {
      inline-size: 1.1rem;
      block-size: 1.1rem;
      margin-block-start: 0.15rem;
    }

    .hint {
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }
  `,
})
export class CustomField {
  readonly field = input.required<AnswerableField>();
  readonly control = input.required<AnswerControl>();

  protected readonly maxTextLength = MAX_CUSTOM_TEXT_LENGTH;

  /**
   * The label as it is read, with the asterisk a required question carries.
   *
   * Built in TypeScript, so it reads `field()` — which is a signal — rather
   * than the catalogue: the label is the organizer's own words in the
   * organizer's own language and is never translated. The asterisk is the
   * convention the five fixed fields of the registration form already use.
   */
  protected readonly label = computed(() =>
    this.field().required ? `${this.field().label} *` : this.field().label,
  );

  protected readonly hintId = computed(() => `hint-${this.field().key}`);

  protected readonly describedBy = computed(() =>
    this.field().helpText ? this.hintId() : null,
  );
}
