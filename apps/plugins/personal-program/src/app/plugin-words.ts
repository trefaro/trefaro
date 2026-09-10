import { PERSONAL_PROGRAM_MODULE_KEY } from '@trefaro/shared-models';
import { wordsOf } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's words, bound to `plugins.personalProgram.` (E48).
 *
 * The fifth bundle, and the fifth to import exactly two libraries of the host:
 * the models it shares with the server and the kit the bundles share with each
 * other (F138). What stays here is the binding to this plug-in's key.
 */
export const { word } = wordsOf(PERSONAL_PROGRAM_MODULE_KEY);

export { clock, day } from '@trefaro/shared-plugin-kit';
