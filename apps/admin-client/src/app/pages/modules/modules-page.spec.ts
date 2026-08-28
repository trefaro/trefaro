import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import type { ModuleSummary } from '@trefaro/shared-models';
import {
  PluginLoaderService,
  type PluginLoadResult,
} from '@trefaro/shared-plugins';
import { ModulesAdminService } from '../../features/modules/modules-admin.service';
import { ModulesPage } from './modules-page';

/**
 * The module administration in the client (FR 1.5) — AP 4.
 *
 * What is asserted here is what the page is for: that a disabled module is
 * offered at all, that a click writes the flag the server owns, that this client
 * re-reads its own configuration afterwards (the navigation and every
 * `isModuleEnabled` read it), and that a plug-in whose bundle failed says so.
 */
function core(key: string, enabled: boolean): ModuleSummary {
  return {
    key,
    family: 'core',
    titleKey: `modules.${key}`,
    enabled,
    enabledByDefault: true,
    version: null,
    bundleUrl: null,
    mountPoints: [],
  };
}

function plugin(key: string, enabled: boolean): ModuleSummary {
  return {
    key,
    family: 'plugin',
    titleKey: `plugins.${key}.title`,
    enabled,
    enabledByDefault: false,
    version: '0.1.0',
    bundleUrl: `/api/plugins/${key}/main.js`,
    mountPoints: ['event-detail'],
  };
}

function loadResult(
  key: string,
  status: PluginLoadResult['status'],
  error?: string,
): PluginLoadResult {
  return {
    plugin: {
      key,
      version: '0.1.0',
      labelKey: `plugins.${key}`,
      elementName: `trefaro-plugin-${key}`,
      bundleUrl: `/api/plugins/${key}/main.js`,
      mountPoints: ['event-detail'],
      icon: null,
    },
    status,
    ...(error ? { error } : {}),
  };
}

class FakeModulesAdminService {
  readonly written: { key: string; enabled: boolean }[] = [];
  failWith: unknown = null;

  constructor(private modules: readonly ModuleSummary[]) {}

  async list(): Promise<readonly ModuleSummary[]> {
    return this.modules;
  }

  async setEnabled(key: string, enabled: boolean): Promise<ModuleSummary> {
    if (this.failWith) throw this.failWith;
    this.written.push({ key, enabled });
    this.modules = this.modules.map((module) =>
      module.key === key ? { ...module, enabled } : module,
    );
    return this.modules.find((module) => module.key === key) as ModuleSummary;
  }
}

describe('ModulesPage', () => {
  function render(options: {
    modules?: readonly ModuleSummary[];
    plugins?: readonly PluginLoadResult[];
  }) {
    const admin = new FakeModulesAdminService(options.modules ?? []);
    let reloads = 0;

    TestBed.configureTestingModule({
      providers: [
        { provide: ModulesAdminService, useValue: admin },
        {
          provide: AppConfigService,
          useValue: {
            reload: async () => {
              reloads += 1;
            },
          },
        },
        {
          provide: PluginLoaderService,
          useValue: { loadResults: () => options.plugins ?? [] },
        },
      ],
    });
    const fixture = TestBed.createComponent(ModulesPage);
    fixture.detectChanges();

    return {
      fixture,
      admin,
      reloads: () => reloads,
      text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
      buttons: () =>
        [
          ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ] as HTMLButtonElement[],
      settle: async () => {
        await fixture.whenStable();
        fixture.detectChanges();
      },
    };
  }

  it('offers the disabled modules too, which is the whole point', async () => {
    const page = render({
      modules: [core('media-links', true), plugin('room-planning', false)],
    });
    await page.settle();

    const text = page.text();
    expect(text).toContain('media-links');
    expect(text).toContain('room-planning');
    // Humanised until the catalogue arrives (AP 6); the key stays in the row.
    expect(text).toContain('Room planning');
    expect(text).toContain('disabled');
    expect(page.buttons().map((button) => button.textContent?.trim())).toEqual([
      'Disable',
      'Enable',
    ]);
  });

  it('says which kind a module is, because only a plug-in has a bundle', async () => {
    const page = render({
      modules: [core('push', false), plugin('room-planning', true)],
    });
    await page.settle();

    expect(page.text()).toContain('Core module');
    expect(page.text()).toContain('Plug-in');
    expect(page.text()).toContain('/api/plugins/room-planning/main.js');
  });

  it('writes the flag and re-reads what this client itself offers', async () => {
    const page = render({ modules: [plugin('room-planning', false)] });
    await page.settle();

    page.buttons()[0].click();
    await page.settle();

    expect(page.admin.written).toEqual([
      { key: 'room-planning', enabled: true },
    ]);
    // The navigation and every `isModuleEnabled` read the cached configuration,
    // so the client that just changed it has to read it again (E20 applies to
    // everybody else).
    expect(page.reloads()).toBe(1);
    expect(page.buttons()[0].textContent?.trim()).toBe('Disable');
  });

  it('says a switched-on plug-in needs a reload, and a switched-off one keeps its data', async () => {
    const page = render({ modules: [core('media-links', true)] });
    await page.settle();

    page.buttons()[0].click();
    await page.settle();

    // Two sentences an organizer needs: nothing was deleted, and this document
    // will not grow a plug-in component on its own (E20).
    expect(page.text()).toContain('data is untouched');

    page.buttons()[0].click();
    await page.settle();

    expect(page.text()).toContain('Reload this page');
  });

  it('surfaces why a plug-in failed, so an enabled plug-in that never appears is explainable', async () => {
    const page = render({
      modules: [plugin('forum', true)],
      plugins: [
        loadResult(
          'forum',
          'failed',
          'Bundle /api/plugins/forum/main.js could not be fetched',
        ),
      ],
    });
    await page.settle();

    expect(page.text()).toContain('failed');
    expect(page.text()).toContain('could not be fetched');
  });

  it('keeps the list and shows the message when the server refuses', async () => {
    const page = render({ modules: [core('media-links', true)] });
    await page.settle();
    page.admin.failWith = { status: 404, message: 'No module "media-links"' };

    page.buttons()[0].click();
    await page.settle();

    expect(page.text()).toContain('No module');
    // Still enabled: the page shows what the server says, not what was clicked.
    expect(page.buttons()[0].textContent?.trim()).toBe('Disable');
    expect(page.reloads()).toBe(0);
  });

  it('says so when this image ships nothing optional', async () => {
    const page = render({});
    await page.settle();

    expect(page.text()).toContain('ships no optional module');
  });
});
