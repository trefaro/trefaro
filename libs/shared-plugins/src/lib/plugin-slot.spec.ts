import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  PluginDescriptor,
  PluginMountPoint,
} from '@trefaro/shared-models';
import {
  PluginLoaderService,
  type PluginLoadResult,
} from './plugin-loader.service';
import { PluginSlot } from './plugin-slot';

let elementCounter = 0;
/** Custom element definitions are permanent, so each test needs a fresh name. */
function defineElement(): string {
  elementCounter += 1;
  const name = `trefaro-plugin-slot-test-${elementCounter}`;
  customElements.define(name, class extends HTMLElement {});
  return name;
}

function descriptor(
  key: string,
  elementName: string,
  mountPoints: readonly PluginMountPoint[],
): PluginDescriptor {
  return {
    key,
    version: '1.0.0',
    labelKey: `plugins.${key}`,
    elementName,
    bundleUrl: `/api/plugins/${key}/main.js`,
    mountPoints,
    icon: null,
  };
}

/** Config and loader stubs, so the slot is tested without HTTP or script loading. */
class StubAppConfig {
  readonly plugins = signal<readonly PluginDescriptor[]>([]);
  pluginsAt(mountPoint: PluginMountPoint): readonly PluginDescriptor[] {
    return this.plugins().filter((plugin) =>
      plugin.mountPoints.includes(mountPoint),
    );
  }
}

/**
 * The catalogue, as far as the slot is concerned.
 *
 * A flat map per language and a prefix selection over it — the same shape the
 * real service answers with (F70), so the stripping of the prefix is tested
 * here rather than assumed.
 */
class StubTranslations {
  readonly locale = signal('en');
  private readonly catalogue: Record<string, Record<string, string>> = {
    en: {
      'plugins.roomPlanning.title': 'Room planning',
      'plugins.roomPlanning.action': 'Interested in a room',
      'plugins.forum.title': 'Forum',
      'event.program': 'Programme',
    },
    de: {
      'plugins.roomPlanning.title': 'Raumplanung',
      'plugins.roomPlanning.action': 'Interesse an einem Raum',
      'plugins.forum.title': 'Forum',
      'event.program': 'Programm',
    },
  };

  stringsWithPrefix(prefix: string): Readonly<Record<string, string>> {
    const selected: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      this.catalogue[this.locale()] ?? {},
    )) {
      if (key.startsWith(prefix)) selected[key.slice(prefix.length)] = value;
    }
    return selected;
  }
}

class StubLoader {
  readonly ready = signal<readonly string[]>([]);
  loadResults(): readonly PluginLoadResult[] {
    // Read the signal so the slot recomputes when readiness changes.
    return this.ready().map(
      (key) =>
        ({
          plugin: descriptor(key, key, []),
          status: 'ready',
        }) as PluginLoadResult,
    );
  }
  isReady(key: string): boolean {
    return this.ready().includes(key);
  }
}

@Component({
  imports: [PluginSlot],
  template: `<trefaro-plugin-slot
    [mountPoint]="mountPoint()"
    [context]="context()"
  />`,
})
class HostComponent {
  readonly mountPoint = signal<PluginMountPoint>('event-detail');
  readonly context = signal<Record<string, unknown>>({});
}

