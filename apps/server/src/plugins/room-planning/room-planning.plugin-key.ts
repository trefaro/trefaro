/**
 * The plug-in's stable key.
 *
 * Kept in its own file so the controller can reference it without importing the
 * descriptor, which would pull the whole module graph into the import cycle.
 * Doubles as the `module_config.module_key`, so it must never change.
 */
export const ROOM_PLANNING_PLUGIN_KEY = 'room-planning';
