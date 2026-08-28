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
  /** Translation key for the module's name; resolved by the clients (E22). */
  readonly titleKey: string;
  readonly enabled: boolean;
  /** What a fresh instance starts with — shown as "default" in the list. */
  readonly enabledByDefault: boolean;
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

/**
 * A readable name for a module key, until the catalogue can be asked.
 *
 * Every module carries a `titleKey`, and resolving it needs the translation
 * catalogue that arrives with AP 6. Until then a screen that shows nothing but
 * `plugins.roomPlanning.title` is unusable, and hard-coding English names in two
 * clients would be a second catalogue nobody maintains. So the key itself is
 * humanised — `room-planning` becomes "Room planning" — which is right often
 * enough to be read and never claims to be a translation.
 */
export function moduleDisplayName(key: string): string {
  const words = key.split(/[-_]/).filter((word) => word.length > 0);
  if (words.length === 0) return key;
  return [
    words[0].charAt(0).toUpperCase() + words[0].slice(1),
    ...words.slice(1),
  ].join(' ');
}
