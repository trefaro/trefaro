import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiClient } from '@trefaro/shared-http';
import { STARTUP_TIMEOUT_MS } from './startup-timeout';
import type {
  AppConfig,
  PluginDescriptor,
  PluginMountPoint,
} from '@trefaro/shared-models';

/**
 * The instance configuration, fetched once at startup (FR 1.4, FR 1.5).
 *
 * First step of the client start sequence: the configuration decides the theme,
 * which modules exist and which plug-in bundles get loaded, so nothing may
 * render before it has arrived.
 *
 * {@link ensureLoaded} caches its promise, so several startup initializers can
 * await the configuration without ordering constraints between them and without
 * the request being made twice.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly api = inject(ApiClient);
  private readonly startupTimeoutMs = inject(STARTUP_TIMEOUT_MS);
  private readonly state = signal<AppConfig | null>(null);
  private pending: Promise<AppConfig> | null = null;

  /** `null` until the configuration has arrived. */
  readonly config = this.state.asReadonly();

  readonly enabledModules = computed<readonly string[]>(
    () => this.state()?.enabledModules ?? [],
  );

  readonly plugins = computed<readonly PluginDescriptor[]>(
    () => this.state()?.plugins ?? [],
  );

  /** VAPID public key, or `null` when this instance has push switched off. */
  readonly webPushPublicKey = computed(
    () => this.state()?.webPushPublicKey ?? null,
  );

  /**
   * Whether an optional core module is switched on.
   *
   * Used to decide whether a feature is offered at all — the participant client
   * shows a tile per enabled module on the event detail view.
   */
  isModuleEnabled(moduleKey: string): boolean {
    return this.enabledModules().includes(moduleKey);
  }

  /** The enabled plug-ins that want to be mounted at a given hook point. */
  pluginsAt(mountPoint: PluginMountPoint): readonly PluginDescriptor[] {
    return this.plugins().filter((plugin) =>
      plugin.mountPoints.includes(mountPoint),
    );
  }

  /** Fetches the configuration once; later calls await the same request. */
  ensureLoaded(): Promise<AppConfig> {
    this.pending ??= firstValueFrom(
      // Bounded: a server that never answers must not leave the client
      // rendering nothing. The timeout also aborts the request.
      this.api.get<AppConfig>('config').pipe(timeout(this.startupTimeoutMs)),
    ).then(
      (config) => {
        this.state.set(config);
        return config;
      },
      (error: unknown) => {
        // Allow a retry rather than caching the failure forever: a client that
        // started while the server was restarting should recover.
        this.pending = null;
        throw error;
      },
    );
    return this.pending;
  }
}
