import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import {
  provideTranslationsForTest,
  TranslationService,
} from '@trefaro/shared-i18n';
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
/**
 * The catalogue, as this page sees it: a name per key per language.
 *
 * A fake rather than Transloco with a stub loader, because what the page has to
 * get right is not the lookup — it is that a name follows the active language.
 *
 * The shape matters and is copied from the real service deliberately:
 * {@link locale} is a signal, and {@link translate} is **not reactive**. That is
 * how Transloco works — `translate()` reads a plain map — so a component that
 * only calls `translate()` has registered no dependency on anything, and a
 * language change repaints nothing. A fake whose `translate()` read the signal
 * would pass whether or not the page gets this right, which is how the defect
 * reached the browser in the first place.
 */
const NAMES: Record<string, Record<string, string>> = {
  en: {
    'modules.mediaLinks.title': 'Media links',
    'modules.profiles.title': 'Participant accounts',
    'modules.profileSearch.title': 'Participant search',
    'plugins.roomPlanning.title': 'Room planning',
  },
  de: {
    'modules.mediaLinks.title': 'Medien-Links',
    'modules.profiles.title': 'Teilnehmerkonten',
    'modules.profileSearch.title': 'Teilnehmersuche',
    'plugins.roomPlanning.title': 'Raumplanung',
  },
};

class FakeTranslations {
  readonly locale = signal('en');
  /** What `translate` reads: a plain field, exactly as Transloco's does. */
  private language = 'en';

  translate(key: string): string {
    return NAMES[this.language]?.[key] ?? key;
  }

  use(locale: string): void {
    this.language = locale;
    this.locale.set(locale);
  }
}

/**
 * The key segment a descriptor would declare for a module key.
 *
 * Spelled out in the fixture because the real descriptors spell it out too: a
 * key segment is `lowerCamelCase`, so `media-links` cannot be one.
 */
function camel(key: string): string {
  return key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function core(
  key: string,
  enabled: boolean,
  requires: readonly string[] = [],
): ModuleSummary {
  return {
    key,
    family: 'core',
    titleKey: `modules.${camel(key)}.title`,
    enabled,
    enabledByDefault: true,
    requires,
    version: null,
    bundleUrl: null,
    mountPoints: [],
  };
}

function plugin(key: string, enabled: boolean): ModuleSummary {
  return {
    key,
    family: 'plugin',
    titleKey: `plugins.${camel(key)}.title`,
    enabled,
    enabledByDefault: false,
    // A plug-in reaches core data through the plug-in contract, which is
    // always there — so it has no prerequisite to declare (E42).
    requires: [],
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
      labelKey: `plugins.${camel(key)}.label`,
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
  let translations: FakeTranslations;

  function render(options: {
    modules?: readonly ModuleSummary[];
    plugins?: readonly PluginLoadResult[];
  }) {
    const admin = new FakeModulesAdminService(options.modules ?? []);
    translations = new FakeTranslations();
    let reloads = 0;

    TestBed.configureTestingModule({
      providers: [
        // The words this page is asserted on. The module *names* come from the
        // fake translation service below, which is the one thing this page
        // resolves in TypeScript rather than with the pipe.
        provideTranslationsForTest({
          'admin.modules.enabled': 'enabled',
          'admin.modules.disabled': 'disabled',
          'admin.modules.enable': 'Enable',
          'admin.modules.disable': 'Disable',
          'admin.modules.core': 'Core module',
          'admin.modules.plugin': 'Plug-in',
          'admin.modules.default': 'default: {{state}}',
          'admin.modules.version': 'version {{version}}',
          'admin.modules.requires': 'Needs {{modules}}',
          'admin.modules.bundle.failed': 'failed',
          'admin.modules.empty': 'This image ships no optional module.',
          'admin.modules.switchedOff':
            '{{name}} is switched off. Its data is untouched.',
          'admin.modules.switchedOn':
            '{{name}} is switched on. Reload this page to load its parts.',
        }),
        { provide: TranslationService, useValue: translations },
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
    // Resolved from the catalogue; the key stays in the row beside it, because
    // that is what the API and `module_config` call the thing.
    expect(text).toContain('Room planning');
    expect(text).toContain('disabled');
    expect(page.buttons().map((button) => button.textContent?.trim())).toEqual([
      'Disable',
      'Enable',
    ]);
  });

  it('names a prerequisite before anybody presses the button (E42)', async () => {
    const page = render({
      modules: [
        core('profiles', true),
        core('profile-search', false, ['profiles']),
      ],
    });
    await page.settle();

    // By name, not by key: the key is what `module_config` calls it, the name
    // is what the organizer is looking for in the row above.
    expect(page.text()).toContain('Needs Participant accounts');
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
    page.admin.failWith = {
      status: 404,
      message: 'No module "media-links"',
      explained: true,
    };

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

  it('renames every module when the language changes', async () => {
    const page = render({
      modules: [core('media-links', true), plugin('room-planning', false)],
    });
    await page.settle();
    expect(page.text()).toContain('Media links');

    translations.use('de');
    await page.settle();

    // The guard for the defect the browser walk of AP 6 found: the names were
    // resolved in a method the template called, so a language change repainted
    // nothing — this page is `OnPush` and the client is zoneless, and neither a
    // method call nor `<html lang>` marks a view for a new check. Reading the
    // language signal in the computed that builds the rows is what does.
    expect(page.text()).toContain('Medien-Links');
    expect(page.text()).toContain('Raumplanung');
    expect(page.text()).not.toContain('Media links');
  });
});
