import { NotFoundException } from '@nestjs/common';
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

interface Harness {
  service: ModuleAdminService;
  repository: FakeModuleConfigRepository;
  refreshed: string[];
  enabled: Set<string>;
}

function harness(options: { enabled?: readonly string[] } = {}): Harness {
  const enabled = new Set(options.enabled ?? ['media-links']);
  const refreshed: string[] = [];
  const repository = new FakeModuleConfigRepository();

  const coreModules = {
    all: () => CORE,
    isEnabled: (key: string) => enabled.has(key),
    refresh: async () => {
      refreshed.push('core');
    },
  } as unknown as CoreModuleRegistryService;

  const plugins = {
    all: () => [ROOM_PLANNING, SERVER_ONLY],
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

  it('carries version, bundle and mount points for a plug-in and nothing for a core module', () => {
    const { service } = harness();
    const byKey = new Map(service.list().map((module) => [module.key, module]));

    expect(byKey.get('room-planning')).toMatchObject({
      version: '0.1.0',
      bundleUrl: '/api/plugins/room-planning/main.js',
      mountPoints: ['event-detail'],
    });
    // A core module ships inside the application: no version of its own, no
    // bundle a client could fail to load.
    expect(byKey.get('media-links')).toMatchObject({
      version: null,
      bundleUrl: null,
      mountPoints: [],
    });
    // And a plug-in without a client contribution says so rather than inventing
    // a bundle URL.
    expect(byKey.get('audit-log')).toMatchObject({
      version: '2.0.0',
      bundleUrl: null,
      mountPoints: [],
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
});
