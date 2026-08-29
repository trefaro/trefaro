import type { EventSeriesTranslation } from '@trefaro/shared-models';
import type {
  ContentTranslationReader,
  ContentTranslationRepository,
} from '../../common/ports/content-translation.port';

/**
 * Port for what a series says in other languages (FR 3.12, E25).
 *
 * It lives with the series rather than with the translation module for the same
 * reason the table hangs off `event_series` with `ON DELETE CASCADE`: a
 * translation belongs to the thing it translates. That also keeps the dependency
 * one-way — `EventSeriesService` reads this port to render a public page, and
 * the module that *writes* translations sits above all three parents.
 */
export type EventSeriesTranslationReader =
  ContentTranslationReader<EventSeriesTranslation>;

export type EventSeriesTranslationRepository =
  ContentTranslationRepository<EventSeriesTranslation>;

export const EVENT_SERIES_TRANSLATION_REPOSITORY = Symbol(
  'TREFARO_EVENT_SERIES_TRANSLATION_REPOSITORY',
);
