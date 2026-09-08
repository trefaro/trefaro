/**
 * The plug-in's stable key.
 *
 * Kept in its own file so the controllers can reference it without importing the
 * descriptor, which would pull the whole module graph into the import cycle.
 * Doubles as the `module_config.module_key` and as the first segment of the
 * plug-in's catalogue namespace, so it must never change (the descriptor rule
 * since phase 0). The clients read the same constant from `shared-models`.
 */
export { FORUM_MODULE_KEY as FORUM_PLUGIN_KEY } from '@trefaro/shared-models';
