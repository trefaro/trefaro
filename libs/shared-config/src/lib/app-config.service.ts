import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiClient } from '@trefaro/shared-http';
import { STARTUP_TIMEOUT_MS } from './startup-timeout';
import { DEFAULT_ORGANIZATION_NAME } from '@trefaro/shared-models';
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

  /**
   * What the instance calls itself — the header of both clients (FR 1.4).
   *
   * Falls back to the product name while the configuration is still on its way
   * and if it never arrives: a header with a hole in it looks broken, and this
   * is the one string a client shows before anything has loaded.
   */
  readonly organizationName = computed(
    () => this.state()?.organizationName ?? DEFAULT_ORGANIZATION_NAME,
  );

  /**
   * Where the participant client answers, or `''` before the configuration has
   * arrived.
   *
   * Only the deployment knows it: behind the proxy both clients share an origin,
   * in development they are two ports, and the organizer client — the one that
   * needs it, to link an event's public page — cannot derive it from its own.
   */
  readonly publicUserClientUrl = computed(
    () => this.state()?.publicUserClientUrl ?? '',
  );

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

  /**
   * Fetches the configuration again, after this client itself changed it.
   *
   * Not a push channel and not a poll: the design page writes the branding and
   * then needs to know what the server now says — the font as a CSS stack, the
   * logo URL with its new `?v=`, the name as it was trimmed. Reading it back
   * rather than merging the write into the cache means the client cannot end up
   * holding a configuration the server does not agree with.
   *
   * Every other client learns of the change on its next start (E20).
   */
  reload(): Promise<AppConfig> {
    this.pending = null;
    return this.ensureLoaded();
  }
}
