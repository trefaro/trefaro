/**
 * Client plug-in manager shared by both clients.
 *
 * Loads the web components of the enabled plug-ins and mounts them at the two
 * hook points the architecture defines: the navigation bar and the event detail
 * view.
 */
export {
  PluginLoaderService,
  type PluginLoadResult,
  type PluginStatus,
} from './lib/plugin-loader.service';
export { PluginSlot } from './lib/plugin-slot';
export { provideTrefaroPlugins } from './lib/provide-trefaro-plugins';
