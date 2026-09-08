import { ROOM_PLANNING_MODULE_KEY } from '@trefaro/shared-models';
import { wordsOf } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's words, bound to `plugins.roomPlanning.` (E48).
 *
 * The third bundle, and the one at which the shared lines stopped being
 * copied (F138): the fallback to the full key and the instants live in
 * `shared-plugin-kit`. What stays here is the binding to this plug-in's key.
 */
export const { word } = wordsOf(ROOM_PLANNING_MODULE_KEY);

export { clock, when } from '@trefaro/shared-plugin-kit';
