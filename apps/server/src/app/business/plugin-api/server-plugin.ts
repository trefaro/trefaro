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
  /**
   * Icon for the tile or navigation entry the host draws for this plug-in.
   *
   * A name from `ICON_NAMES` in `@trefaro/shared-models` — the closed set of
   * glyphs an instance ships (E49). Typed as a plain string rather than that
   * union on purpose: a descriptor is a plug-in's own declaration, and a name
   * this version does not draw has to be answerable at runtime, not only at
   * compile time. It gets **no** icon, and the module administration says so.
   * Read by both clients since AP 1 of phase 4; before that the field was a
   * value nobody drew.
   */
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
  /**
   * Module keys that have to be switched on before this plug-in can be (E47).
   *
   * Added in plug-in API 1.2.0, and it is an addition in the strict sense: a
   * plug-in that declares nothing has no prerequisite, which is what every
   * plug-in before AP 2 of phase 4 was.
   *
   * Enforced by the module administration in both directions, exactly as a core
   * module's `requires` is (E42, F128): switching this plug-in on while one of
   * these is off answers 409 and names the missing key, and switching one of
   * them off while this plug-in is on answers 409 and names the plug-in. Never
   * resolved silently — "then I will switch the others on for you" is a switch
   * that does more than it says.
   *
   * F128 exempted plug-ins from this on the grounds that a plug-in reaches core
   * data through the contract, and the contract is always there. That holds for
   * programme items and sign-ups. It does not hold for **people**: a proposal, a
   * forum post and a personal programme belong to an account, and accounts exist
   * only while `profiles` is on. A plug-in that stored rows pointing at
   * `user_profile` on an instance without accounts would be a plug-in whose
   * every route answers 401.
   */
  readonly requires?: readonly string[];
}
