export { EventSeriesModule } from './event-series.module';
export {
  EventSeriesService,
  type CreateEventSeriesInput,
  type UpdateEventSeriesInput,
} from './event-series.service';
export {
  EVENT_SERIES_REPOSITORY,
  EventSeriesSlugTakenError,
  type EventSeriesChanges,
  type EventSeriesRecord,
  type EventSeriesRepository,
  type NewEventSeries,
} from './ports/event-series.repository';