describe('PluginSlot', () => {
  let config: StubAppConfig;
  let loader: StubLoader;
  let i18n: StubTranslations;

  function render() {
    config = new StubAppConfig();
    loader = new StubLoader();
    i18n = new StubTranslations();
    TestBed.configureTestingModule({
      providers: [
        { provide: AppConfigService, useValue: config },
        { provide: PluginLoaderService, useValue: loader },
        { provide: TranslationService, useValue: i18n },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  function mounted(fixture: ReturnType<typeof render>): HTMLElement[] {
    const slot = fixture.nativeElement.querySelector('.trefaro-plugin-slot');
    return Array.from(slot?.children ?? []) as HTMLElement[];
  }

  it('mounts nothing when no plug-in is enabled', () => {
    const fixture = render();

    expect(mounted(fixture)).toEqual([]);
  });

  it('mounts the custom element of a ready plug-in at its hook point', () => {
    const fixture = render();
    const elementName = defineElement();
    config.plugins.set([descriptor('forum', elementName, ['event-detail'])]);
    loader.ready.set(['forum']);
    fixture.detectChanges();

    const elements = mounted(fixture);
    expect(elements).toHaveLength(1);
    expect(elements[0].tagName.toLowerCase()).toBe(elementName);
    expect(elements[0].dataset['plugin']).toBe('forum');
    // The link target of this plug-in's tile in the participant client (AP 4 of
    // phase 2). Assigned by the slot, so a bundle cannot forget it.
    expect(elements[0].id).toBe('plugin-forum');
  });

  it('skips a plug-in whose bundle has not made its element available', () => {
    const fixture = render();
    config.plugins.set([
      descriptor('forum', defineElement(), ['event-detail']),
    ]);
    // Enabled by configuration, but its bundle failed to load.
    loader.ready.set([]);
    fixture.detectChanges();

    expect(mounted(fixture)).toEqual([]);
  });

  it('mounts only the plug-ins declaring this hook point', () => {
    const fixture = render();
    const navigationOnly = defineElement();
    const detailOnly = defineElement();
    config.plugins.set([
      descriptor('nav-plugin', navigationOnly, ['navigation']),
      descriptor('detail-plugin', detailOnly, ['event-detail']),
    ]);
    loader.ready.set(['nav-plugin', 'detail-plugin']);
    fixture.detectChanges();

    expect(
      mounted(fixture).map((element) => element.dataset['plugin']),
    ).toEqual(['detail-plugin']);
  });

  it('hands the context over as element properties', () => {
    const fixture = render();
    const elementName = defineElement();
    config.plugins.set([
      descriptor('room-planning', elementName, ['event-detail']),
    ]);
    loader.ready.set(['room-planning']);
    fixture.componentInstance.context.set({
      eventId: 'event-42',
      seats: 40,
    });
    fixture.detectChanges();

    const element = mounted(fixture)[0] as HTMLElement & {
      eventId?: string;
      seats?: number;
    };
    expect(element.eventId).toBe('event-42');
    expect(element.seats).toBe(40);
  });

  it('reassigns the context when it changes, keeping the element', () => {
    const fixture = render();
    const elementName = defineElement();
    config.plugins.set([descriptor('p', elementName, ['event-detail'])]);
    loader.ready.set(['p']);
    fixture.componentInstance.context.set({ eventId: 'first' });
    fixture.detectChanges();
    const before = mounted(fixture)[0];

    fixture.componentInstance.context.set({ eventId: 'second' });
    fixture.detectChanges();

    const elements = mounted(fixture) as (HTMLElement & { eventId?: string })[];
    expect(elements).toHaveLength(1);
    expect(elements[0].eventId).toBe('second');
    // The same element, not a fresh one: a plug-in holding what a visitor typed
    // may not lose it to a property changing (plug-in API 1.2.0).
    expect(elements[0]).toBe(before);
  });

  it('hands every plug-in the language and its own words (E48)', () => {
    const fixture = render();
    config.plugins.set([
      descriptor('room-planning', defineElement(), ['event-detail']),
    ]);
    loader.ready.set(['room-planning']);
    fixture.detectChanges();

    const element = mounted(fixture)[0] as HTMLElement & {
      locale?: string;
      strings?: Record<string, string>;
    };
    expect(element.locale).toBe('en');
    // Keyed without the prefix: a plug-in's key space is its own, and it reads
    // `strings['title']`.
    expect(element.strings).toEqual({
      title: 'Room planning',
      action: 'Interested in a room',
    });
  });

  it("hands a plug-in nothing of another plug-in's words", () => {
    const fixture = render();
    config.plugins.set([
      descriptor('room-planning', defineElement(), ['event-detail']),
      descriptor('forum', defineElement(), ['event-detail']),
    ]);
    loader.ready.set(['room-planning', 'forum']);
    fixture.detectChanges();

    const [rooms, forum] = mounted(fixture) as (HTMLElement & {
      strings?: Record<string, string>;
    })[];
    expect(Object.keys(rooms.strings ?? {}).sort()).toEqual([
      'action',
      'title',
    ]);
    expect(forum.strings).toEqual({ title: 'Forum' });
  });

  it('reassigns the words on a language switch, without remounting', () => {
    const fixture = render();
    config.plugins.set([
      descriptor('room-planning', defineElement(), ['event-detail']),
    ]);
    loader.ready.set(['room-planning']);
    fixture.detectChanges();
    const before = mounted(fixture)[0];

    i18n.locale.set('de');
    fixture.detectChanges();

    const element = mounted(fixture)[0] as HTMLElement & {
      locale?: string;
      strings?: Record<string, string>;
    };
    expect(element).toBe(before);
    expect(element.locale).toBe('de');
    expect(element.strings?.['title']).toBe('Raumplanung');
  });

  it('does not let a hook point shadow what the contract promises', () => {
    const fixture = render();
    config.plugins.set([
      descriptor('room-planning', defineElement(), ['event-detail']),
    ]);
    loader.ready.set(['room-planning']);
    // A page that still passes a locale of its own, the way the event landing
    // page did before 1.2.0.
    fixture.componentInstance.context.set({ locale: 'fr', strings: {} });
    fixture.detectChanges();

    const element = mounted(fixture)[0] as HTMLElement & {
      locale?: string;
      strings?: Record<string, string>;
    };
    expect(element.locale).toBe('en');
    expect(element.strings?.['title']).toBe('Room planning');
  });

  it('follows a change of hook point', () => {
    const fixture = render();
    const navigationElement = defineElement();
    config.plugins.set([
      descriptor('nav-plugin', navigationElement, ['navigation']),
    ]);
    loader.ready.set(['nav-plugin']);
    fixture.detectChanges();
    expect(mounted(fixture)).toEqual([]);

    fixture.componentInstance.mountPoint.set('navigation');
    fixture.detectChanges();

    expect(mounted(fixture)).toHaveLength(1);
  });
});
