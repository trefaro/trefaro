import { CoreModuleRegistryService } from './core-module-registry.service';
import type {
  ModuleConfigRecord,
  ModuleConfigRepository,
  ModuleDefault,
} from './ports/module-config.repository';

/** In-memory stand-in for the data access layer's module_config repository. */
class FakeModuleConfigRepository implements ModuleConfigRepository {
  readonly rows = new Map<string, ModuleConfigRecord>();

  constructor(enabled: readonly string[] = []) {
    for (const key of enabled) {
      this.rows.set(key, { moduleKey: key, enabled: true, settings: {} });
    }
  }

  async findAll(): Promise<readonly ModuleConfigRecord[]> {
    return [...this.rows.values()];
  }

  async ensureDefaults(defaults: readonly ModuleDefault[]): Promise<void> {
    for (const entry of defaults) {
      if (!this.rows.has(entry.moduleKey)) {
        this.rows.set(entry.moduleKey, { ...entry, settings: {} });
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

/**
 * Which optional core modules are on (FR 1.5) — the counterpart of the plug-in
 * registry, and since AP 11 the single answer to that question.
 *
 * Two things are asserted that were nobody's job before: that a module shipped
 * switched on is switched on after a first boot (`media-links` is the only one),
 * and that a change made directly in the table is picked up without a restart —
 * which is what makes a switched-off module answer 404 in a running instance
 * (F53).
 */
describe('CoreModuleRegistryService', () => {
  let repository: FakeModuleConfigRepository;
  let service: CoreModuleRegistryService;

  beforeEach(() => {
    repository = new FakeModuleConfigRepository();
    service = new CoreModuleRegistryService(repository);
  });

  afterEach(() => service.onApplicationShutdown());

  it('seeds a configuration row per core module on first boot', async () => {
    await service.onApplicationBootstrap();

    // Media links are the one optional module that ships switched on: embedding
    // external links costs nothing when unused. Push starts off, because it
    // needs a VAPID key pair the deployment may not have provided.
    expect(repository.rows.get('media-links')?.enabled).toBe(true);
    expect(repository.rows.get('push')?.enabled).toBe(false);
    expect(service.isEnabled('media-links')).toBe(true);
    expect(service.isEnabled('push')).toBe(false);
  });

  it('does not overwrite a module the organization already configured', async () => {
    await repository.setEnabled('push', true);

    await service.onApplicationBootstrap();

    expect(service.isEnabled('push')).toBe(true);
  });

  it('ignores a flag whose descriptor this version no longer ships', async () => {
    // `chat` was a core module key until AP 4 of phase 2 and comes back with its
    // module in phase 3 (E21). The row is left alone — switching a module off
    // deletes nothing, and neither does withdrawing its descriptor — so an
    // instance that had it on finds it on again. Until then nothing answers for
    // it.
    await repository.setEnabled('chat', true);
    await service.onApplicationBootstrap();

    expect(service.isEnabled('chat')).toBe(false);
    expect(service.enabledKeys()).not.toContain('chat');
    expect(repository.rows.get('chat')?.enabled).toBe(true);
  });

  it('answers no for a module key that is not a core module', async () => {
    // A plug-in's flag lives in the same table; answering for it here would make
    // two registries disagree about the same key.
    await repository.setEnabled('room-planning', true);
    await service.onApplicationBootstrap();

    expect(service.isEnabled('room-planning')).toBe(false);
    expect(service.enabledKeys()).not.toContain('room-planning');
  });

  it('reports the enabled keys sorted, which is what /api/config carries', async () => {
    await repository.setEnabled('push', true);
    await service.onApplicationBootstrap();

    expect(service.enabledKeys()).toEqual(['media-links', 'push']);
  });

  it('lists every optional module, enabled or not — and only modules that exist', async () => {
    await service.onApplicationBootstrap();

    // The administration offers what can be switched on, not only what is. And
    // nothing else: a key nothing reads would be a switch wired to nothing
    // (E21).
    expect(service.all().map((module) => module.key)).toEqual([
      'media-links',
      'push',
    ]);
  });

  it('picks up a change made outside the application on refresh', async () => {
    await service.onApplicationBootstrap();
    expect(service.isEnabled('media-links')).toBe(true);

    await repository.setEnabled('media-links', false);
    await service.refresh();

    expect(service.isEnabled('media-links')).toBe(false);
  });
});

describe('CoreModuleRegistryService enabled-state refresh', () => {
  let repository: FakeModuleConfigRepository;
  let service: CoreModuleRegistryService;

  beforeEach(() => {
    jest.useFakeTimers();
    repository = new FakeModuleConfigRepository();
    service = new CoreModuleRegistryService(repository);
  });

  afterEach(() => {
    service.onApplicationShutdown();
    jest.useRealTimers();
  });

  it('switches a module off without a restart', async () => {
    await service.onApplicationBootstrap();

    // Stands in for an operator flipping the flag in module_config while the
    // server keeps running. Still supported after AP 4 gave organizers a page
    // for it: the administration writes the same table and only adds an
    // immediate re-read on top (F6).
    await repository.setEnabled('media-links', false);
    await jest.advanceTimersByTimeAsync(15_000);

    expect(service.isEnabled('media-links')).toBe(false);
  });

  it('stops refreshing once the application shuts down', async () => {
    await service.onApplicationBootstrap();
    service.onApplicationShutdown();

    await repository.setEnabled('push', true);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(service.isEnabled('push')).toBe(false);
  });

  it('keeps the last known state when a refresh fails', async () => {
    await service.onApplicationBootstrap();
    expect(service.isEnabled('media-links')).toBe(true);

    jest
      .spyOn(repository, 'findAll')
      .mockRejectedValueOnce(new Error('database unreachable'));
    await jest.advanceTimersByTimeAsync(15_000);

    // A blip in the database must not make every optional module answer 404.
    expect(service.isEnabled('media-links')).toBe(true);
  });
});
