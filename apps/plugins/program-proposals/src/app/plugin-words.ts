import { PROGRAM_PROPOSALS_MODULE_KEY } from '@trefaro/shared-models';
import { wordsOf } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's words, bound to `plugins.programProposals.` (E48).
 *
 * The lines that were once here word for word moved into `shared-plugin-kit`
 * when the third bundle would have copied them (F138, AP 6 of phase 4). What
 * stays is the binding to this plug-in's key.
 */
export const { word, statusWord } = wordsOf(PROGRAM_PROPOSALS_MODULE_KEY);
