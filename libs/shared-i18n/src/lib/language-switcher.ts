import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
        <span class="language-switcher__label">
          {{ 'language.switcher.label' | transloco }}
        </span>
        <select
          class="language-switcher__select"
          [disabled]="i18n.switching()"
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
      font: inherit;
      color: inherit;
      background: transparent;
      border: 1px solid currentcolor;
      border-radius: 0.25rem;
      padding: 0.15rem 0.3rem;
    }

    .language-switcher__select:disabled {
      opacity: 0.6;
    }
  `,
})
export class LanguageSwitcher {
  protected readonly i18n = inject(TranslationService);

  protected async choose(event: Event): Promise<void> {
    const locale = (event.target as HTMLSelectElement).value;
    // The service loads the catalogue before it activates, so the interface
    // never sits in the old language with the new one selected.
    await this.i18n.use(locale);
  }
}
