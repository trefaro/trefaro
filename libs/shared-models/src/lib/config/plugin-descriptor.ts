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
