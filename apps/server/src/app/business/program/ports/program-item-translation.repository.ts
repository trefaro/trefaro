import type { ProgramItemTranslation } from '@trefaro/shared-models';
import type {
  ContentTranslationReader,
  ContentTranslationRepository,
} from '../../common/ports/content-translation.port';

/**
 * Port for what a session says in other languages (FR 3.12, E25).
 *
 * Title and description; `speaker` has no translation because a person's name is
 * what they are called, and times have none because an instant is one instant
 * (E8, F78).
 */
export type ProgramItemTranslationReader =
  ContentTranslationReader<ProgramItemTranslation>;

export type ProgramItemTranslationRepository =
  ContentTranslationRepository<ProgramItemTranslation>;

export const PROGRAM_ITEM_TRANSLATION_REPOSITORY = Symbol(
  'TREFARO_PROGRAM_ITEM_TRANSLATION_REPOSITORY',
);
