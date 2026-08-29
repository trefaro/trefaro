import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslationService } from '@trefaro/shared-i18n';

/**
 * The target languages of a translation screen, as tabs.
 *
 * Which languages appear is a decision rather than a list. Three parts:
 *
 * 1. **What the instance offers** (`active_locales`) — E25 says the target
 *    languages are the languages an organization has decided to show visitors.
 * 2. **Minus the default one.** The main form *is* the default language; a tab
 *    for it would be a second place to write the same sentence, and the two
 *    could disagree.
 * 3. **Plus anything already translated.** A language that has been taken off
 *    the offer keeps its translations (E30), and a tab that vanished would leave
 *    them unreachable — the same rule the language administration follows for
 *    the language currently being worked on.
 */
@Component({
  selector: 'trefaro-translation-languages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()">
      @for (language of languages(); track language.tag) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="language.tag === active()"
          [class.tabs__tab--active]="language.tag === active()"
          class="tabs__tab"
          (click)="chosen.emit(language.tag)"
        >
          {{ language.name }}
        </button>
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-block-end: 1rem;
      border-block-end: 1px solid var(--trefaro-color-primary-soft, #ddd);
      padding-block-end: 0.35rem;
    }

    .tabs__tab {
      font: inherit;
      padding: 0.35rem 0.8rem;
      border: 1px solid transparent;
      border-radius: 0.4rem 0.4rem 0 0;
      background: none;
      cursor: pointer;
    }

    .tabs__tab--active {
      background: var(--trefaro-color-primary-soft, #eee);
      border-color: var(--trefaro-color-primary-soft, #ddd);
      font-weight: 600;
    }
  `,
})
export class TranslationLanguagesComponent {
  readonly locales = input.required<readonly string[]>();
  readonly active = input.required<string>();
  readonly label = input.required<string>();
  readonly chosen = output<string>();

  private readonly i18n = inject(TranslationService);

  /**
   * Tag and name, recomputed when the organizer switches their own language.
   *
   * A memoised `computed()` only redraws if it depends on the active language
   * (F72), and this one does: `languageName` reads that signal itself in order
   * to say "Deutsch" to a German reader and "German" to an English one. Worth
   * knowing before somebody replaces it with a constant map and wonders why the
   * tabs stop following the switcher.
   */
  protected readonly languages = computed(() =>
    this.locales().map((tag) => ({
      tag,
      name: this.i18n.languageName(tag),
    })),
  );
}
