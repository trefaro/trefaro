import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import type {
  PluginDescriptor,
  PluginMountPoint,
} from '@trefaro/shared-models';
import { provideRouter } from '@angular/router';
import { PluginLoaderService } from '@trefaro/shared-plugins';
import { EventDetailTiles } from './event-detail-tiles';

/**
 * The tiles of the event detail view (FR 1.5, mockups 5.2) — AP 4.
 *
 * The rule under test is the one that separates a tile from decoration: a tile
 * exists when there is something behind it. Not per enabled module — media links
 * ship enabled and most events have none — and not per enabled plug-in either,
 * because a bundle that failed to load leaves nothing to scroll to.
 */
const LABELS: Record<string, Record<string, string>> = {
  en: {
    'plugins.roomPlanning.label': 'Room planning',
    'event.program': 'Programme',
    'event.media': 'Watch and read',
    'event.tiles.sessions.one': '{{count}} session',
    'event.tiles.sessions.many': '{{count}} sessions',
    'event.tiles.links.one': '{{count}} link',
    'event.tiles.links.many': '{{count}} links',
  },
  de: {
    'plugins.roomPlanning.label': 'Raumplanung',
    'event.program': 'Programm',
    'event.media': 'Ansehen und nachlesen',
    'event.tiles.sessions.one': '{{count}} Programmpunkt',
    'event.tiles.sessions.many': '{{count}} Programmpunkte',
    'event.tiles.links.one': '{{count}} Link',
    'event.tiles.links.many': '{{count}} Links',
  },
};

/**
 * The translation service, in the shape that makes the reactivity testable.
 *
 * `locale` is a signal and `translate` is not reactive — which is how the real
 * one behaves, because Transloco's `translate()` reads a plain map. A tile label
 * is assembled in TypeScript and therefore has no pipe to re-render it, so the
 * computed has to read the language itself. A fake whose `translate()` read the
 * signal would hide exactly that.
 */
class FakeTranslations {
  readonly locale = signal('en');
  private language = 'en';

  translate(key: string, params?: Record<string, unknown>): string {
    const text = LABELS[this.language]?.[key] ?? key;
    return Object.entries(params ?? {}).reduce(
      (filled, [name, value]) => filled.replace(`{{${name}}}`, String(value)),
      text,
    );
  }

  use(locale: string): void {
    this.language = locale;
    this.locale.set(locale);
  }
}

