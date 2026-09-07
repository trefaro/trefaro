import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ICON_VIEW_BOX, iconPath } from './icon-paths';

/**
 * One icon from the closed catalogue (E49).
 *
 * The single place a glyph is drawn, in both clients: tiles, navigation entries
 * and the module administration all name an icon and get this. Inline SVG
 * rather than an icon font or a sprite file — the reasons are with
 * {@link ICON_NAMES}, and the consequence is here: the path inherits
 * `currentColor`, so an icon is the colour of the text beside it and the
 * whitelabel needs no rule of its own for it.
 *
 * It lives in this library because this is where the brand already lives — the
 * colours, the fonts, the `--trefaro-*` properties. It is **not** an answer to
 * the open question of a shared component library (F145): that question is
 * about forms, tables and buttons, and it stays open until enough callers have
 * asked for the same one twice.
 *
 * **A name nobody knows renders nothing.** No box, no question mark, no error:
 * a descriptor may name a glyph a later version withdrew, and a tile that
 * vanished or a page that threw would be a worse answer than a missing
 * decoration. The organizer learns about it in the module administration.
 *
 * Decorative by default (`aria-hidden`), because every place that shows an icon
 * shows the label beside it — an icon read out twice is noise (NFR 4). Size
 * comes from `--trefaro-icon-size` and defaults to the surrounding text.
 */
@Component({
  selector: 'trefaro-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (path(); as data) {
      <svg
        [attr.viewBox]="viewBox"
        focusable="false"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path [attr.d]="data" />
      </svg>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: var(--trefaro-icon-size, 1.25em);
      block-size: var(--trefaro-icon-size, 1.25em);
      flex: none;
    }

    svg {
      inline-size: 100%;
      block-size: 100%;
      /* The whole point of path data over an image: the glyph is text-coloured
         wherever it is put, so the theme reaches it without a rule. */
      fill: currentColor;
    }
  `,
})
export class TrefaroIcon {
  /**
   * Which icon to draw — a name from `ICON_NAMES`.
   *
   * Typed as a plain string rather than `IconName`, because the callers that
   * matter hold a value from outside the compiler's reach: a plug-in
   * descriptor's `icon` arrives over HTTP.
   */
  readonly name = input<string | null>(null);

  protected readonly viewBox = ICON_VIEW_BOX;
  protected readonly path = computed(() => iconPath(this.name()));
}
