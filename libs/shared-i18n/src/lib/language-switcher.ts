import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationService } from './translation.service';

/**
 * The switch between the languages an organization offers (chapter 4, NFR 4).
 *
 * One component for both shells: the participant client puts it in its header,
 * the organizer client in its sidebar, and neither should own a second opinion
 * about how a language is chosen.
 *
 * A `<select>` rather than a row of buttons or a flag menu. Two languages is the
 * common case and three is possible from AP 7, so a list that grows without
 * being redesigned is worth more than a compact pair; a flag is a country and
 * not a language; and a native `<select>` is what a screen reader and a
 * touch keyboard already know how to operate.
 *
 * It renders nothing while there is only one language. A control whose only
 * option is the current state is a control that invites a click and does
 * nothing — and every instance has at least English, so "only one" is the
 * default state of a fresh installation.
 *
 * No CSS of its own beyond layout: it inherits the `--trefaro-*` custom
 * properties like everything else, which is the same rule the plug-in web
 * components follow.
 */
@Component({
  selector: 'trefaro-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    @if (i18n.availableLocales().length > 1) {
      <label class="language-switcher">
        @if (!compact()) {
          <span class="language-switcher__label">
            {{ 'language.switcher.label' | transloco }}
          </span>
        }
        <select
          class="language-switcher__select"
          [disabled]="i18n.switching()"
          [attr.aria-label]="
            compact() ? ('language.switcher.label' | transloco) : null
          "
          (change)="choose($event)"
        >
          @for (locale of i18n.availableLocales(); track locale) {
            <!--
              selected on the option rather than value on the select: Angular
              writes the property before the loop has produced the options, and
              the assignment is then dropped without a word.
            -->
            <option [value]="locale" [selected]="locale === i18n.locale()">
              {{ i18n.languageName(locale) }}
            </option>
          }
        </select>
      </label>
    }
  `,
  styles: `
    .language-switcher {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
    }

    .language-switcher__select {
      /* A thumb-sized target, because the participant client is designed at
         390 pixels (E67) — and the organizer's sidebar loses nothing by it. */
      min-block-size: 2.75rem;
      font: inherit;
      color: inherit;
      background: transparent;
      border: 1px solid currentcolor;
      border-radius: 0.25rem;
      padding: 0.15rem 0.4rem;
    }

    .language-switcher__select:disabled {
      opacity: 0.6;
    }
  `,
})
export class LanguageSwitcher {
  /**
   * Whether to drop the written label and keep only the control (AP 7 of
   * phase 5).
   *
   * One component in two places, and the difference is an input — the same
   * shape as the newsletter form's two placements (F182). The participant
   * client's header is 390 pixels wide and has a hamburger, a logo and the
   * organization's name in it before this control gets its turn; the
   * organizer's sidebar has room for the word. What never goes is the
   * accessible name: compact moves it to `aria-label`.
   */
  readonly compact = input(false);

  protected readonly i18n = inject(TranslationService);

  protected async choose(event: Event): Promise<void> {
    const locale = (event.target as HTMLSelectElement).value;
    // The service loads the catalogue before it activates, so the interface
    // never sits in the old language with the new one selected.
    await this.i18n.use(locale);
  }
}