/** As a real descriptor spells it: a key segment is `lowerCamelCase`. */
function camel(key: string): string {
  return key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function descriptor(
  key: string,
  mountPoints: readonly PluginMountPoint[],
): PluginDescriptor {
  return {
    key,
    version: '0.1.0',
    labelKey: `plugins.${camel(key)}.label`,
    elementName: `trefaro-plugin-${key}`,
    bundleUrl: `/api/plugins/${key}/main.js`,
    mountPoints,
    icon: null,
  };
}

class StubAppConfig {
  readonly plugins = signal<readonly PluginDescriptor[]>([]);
  pluginsAt(mountPoint: PluginMountPoint): readonly PluginDescriptor[] {
    return this.plugins().filter((plugin) =>
      plugin.mountPoints.includes(mountPoint),
    );
  }
}

class StubLoader {
  readonly ready = signal<readonly string[]>([]);
  loadResults(): readonly unknown[] {
    return this.ready();
  }
  isReady(key: string): boolean {
    return this.ready().includes(key);
  }
}

@Component({
  imports: [EventDetailTiles],
  template: `<trefaro-event-detail-tiles
    [sessions]="sessions()"
    [mediaLinks]="mediaLinks()"
  />`,
})
class HostComponent {
  readonly sessions = signal(0);
  readonly mediaLinks = signal(0);
}

describe('EventDetailTiles', () => {
  let config: StubAppConfig;
  let loader: StubLoader;
  let translations: FakeTranslations;

  function render() {
    config = new StubAppConfig();
    loader = new StubLoader();
    translations = new FakeTranslations();
    TestBed.configureTestingModule({
      providers: [
        { provide: TranslationService, useValue: translations },
        // The labels come from the fake above; this is for the `transloco` pipe
        // in the template, which reads Transloco itself.
        provideTranslationsForTest(),
        // The tiles navigate to the current route with a fragment rather than
        // carrying a bare `#…` href, which a `<base href>` would resolve against
        // itself — so they need a router even in a unit test.
        provideRouter([]),
        { provide: AppConfigService, useValue: config },
        { provide: PluginLoaderService, useValue: loader },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  function tiles(fixture: ReturnType<typeof render>): HTMLAnchorElement[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('a.tile'),
    ] as HTMLAnchorElement[];
  }

  it('shows nothing at all when the page has nothing to jump to', () => {
    const fixture = render();

    // Not an empty grid and not a heading over nothing: an event with no
    // programme, no media and no plug-in has no tiles.
    expect(tiles(fixture)).toEqual([]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('nav'),
    ).toBeNull();
  });

  it('links the programme tile at the timeline on this page', () => {
    const fixture = render();
    fixture.componentInstance.sessions.set(12);
    fixture.detectChanges();

    const [tile] = tiles(fixture);
    // The rendered address is the current route plus the fragment; with no route
    // active in a unit test that is `/#program`.
    expect(tile.getAttribute('href')).toMatch(/#program$/);
    expect(tile.textContent).toContain('Programme');
    expect(tile.textContent).toContain('12 sessions');
  });

  it('counts one session in the singular', () => {
    const fixture = render();
    fixture.componentInstance.sessions.set(1);
    fixture.detectChanges();

    expect(tiles(fixture)[0].textContent).toContain('1 session');
  });

  it('shows a media tile only when the event has links of its own', () => {
    const fixture = render();
    expect(tiles(fixture)).toEqual([]);

    fixture.componentInstance.mediaLinks.set(3);
    fixture.detectChanges();

    const [tile] = tiles(fixture);
    expect(tile.getAttribute('href')).toMatch(/#media$/);
    expect(tile.textContent).toContain('Watch and read');
    expect(tile.textContent).toContain('3 links');
  });

  it('shows a tile per mounted plug-in, pointing at its element', () => {
    const fixture = render();
    config.plugins.set([descriptor('room-planning', ['event-detail'])]);
    loader.ready.set(['room-planning']);
    fixture.detectChanges();

    const [tile] = tiles(fixture);
    // The id the plug-in slot puts on the mounted element.
    expect(tile.getAttribute('href')).toMatch(/#plugin-room-planning$/);
    // Labelled from the catalogue, so a German page grows no English tile.
    expect(tile.textContent).toContain('Room planning');
  });

  it('relabels a plug-in tile when the language changes', () => {
    const fixture = render();
    config.plugins.set([descriptor('room-planning', ['event-detail'])]);
    loader.ready.set(['room-planning']);
    fixture.detectChanges();

    translations.use('de');
    fixture.detectChanges();

    // A label built in a computed has no pipe to re-render it, so the computed
    // reads the active language. Without that, the tile keeps its English word
    // on a German page — and nothing else in the build notices.
    expect(tiles(fixture)[0].textContent).toContain('Raumplanung');
  });

  it('gives no tile to a plug-in whose bundle never made it', () => {
    const fixture = render();
    config.plugins.set([descriptor('forum', ['event-detail'])]);
    loader.ready.set([]);
    fixture.detectChanges();

    // Enabled by the organization, but there is nothing on the page to scroll
    // to. The organizer's module page is where a failed bundle is reported.
    expect(tiles(fixture)).toEqual([]);
  });

  it('ignores a plug-in that mounts in the navigation', () => {
    const fixture = render();
    config.plugins.set([descriptor('nav-plugin', ['navigation'])]);
    loader.ready.set(['nav-plugin']);
    fixture.detectChanges();

    expect(tiles(fixture)).toEqual([]);
  });

  it('appears as its plug-in becomes ready', () => {
    const fixture = render();
    config.plugins.set([descriptor('room-planning', ['event-detail'])]);
    fixture.detectChanges();
    expect(tiles(fixture)).toEqual([]);

    loader.ready.set(['room-planning']);
    fixture.detectChanges();

    expect(tiles(fixture)).toHaveLength(1);
  });
});
