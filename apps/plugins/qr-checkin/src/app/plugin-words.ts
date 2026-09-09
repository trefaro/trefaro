import { QR_CHECKIN_MODULE_KEY } from '@trefaro/shared-models';
import { wordsOf } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's words, bound to `plugins.qrCheckin.` (E48).
 *
 * One line, like every other bundle since the kit took the shared ones (F138):
 * the fallback to the full key and the instants live in `shared-plugin-kit`,
 * and what stays here is the binding to this plug-in's key.
 */
export const { word } = wordsOf(QR_CHECKIN_MODULE_KEY);

export { clock, when } from '@trefaro/shared-plugin-kit';
