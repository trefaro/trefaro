import type { EventTranslation } from '@trefaro/shared-models';
import type {
  ContentTranslationReader,
  ContentTranslationRepository,
} from '../../common/ports/content-translation.port';

/**
 * Port for what an event says in other languages (FR 3.12, E25).
 *
 * Four fields, and the two that are missing are the decision: `venueAddress`
 * stays single-valued because a street is the same street in every language, and
 * `languages` because which languages an event is *held* in is a fact about the
 * event rather than a rendering of it (FR 3.1).
 */
export type EventTranslationReader = ContentTranslationReader<EventTranslation>;

export type EventTranslationRepository =
  ContentTranslationRepository<EventTranslation>;

export const EVENT_TRANSLATION_REPOSITORY = Symbol(
  'TREFARO_EVENT_TRANSLATION_REPOSITORY',
);
