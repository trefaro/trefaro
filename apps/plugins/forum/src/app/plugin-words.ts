import { FORUM_MODULE_KEY } from '@trefaro/shared-models';
import { wordsOf } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's words, bound to `plugins.forum.` (E48).
 *
 * The lines that were once here word for word — the fallback to the full
 * key, the status word, the instant with a clock — moved into
 * `shared-plugin-kit` when the third bundle would have copied them (F138,
 * AP 6 of phase 4). What stays is the binding to this plug-in's key.
 */
export const { word, statusWord } = wordsOf(FORUM_MODULE_KEY);

export { when } from '@trefaro/shared-plugin-kit';
