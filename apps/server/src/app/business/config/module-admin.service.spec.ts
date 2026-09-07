import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ServerPlugin } from '../plugin-api';
import type { PluginRegistryService } from '../plugin-manager';
import type { CoreModuleDescriptor } from './core-modules';
import type { CoreModuleRegistryService } from './core-module-registry.service';
import { ModuleAdminService } from './module-admin.service';
import type {
  ModuleConfigRecord,
  ModuleConfigRepository,
  ModuleDefault,
} from './ports/module-config.repository';

/**
 * Switching modules on and off (FR 1.5) — AP 4.
 *
 * The three claims worth a test each are the three the page rests on: the list
 * carries the disabled modules too (otherwise there is nothing to switch on), a
 * write is visible immediately rather than up to fifteen seconds later (F6), and
 * an unknown key does not quietly become a row nothing reads.
 *
 * The registries are stood in for rather than driven through their own caches:
 * what is under test here is the composition — that the state in the answer is
 * the registries' state, and that both of them are asked to re-read.
 */
class FakeModuleConfigRepository implements ModuleConfigRepository {
  readonly written: { moduleKey: string; enabled: boolean }[] = [];

  async findAll(): Promise<readonly ModuleConfigRecord[]> {
    return [];
  }

  async ensureDefaults(_defaults: readonly ModuleDefault[]): Promise<void> {
    // Nothing to seed: this service never boots a cache.
  }

  async setEnabled(
    moduleKey: string,
    enabled: boolean,
  ): Promise<ModuleConfigRecord> {
    this.written.push({ moduleKey, enabled });
    return { moduleKey, enabled, settings: {} };
  }
}

const CORE: readonly CoreModuleDescriptor[] = [
  {
    key: 'media-links',
    titleKey: 'modules.mediaLinks.title',
    enabledByDefault: true,
  },
  { key: 'push', titleKey: 'modules.push.title', enabledByDefault: false },
];

/**
 * A pair with a prerequisite, for the E42 cases only.
 *
 * Its own list rather than two more entries in {@link CORE}: what the
 * prerequisite tests need is a dependency, and every other test here would have
 * to carry it in its expectations.
 */
const DEPENDENT: readonly CoreModuleDescriptor[] = [
  {
    key: 'profiles',
    titleKey: 'modules.profiles.title',
    enabledByDefault: true,
  },
  {
    key: 'profile-search',
    titleKey: 'modules.profileSearch.title',
    enabledByDefault: true,
    requires: ['profiles'],
  },
];

const ROOM_PLANNING = {
  key: 'room-planning',
  version: '0.1.0',
  apiVersion: '1.1.0',
  titleKey: 'plugins.roomPlanning.title',
  client: {
    elementName: 'trefaro-plugin-room-planning',
    bundleUrl: '/api/plugins/room-planning/main.js',
    mountPoints: ['event-detail'],
    labelKey: 'plugins.roomPlanning.label',
    icon: 'meeting_room',
  },
  enabledByDefault: false,
} as unknown as ServerPlugin;

/** A plug-in that only adds server-side behaviour — no bundle, no mount point. */
const SERVER_ONLY = {
  key: 'audit-log',
  version: '2.0.0',
  apiVersion: '1.1.0',
  titleKey: 'plugins.auditLog.title',
} as unknown as ServerPlugin;

/**
 * A plug-in that needs accounts (E47).
 *
 * Its own fixture for the same reason {@link DEPENDENT} is one: the E47 cases
 * need a plug-in with a prerequisite, and every other test here would otherwise
 * carry it in its expectations.
 */
const NEEDS_ACCOUNTS = {
  key: 'program-proposals',
  version: '0.1.0',
  apiVersion: '1.2.0',
  titleKey: 'plugins.programProposals.title',
  requires: ['profiles'],
  enabledByDefault: false,
} as unknown as ServerPlugin;

interface Harness {
  service: ModuleAdminService;
  repository: FakeModuleConfigRepository;
  refreshed: string[];
  enabled: Set<string>;
}

function harness(
  options: {
    enabled?: readonly string[];
    core?: readonly CoreModuleDescriptor[];
    plugins?: readonly ServerPlugin[];
  } = {},
): Harness {
  const enabled = new Set(options.enabled ?? ['media-links']);
  const core = options.core ?? CORE;
  const mounted = options.plugins ?? [ROOM_PLANNING, SERVER_ONLY];
  const refreshed: string[] = [];
  const repository = new FakeModuleConfigRepository();

  const coreModules = {
    all: () => core,
    isEnabled: (key: string) => enabled.has(key),
    refresh: async () => {
      refreshed.push('core');
    },
  } as unknown as CoreModuleRegistryService;

  const plugins = {
    all: () => mounted,
    isEnabled: (key: string) => enabled.has(key),
    refresh: async () => {
      refreshed.push('plugins');
    },
  } as unknown as PluginRegistryService;

  return {
    service: new ModuleAdminService(repository, coreModules, plugins),
    repository,
    refreshed,
    enabled,
  };
}

