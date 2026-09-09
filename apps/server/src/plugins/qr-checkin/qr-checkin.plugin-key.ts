/**
 * The plug-in's stable key.
 *
 * Kept in its own file so the controllers can reference it without importing
 * the descriptor, which would pull the whole module graph into the import
 * cycle. Doubles as the `module_config.module_key`, so it must never change.
 */
export const QR_CHECKIN_PLUGIN_KEY = 'qr-checkin';
