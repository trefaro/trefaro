import { Module } from '@nestjs/common';
import { PLUGIN_API_VERSION, type ServerPlugin } from '../plugin-api';
import type {
  ModuleConfigRecord,
  ModuleConfigRepository,
  ModuleDefault,
} from '../config/ports/module-config.repository';
import {
  PluginRegistryService,
  selectCompatiblePlugins,
} from './plugin-registry.service';

@Module({})
class StubPluginModule {}

function plugin(overrides: Partial<ServerPlugin> = {}): ServerPlugin {
  return {
    key: 'demo',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    titleKey: 'plugins.demo',
    module: StubPluginModule,
    persistence: { entities: [], migrations: [] },
    ...overrides,
  };
}

const withClient = (key: string, enabledByDefault = false): ServerPlugin =>
  plugin({
    key,
    enabledByDefault,
    client: {
      elementName: `trefaro-plugin-${key}`,
      bundleUrl: `/plugins/${key}.js`,
      mountPoints: ['event-detail'],
      labelKey: `plugins.${key}`,
      icon: 'extension',
    },
  });

/** In-memory stand-in for the data access layer's module_config repository. */
class FakeModuleConfigRepository implements ModuleConfigRepository {
  readonly rows = new Map<string, ModuleConfigRecord>();

  async findAll(): Promise<readonly ModuleConfigRecord[]> {
    return [...this.rows.values()];
  }

  async ensureDefaults(defaults: readonly ModuleDefault[]): Promise<void> {
    for (const entry of defaults) {
      if (!this.rows.has(entry.moduleKey)) {
        this.rows.set(entry.moduleKey, {
          moduleKey: entry.moduleKey,
          enabled: entry.enabled,
          settings: {},
        });
      }
    }
  }

  async setEnabled(
    moduleKey: string,
    enabled: boolean,
  ): Promise<ModuleConfigRecord> {
    const next = { moduleKey, enabled, settings: {} };
    this.rows.set(moduleKey, next);
    return next;
  }
}

describe('PluginRegistryService', () => {
  let repository: FakeModuleConfigRepository;

  beforeEach(() => {
    repository = new FakeModuleConfigRepository();
  });

  it('seeds a configuration row per plug-in on first boot', async () => {
    const service = new PluginRegistryService(
      [withClient('forum'), withClient('room-planning', true)],
      repository,
    );

    await service.onApplicationBootstrap();

    expect(await repository.findAll()).toEqual(
      expect.arrayContaining([
        { moduleKey: 'forum', enabled: false, settings: {} },
        { moduleKey: 'room-planning', enabled: true, settings: {} },
      ]),
    );
  });

  it('leaves an existing configuration row untouched', async () => {
    await repository.setEnabled('forum', true);
    const service = new PluginRegistryService(
      [withClient('forum')],
      repository,
    );

    await service.onApplicationBootstrap();

    // The plug-in defaults to off, but the organization already switched it on.
    expect(service.isEnabled('forum')).toBe(true);
  });

  it('reports only enabled plug-ins to the clients', async () => {
    const service = new PluginRegistryService(
      [withClient('forum', true), withClient('qr-checkin')],
      repository,
    );
    await service.onApplicationBootstrap();

    const descriptors = service.enabledClientDescriptors();

    expect(descriptors).toEqual([
      {
        key: 'forum',
        version: '1.0.0',
        labelKey: 'plugins.forum',
        elementName: 'trefaro-plugin-forum',
        bundleUrl: '/plugins/forum.js',
        mountPoints: ['event-detail'],
        icon: 'extension',
      },
    ]);
    // The administration still sees both, so a disabled plug-in can be enabled.
    expect(service.all()).toHaveLength(2);
  });

  it('omits plug-ins without a client contribution', async () => {
    const service = new PluginRegistryService(
      [plugin({ key: 'server-only', enabledByDefault: true })],
      repository,
    );
    await service.onApplicationBootstrap();

    expect(service.isEnabled('server-only')).toBe(true);
    expect(service.enabledClientDescriptors()).toEqual([]);
  });

  it('picks up a configuration change on refresh', async () => {
    const service = new PluginRegistryService(
      [withClient('forum')],
      repository,
    );
    await service.onApplicationBootstrap();
    expect(service.isEnabled('forum')).toBe(false);

    await repository.setEnabled('forum', true);
    await service.refresh();

    expect(service.isEnabled('forum')).toBe(true);
  });

  it('ignores configuration rows for modules that are not plug-ins', async () => {
    await repository.setEnabled('chat', true);
    const service = new PluginRegistryService(
      [withClient('forum')],
      repository,
    );
    await service.onApplicationBootstrap();

    expect(service.isEnabled('chat')).toBe(false);
  });
});

describe('selectCompatiblePlugins', () => {
  const silentLogger = { error: jest.fn(), warn: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('accepts plug-ins matching the current contract', () => {
    const plugins = [plugin({ key: 'a' }), plugin({ key: 'b' })];

    expect(selectCompatiblePlugins(plugins, silentLogger)).toHaveLength(2);
    expect(silentLogger.error).not.toHaveBeenCalled();
  });

  it('refuses a plug-in built against an incompatible contract version', () => {
    const plugins = [plugin({ key: 'legacy', apiVersion: '0.4.0' })];

    expect(selectCompatiblePlugins(plugins, silentLogger)).toEqual([]);
    expect(silentLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('legacy'),
    );
  });

  it('keeps only the first plug-in when a key is registered twice', () => {
    const first = plugin({ key: 'dup', version: '1.0.0' });
    const second = plugin({ key: 'dup', version: '2.0.0' });

    const accepted = selectCompatiblePlugins([first, second], silentLogger);

    expect(accepted).toEqual([first]);
    expect(silentLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('more than once'),
    );
  });
});
