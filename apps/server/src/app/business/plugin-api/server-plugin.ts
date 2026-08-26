import type { DynamicModule, Type } from '@nestjs/common';

/**
 * Where a plug-in's web component may be mounted in the clients.
 *
 * The thesis fixes exactly two hook points, so the set stays closed: adding one
 * is a versioned change to this contract, not an ad-hoc extension.
 */
export type PluginMountPoint = 'navigation' | 'event-detail';

/**
 * The plug-in's persistence contribution: its own entities and its own
 * migrations.
 *
 * Typed as `unknown` on purpose. A plug-in *does* own database artifacts, but
 * the business layer must not know the ORM (strict layering) — so it only ever
 * forwards this value. Only `data-access/plugin-data-access` interprets it, and
 * that is the single place where the ORM types appear.
 *
 * Plug-in migrations must never touch core tables; a plug-in owns its own
 * tables and nothing else. A plug-in's own table *may* reference a core table —
 * that constrains the plug-in, not the core — but then its migration has to be
 * timestamped after the core migration that creates the referenced table, since
 * both migration streams are ordered together by timestamp.
 */
export interface PluginPersistenceContribution {
  readonly entities: readonly unknown[];
  readonly migrations: readonly unknown[];
}

/**
 * How a plug-in shows up in the clients.
 *
 * The bundle is a framework-independent web component. It ships no CSS of its
 * own — the whitelabel design reaches it through CSS custom properties
 * inherited from the host document.
 */
export interface PluginClientContribution {
  /** Custom element name, e.g. `trefaro-plugin-room-planning`. */
  readonly elementName: string;
  /** URL the client's plug-in manager loads the bundle from. */
  readonly bundleUrl: string;
  readonly mountPoints: readonly PluginMountPoint[];
  /**
   * Translation key for the label shown at the mount point. The text itself
   * lives in the clients' language files so organizations can maintain it.
   */
  readonly labelKey: string;
  /** Material Symbols icon name for the navigation entry or dashboard tile. */
  readonly icon?: string;
}

/**
 * A curated server plug-in.
 *
 * The three parts the architecture demands map onto this descriptor as follows:
 * the API implementation and the business logic implementation are both
 * provided by {@link module} (controllers and providers of one NestJS module),
 * and the data access implementation is {@link persistence}.
 *
 * Plug-ins are bundled in the image and toggled at runtime through
 * configuration (F6). "Runtime" is meant literally: every curated plug-in is
 * mounted at boot and its tables always exist, while the enabled flag decides
 * whether its API answers and whether the clients load its web component. That
 * way enabling a forum is a click, not a container restart.
 */
export interface ServerPlugin {
  /**
   * Stable identifier. Doubles as the `module_config.module_key` and as the key
   * the clients use, so it must never change once released.
   */
  readonly key: string;
  /** The plug-in's own version, for diagnostics and the admin UI. */
  readonly version: string;
  /** The plug-in contract version this plug-in was built against. */
  readonly apiVersion: string;
  /** Translation key for the plug-in's name in the module administration. */
  readonly titleKey: string;
  /** NestJS module contributing the plug-in's controllers and providers. */
  readonly module: Type<unknown> | DynamicModule;
  readonly persistence: PluginPersistenceContribution;
  /** Absent for plug-ins that only add server-side behaviour. */
  readonly client?: PluginClientContribution;
  /**
   * Whether a fresh instance starts with this plug-in switched on. Curated
   * plug-ins default to off so an instance offers only what the organization
   * actually asked for (NFR 1, appropriateness).
   */
  readonly enabledByDefault?: boolean;
}
