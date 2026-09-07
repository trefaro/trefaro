import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { TranslationService } from '@trefaro/shared-i18n';
import { pluginElementId, type IconName } from '@trefaro/shared-models';
import { PluginLoaderService } from '@trefaro/shared-plugins';
import { TrefaroIcon } from '@trefaro/shared-theming';

/** One tile: what it is called, where it leads, and how much is behind it. */
interface DetailTile {
  readonly target: string;
  readonly label: string;
  readonly hint: string;
  /**
   * The glyph beside the label (E49).
   *
   * A plain string, because a plug-in's comes from its descriptor over HTTP; the
   * two core tiles name theirs with `satisfies IconName`, so a typo in *our*
   * literal is a compile error while a plug-in's stays a runtime answer.
   */
  readonly icon: string | null;
}

/**
 * What this event offers, as tiles (FR 1.5, mockups chapter 5.2) — AP 4.
 *
 * The mockups put "Programmplan" on a tile beside the room plan, the forum and
 * the proposals, and show tiles only for modules the organization has enabled.
 * Four decisions turn that drawing into this component:
 *
 * 1. **A tile is a jump link, not a route.** Everything it can lead to renders on
 *    the landing page itself — the programme as a timeline (AP 8 of phase 1), the
 *    media links as a section, a plug-in as a web component at the event detail
 *    hook point. A tile that navigated somewhere would need a second rendering of
 *    the same thing, so instead each tile points at the section that is already
 *    there.
 *
 *    Through the router with an empty command array rather than as
 *    `href="#program"`: both clients carry a `<base href>`, and a fragment-only
 *    address resolves against *that* rather than against the current document —
 *    so a bare fragment link left the event and landed on the start page with a
 *    fragment attached. `[routerLink]="[]"` keeps the route and changes only the
 *    fragment, and `withInMemoryScrolling({ anchorScrolling: 'enabled' })` in the
 *    client's router config is what then scrolls.
 * 2. **A tile exists only when there is something behind it.** Not "per enabled
 *    module": a module can be on and have nothing to show — media links are
 *    enabled by default and most events have none — and a tile leading to an
 *    empty section is a dead end drawn as a feature. Same rule as the organizer's
 *    dashboard (F47). A plug-in whose bundle failed to load gets no tile either:
 *    the participant cannot act on that, and the organizer's module page is where
 *    it is reported.
 * 3. **Every tile is labelled from the catalogue.** A plug-in carries a
 *    `labelKey` and the two core tiles have keys of their own, resolved against
 *    the catalogue the server serves (E22), so a German page does not grow an
 *    English tile. The computed reads the active language, which is what makes
 *    it recompute when a visitor switches — a label assembled in TypeScript has
 *    no pipe to do that for it (F72). Both core tiles deliberately share their
 *    key with the heading of the section they point at: a tile that said
 *    something else would look like a second place to go.
 * 4. **Every tile carries an icon**, and a plug-in's is the one its descriptor
 *    names (E49, AP 1 of phase 4). The two core tiles have one of their own, so
 *    the row does not read as half-finished; a plug-in that names a glyph this
 *    version does not draw gets the tile without it, which is the whole
 *    behaviour of `trefaro-icon` and the reason the organizer's module page
 *    reports the name.
 */
@Component({
  selector: 'trefaro-event-detail-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, TrefaroIcon],
  template: `
    @if (tiles().length > 0) {
      <nav class="tiles" [attr.aria-label]="'event.tiles.label' | transloco">
        @for (tile of tiles(); track tile.target) {
          <a class="tile" [routerLink]="[]" [fragment]="tile.target">
            <span class="tile__label">
              <trefaro-icon [name]="tile.icon" />
              {{ tile.label }}
            </span>
            <span class="tile__hint">{{ tile.hint }}</span>
          </a>
        }
      </nav>
    }
  `,
  styles: `
    /* Mobile-first: one column, then as many as fit. */
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: 0.6rem;
      max-inline-size: 40rem;
      margin-block: 1.5rem;
    }

    .tile {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.7rem 0.9rem;
      border: 1px solid
        color-mix(in oklab, var(--trefaro-color-primary) 35%, transparent);
      border-radius: 0.5rem;
      background: var(--trefaro-color-primary-muted);
      color: inherit;
      text-decoration: none;
    }

    .tile__label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-weight: 600;
    }

    .tile__hint {
      font-size: 0.85rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }
  `,
})
export class EventDetailTiles {
  /** Sessions in the timeline; no tile without one. */
  readonly sessions = input.required<number>();
  /** Media links of the event as a whole — the ones the section renders. */
  readonly mediaLinks = input.required<number>();

  private readonly config = inject(AppConfigService);
  private readonly loader = inject(PluginLoaderService);
  private readonly i18n = inject(TranslationService);

  protected readonly tiles = computed<readonly DetailTile[]>(() => {
    const tiles: DetailTile[] = [];

    // The active language, read before the first label: this is a computed(),
    // so nothing else would make it run again after a switch (F72).
    this.i18n.locale();

    if (this.sessions() > 0) {
      tiles.push({
        target: 'program',
        icon: 'event' satisfies IconName,
        label: this.i18n.translate('event.program'),
        hint: this.i18n.translate(
          this.sessions() === 1
            ? 'event.tiles.sessions.one'
            : 'event.tiles.sessions.many',
          { count: this.sessions() },
        ),
      });
    }

    if (this.mediaLinks() > 0) {
      tiles.push({
        target: 'media',
        icon: 'link' satisfies IconName,
        label: this.i18n.translate('event.media'),
        hint: this.i18n.translate(
          this.mediaLinks() === 1
            ? 'event.tiles.links.one'
            : 'event.tiles.links.many',
          { count: this.mediaLinks() },
        ),
      });
    }

    // Read the load results so this recomputes as bundles finish — a tile that
    // appeared before its element was defined would scroll to nothing.
    this.loader.loadResults();
    for (const plugin of this.config.pluginsAt('event-detail')) {
      if (!this.loader.isReady(plugin.key)) continue;
      tiles.push({
        target: pluginElementId(plugin.key),
        icon: plugin.icon,
        label: this.i18n.translate(plugin.labelKey),
        hint: this.i18n.translate('event.tiles.onThisPage'),
      });
    }

    return tiles;
  });
}
