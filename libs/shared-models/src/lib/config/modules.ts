import type { PluginMountPoint } from './plugin-descriptor';

/**
 * The push notification module's key (FR 3.15, FR 1.5).
 *
 * Here rather than beside a push domain model, because there is none: what the
 * clients know about push is the VAPID key in the configuration and whether the
 * subscription endpoints answer. `media-links` keeps its key next to its own
 * models (`MEDIA_LINKS_MODULE_KEY`) for the same reason — it has some.
 */
export const PUSH_MODULE_KEY = 'push';

/**
 * The two families of switchable functionality (FR 1.5).
 *
 * They are switched the same way — one flag per key in `module_config` — and
 * differ in what a switched-on one adds: a core module's endpoints start
 * answering, a plug-in's bundle additionally becomes loadable by the clients.
 * The administration lists both, and it has to say which is which: an organizer
 * who enables a plug-in and sees nothing needs to know a bundle was involved.
 */
export type ModuleFamily = 'core' | 'plugin';

/**
 * One switchable module, as the module administration reads it (FR 1.5).
 *
 * Descriptor and state in one answer, because the page shows one row per module
 * whether it is on or off — a list of enabled keys (which is what `/api/config`
 * carries) cannot be the source for a page whose whole job is switching the
 * disabled ones on.
 *
 * The three plug-in fields are `null` / empty for a core module rather than
 * absent: one shape for both families keeps the table one table.
 */
export interface ModuleSummary {
  readonly key: string;
  readonly family: ModuleFamily;
  /**
   * Translation key for the module's name: under `modules.` for a core module,
   * under `plugins.` for a plug-in.
   *
   * **Declared** by each descriptor, not derived from {@link key}. A key segment
   * is `lowerCamelCase`, so `media-links` could not spell itself
   * (`modules.media-links.title` is not a legal key) — and beyond that, an
   * identifier and a name are different things: the identifier is what
   * `module_config` and the API call the module, the name is what a reader sees.
   *
   * A key rather than a name, because the administration is one of the screens
   * an organization reads in its own language (NFR 4) and the module list is
   * assembled on the server, which has no opinion about which language that is.
   * Resolved by the clients against the catalogue from `GET /api/i18n/:locale`
   * (E22).
   */
  readonly titleKey: string;
  readonly enabled: boolean;
  /** What a fresh instance starts with — shown as "default" in the list. */
  readonly enabledByDefault: boolean;
  /**
   * Keys this module needs switched on before it can be (E42).
   *
   * Empty for almost everything, and never resolved silently: switching a
   * module on without its prerequisite is refused with the missing key named,
   * and so is switching a prerequisite off while something depends on it. The
   * alternative — "then I will switch the others on for you" — is a switch that
   * does more than it says.
   *
   * Here rather than only on the server, because the administration shows the
   * prerequisite in the row: an organizer who cannot switch the participant
   * search on has to be able to see why without pressing the button first.
   */
  readonly requires: readonly string[];
  /** Plug-ins only: the plug-in's own version. */
  readonly version: string | null;
  /** Plug-ins only: the bundle the clients load; `null` for a server-only one. */
  readonly bundleUrl: string | null;
  /** Plug-ins only: where the web component mounts. */
  readonly mountPoints: readonly PluginMountPoint[];
}

/** The one thing a module administration writes. */
export interface ModuleToggle {
  readonly enabled: boolean;
}
