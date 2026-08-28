import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { moduleDisplayName, pluginElementId } from '@trefaro/shared-models';
import { PluginLoaderService } from '@trefaro/shared-plugins';

/** One tile: what it is called, where it leads, and how much is behind it. */
interface DetailTile {
  readonly target: string;
  readonly label: string;
  readonly hint: string;
}

/**
 * What this event offers, as tiles (FR 1.5, mockups chapter 5.2) — AP 4.
 *
 * The mockups put "Programmplan" on a tile beside the room plan, the forum and
 * the proposals, and show tiles only for modules the organization has enabled.
 * Three decisions turn that drawing into this component:
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
 * 3. **Plug-in names are humanised keys for now.** Every plug-in carries a
 *    `labelKey`, and resolving it needs the catalogue AP 6 brings.
 *    `moduleDisplayName` derives something readable until then; the two core
 *    tiles use the headings of the sections they point at, which are the same
 *    words a reader sees on arrival.
 */
@Component({
  selector: 'trefaro-event-detail-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (tiles().length > 0) {
      <nav class="tiles" aria-label="What this event offers">
        @for (tile of tiles(); track tile.target) {
          <a class="tile" [routerLink]="[]" [fragment]="tile.target">
            <span class="tile__label">{{ tile.label }}</span>
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

  protected readonly tiles = computed<readonly DetailTile[]>(() => {
    const tiles: DetailTile[] = [];

    if (this.sessions() > 0) {
      tiles.push({
        target: 'program',
        label: 'Programme',
        hint: `${this.sessions()} ${this.sessions() === 1 ? 'session' : 'sessions'}`,
      });
    }

    if (this.mediaLinks() > 0) {
      tiles.push({
        target: 'media',
        label: 'Watch and read',
        hint: `${this.mediaLinks()} ${this.mediaLinks() === 1 ? 'link' : 'links'}`,
      });
    }

    // Read the load results so this recomputes as bundles finish — a tile that
    // appeared before its element was defined would scroll to nothing.
    this.loader.loadResults();
    for (const plugin of this.config.pluginsAt('event-detail')) {
      if (!this.loader.isReady(plugin.key)) continue;
      tiles.push({
        target: pluginElementId(plugin.key),
        label: moduleDisplayName(plugin.key),
        hint: 'on this page',
      });
    }

    return tiles;
  });
}