describe('ModuleAdminService', () => {
  it('lists both families, disabled modules included', () => {
    const { service } = harness();

    const list = service.list();

    // A list of only the enabled ones is what `/api/config` carries; a page for
    // switching things on needs the others.
    expect(list.map((module) => module.key)).toEqual([
      'media-links',
      'push',
      'room-planning',
      'audit-log',
    ]);
    expect(list.map((module) => module.family)).toEqual([
      'core',
      'core',
      'plugin',
      'plugin',
    ]);
  });

  it('reports the state the guards answer from, not the table', () => {
    const { service } = harness({ enabled: ['push', 'room-planning'] });

    const byKey = new Map(service.list().map((module) => [module.key, module]));

    expect(byKey.get('push')?.enabled).toBe(true);
    expect(byKey.get('room-planning')?.enabled).toBe(true);
    expect(byKey.get('media-links')?.enabled).toBe(false);
  });

  it('carries version, bundle, mount points and icon for a plug-in and nothing for a core module', () => {
    const { service } = harness();
    const byKey = new Map(service.list().map((module) => [module.key, module]));

    expect(byKey.get('room-planning')).toMatchObject({
      version: '0.1.0',
      bundleUrl: '/api/plugins/room-planning/main.js',
      mountPoints: ['event-detail'],
      // Passed on as declared: whether this version draws `meeting_room` is a
      // question the clients answer, and the module page shows the answer (E49).
      icon: 'meeting_room',
    });
    // A core module ships inside the application: no version of its own, no
    // bundle a client could fail to load.
    expect(byKey.get('media-links')).toMatchObject({
      version: null,
      bundleUrl: null,
      mountPoints: [],
      icon: null,
    });
    // And a plug-in without a client contribution says so rather than inventing
    // a bundle URL.
    expect(byKey.get('audit-log')).toMatchObject({
      version: '2.0.0',
      bundleUrl: null,
      mountPoints: [],
      icon: null,
    });
  });

  it('writes the flag and makes both caches re-read it at once', async () => {
    const { service, repository, refreshed, enabled } = harness();

    // The registries are asked again after the write, so the answer describes
    // what the guards will do — here: the switch took effect.
    const written = await service.setEnabled('room-planning', true);
    enabled.add('room-planning');

    expect(repository.written).toEqual([
      { moduleKey: 'room-planning', enabled: true },
    ]);
    // Both, not only the family the key belongs to: they read the same table,
    // and an organizer must not wait fifteen seconds for their own click (F6).
    expect(refreshed.sort()).toEqual(['core', 'plugins']);
    expect(written.key).toBe('room-planning');
  });

  it('switches a core module off', async () => {
    const { service, repository } = harness();

    await service.setEnabled('media-links', false);

    expect(repository.written).toEqual([
      { moduleKey: 'media-links', enabled: false },
    ]);
  });

  it('refuses a key this image does not ship, before writing anything', async () => {
    const { service, repository, refreshed } = harness();

    await expect(service.setEnabled('forum', true)).rejects.toThrow(
      NotFoundException,
    );

    // `module_config` would have taken the row, and nothing would ever have read
    // it — the keys that exist are the descriptors of this image.
    expect(repository.written).toEqual([]);
    expect(refreshed).toEqual([]);
  });

  describe('a module with a prerequisite (E42)', () => {
    it('reports what it needs, so the row can say so before the click', () => {
      const { service } = harness({ core: DEPENDENT });

      const byKey = new Map(
        service.list().map((module) => [module.key, module]),
      );

      expect(byKey.get('profile-search')?.requires).toEqual(['profiles']);
      // Everything else says "nothing", rather than leaving the field out: one
      // shape for every row keeps the table one table.
      expect(byKey.get('profiles')?.requires).toEqual([]);
      expect(
        service
          .list()
          .filter((module) => module.family === 'plugin')
          .map((module) => module.requires),
      ).toEqual([[], []]);
    });

    it('refuses to switch on while the prerequisite is off, and names it', async () => {
      const { service, repository, refreshed } = harness({
        core: DEPENDENT,
        enabled: [],
      });

      await expect(service.setEnabled('profile-search', true)).rejects.toThrow(
        ConflictException,
      );
      // The key, not only a refusal: the organizer has to know which other
      // switch to find, and the key is what the list and the table call it.
      await expect(service.setEnabled('profile-search', true)).rejects.toThrow(
        /"profiles"/,
      );

      // Nothing at all happened — a refused switch leaves the instance as it was.
      expect(repository.written).toEqual([]);
      expect(refreshed).toEqual([]);
    });

    it('refuses to switch the prerequisite off while a dependant is on, and names the dependant', async () => {
      const { service, repository } = harness({
        core: DEPENDENT,
        enabled: ['profiles', 'profile-search'],
      });

      // The half that is easy to forget: a prerequisite that can be withdrawn
      // under a running dependant is not a prerequisite. And it is refused
      // rather than resolved — switching the search off as well would answer a
      // question the organizer did not ask.
      await expect(service.setEnabled('profiles', false)).rejects.toThrow(
        /"profile-search"/,
      );
      expect(repository.written).toEqual([]);
    });

    it('lets the prerequisite go once nothing depends on it any more', async () => {
      const { service, repository } = harness({
        core: DEPENDENT,
        enabled: ['profiles'],
      });

      await service.setEnabled('profiles', false);

      expect(repository.written).toEqual([
        { moduleKey: 'profiles', enabled: false },
      ]);
    });

    it('lets the dependant on once the prerequisite is there', async () => {
      const { service, repository } = harness({
        core: DEPENDENT,
        enabled: ['profiles'],
      });

      await service.setEnabled('profile-search', true);

      expect(repository.written).toEqual([
        { moduleKey: 'profile-search', enabled: true },
      ]);
    });

    it('says nothing about a dependant that is off itself', async () => {
      const { service, repository } = harness({
        core: DEPENDENT,
        enabled: ['profiles'],
      });

      // `profile-search` declares the prerequisite but is switched off, so
      // withdrawing it breaks nothing that is running.
      await service.setEnabled('profiles', false);

      expect(repository.written).toHaveLength(1);
    });
  });

  /**
   * The same rule, one family further (E47).
   *
   * A prerequisite now crosses the two registries: the key a plug-in needs is a
   * core module, and the dependant a core module has to be refused for is a
   * plug-in. Both directions get a case, because a check that read one registry
   * only would pass the first and fail the second in production.
   */
  describe('a plug-in with a prerequisite (E47)', () => {
    const withProposals = (enabled: readonly string[]) =>
      harness({
        core: DEPENDENT,
        plugins: [NEEDS_ACCOUNTS],
        enabled,
      });

    it('reports what it needs, like a core module does', () => {
      const { service } = withProposals(['profiles']);

      const row = service
        .list()
        .find((module) => module.key === 'program-proposals');

      expect(row).toMatchObject({
        family: 'plugin',
        requires: ['profiles'],
      });
    });

    it('refuses to switch on while the core module it needs is off', async () => {
      const { service, repository } = withProposals([]);

      await expect(
        service.setEnabled('program-proposals', true),
      ).rejects.toThrow(/"profiles"/);
      // Not a row in `module_config` either: a plug-in whose rows point at
      // `user_profile` must not be switchable on an instance without accounts.
      expect(repository.written).toEqual([]);
    });

    it('refuses to withdraw the core module while the plug-in is on, and names the plug-in', async () => {
      const { service, repository } = withProposals([
        'profiles',
        'program-proposals',
      ]);

      await expect(service.setEnabled('profiles', false)).rejects.toThrow(
        /"program-proposals"/,
      );
      expect(repository.written).toEqual([]);
    });

    it('lets both switches move once the other side allows it', async () => {
      const { service, repository } = withProposals(['profiles']);

      await service.setEnabled('program-proposals', true);
      // And the other way round: with the plug-in off again, accounts may go.
      const { service: second, repository: secondWrites } = withProposals([
        'profiles',
      ]);
      await second.setEnabled('profiles', false);

      expect(repository.written).toEqual([
        { moduleKey: 'program-proposals', enabled: true },
      ]);
      expect(secondWrites.written).toEqual([
        { moduleKey: 'profiles', enabled: false },
      ]);
    });

    it('treats a prerequisite this image does not ship as missing', async () => {
      const { service } = harness({
        core: DEPENDENT,
        plugins: [
          {
            ...NEEDS_ACCOUNTS,
            requires: ['a-module-nobody-ships'],
          } as ServerPlugin,
        ],
        enabled: ['profiles'],
      });

      // `false` for an unknown key rather than `true`: a module naming
      // something absent cannot be switched on, and the 409 says which key.
      await expect(
        service.setEnabled('program-proposals', true),
      ).rejects.toThrow(/"a-module-nobody-ships"/);
    });
  });
});
