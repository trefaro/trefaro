import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
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

  function render() {
    config = new StubAppConfig();
    loader = new StubLoader();
    TestBed.configureTestingModule({
      providers: [
        { provide: AppConfigService, useValue: config },
        { provide: PluginLoaderService, useValue: loader },
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
      locale: 'de',
    });
    fixture.detectChanges();

    const element = mounted(fixture)[0] as HTMLElement & {
      eventId?: string;
      locale?: string;
    };
    expect(element.eventId).toBe('event-42');
    expect(element.locale).toBe('de');
  });

  it('remounts with the new context when it changes', () => {
    const fixture = render();
    const elementName = defineElement();
    config.plugins.set([descriptor('p', elementName, ['event-detail'])]);
    loader.ready.set(['p']);
    fixture.componentInstance.context.set({ eventId: 'first' });
    fixture.detectChanges();

    fixture.componentInstance.context.set({ eventId: 'second' });
    fixture.detectChanges();

    const elements = mounted(fixture) as (HTMLElement & { eventId?: string })[];
    expect(elements).toHaveLength(1);
    expect(elements[0].eventId).toBe('second');
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
