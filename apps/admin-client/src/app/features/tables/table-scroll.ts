import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/**
 * A table that scrolls sideways inside its own frame instead of pushing the
 * page (E67, AP 8 of phase 5).
 *
 * Ten pages of this client are a table, and at 768 pixels a table does not
 * overflow — it *crushes*. The measurement that opened AP 8 found the
 * participant overview's seven columns squeezed into 736 pixels, every address
 * broken across three lines and two headings touching. Nothing scrolled
 * sideways, and nothing was readable either.
 *
 * So the fix is two halves, and this component is one of them: the page gives
 * its table a minimum width it stays legible at, and this frame gives the
 * overflow somewhere to go. The page keeps its own width; the table moves
 * under the finger.
 *
 * The frame only calls itself a region **while it really scrolls**:
 *
 * - a scrollable box has to be reachable from a keyboard (WCAG 2.2 SC 2.1.1),
 *   which is what `tabindex="0"` is for, and it needs a name to be announced
 *   with, which is what `role="region"` plus a label is for;
 * - at 1280 pixels the same box scrolls nothing, and a tab stop in front of
 *   every table on the page would be ten stops that lead nowhere.
 *
 * Which of the two it is cannot be read off the viewport, because it depends
 * on the content as much as on the window — so it is measured, and measured
 * again whenever either changes.
 */
@Component({
  selector: 'trefaro-table-scroll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #frame
      class="frame"
      [attr.role]="scrolls() ? 'region' : null"
      [attr.tabindex]="scrolls() ? 0 : null"
      [attr.aria-label]="scrolls() ? label() : null"
    >
      <ng-content />
    </div>
  `,
  styles: `
    .frame {
      overflow-x: auto;
      /* Room for the focus ring of the frame itself, which would otherwise be
         drawn on the edge of the scrolling box and half hidden by it. */
      outline-offset: -2px;
    }
  `,
})
export class TableScroll {
  /**
   * What the region is called when it is announced.
   *
   * The heading the table sits under, handed in by the page: a second
   * catalogue key per table would be the same words twice, and the first one
   * to be forgotten.
   */
  readonly label = input.required<string>();

  protected readonly scrolls = signal(false);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.watch());
  }

  /**
   * Measures now, and again whenever the frame or its table changes size.
   *
   * Both boxes, because they answer different halves of the question: the
   * frame's width follows the window, the table's follows its content — a
   * filter that removes the longest name makes the second one narrower without
   * touching the first.
   *
   * No observer means no measurement and therefore no tab stop, which is the
   * safe direction: jsdom has none, and the only thing a unit test could
   * assert there is the mock it installed itself. The browser suite asserts
   * the real thing at 768 pixels.
   */
  private watch(): void {
    const frame = this.frame().nativeElement;
    this.measure(frame);

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => this.measure(frame));
    observer.observe(frame);
    const table = frame.firstElementChild;
    if (table) observer.observe(table);

    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private measure(frame: HTMLElement): void {
    // A pixel of tolerance: a fractional layout can leave `scrollWidth` a
    // rounding error above `clientWidth` on a table that fits exactly.
    this.scrolls.set(frame.scrollWidth > frame.clientWidth + 1);
  }
}
