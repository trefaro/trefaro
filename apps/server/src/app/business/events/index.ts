export { EventsModule } from './events.module';
export {
  EventsService,
  type CreateEventInput,
  type UpdateEventInput,
} from './events.service';
export {
  EVENT_REPOSITORY,
  EventSlugTakenError,
  type EventChanges,
  type EventRecord,
  type EventRepository,
  type NewEvent,
} from './ports/event.repository';
