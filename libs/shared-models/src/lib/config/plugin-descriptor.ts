/** The two places a plug-in's web component may be mounted in a client. */
export type PluginMountPoint = 'navigation' | 'event-detail';

/**
 * An enabled plug-in as announced to the clients.
 *
 * The client plug-in manager reads this after loading the configuration and
 * then fetches each bundle, registers the custom element and mounts it at the
 * declared hook points.
 */
export interface PluginDescriptor {
  /** Stable plug-in key, also used as the module configuration key. */
  readonly key: string;
  readonly version: string;
  /** Translation key for the plug-in's label; the text lives in the clients. */
  readonly labelKey: string;
  /** Custom element name the bundle registers. */
  readonly elementName: string;
  /** URL the bundle is loaded from. */
  readonly bundleUrl: string;
  readonly mountPoints: readonly PluginMountPoint[];
  readonly icon: string | null;
}

/**
 * The id the plug-in slot puts on a mounted web component.
 *
 * Built here rather than in the slot, because two places need the same string:
 * the slot that mounts the element and the tile in the participant's event
 * detail view that links to it (FR 1.5). A plug-in renders inside the page it is
 * mounted on, so its tile is a jump link — and a jump link needs a target
 * neither side may spell differently.
 */
export function pluginElementId(pluginKey: string): string {
  return `plugin-${pluginKey}`;
}
