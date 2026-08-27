/**
 * Models shared by the server and both clients.
 *
 * Framework-free on purpose: the NestJS server, the participant client and the
 * organizer client all compile against these types, so a change to an API
 * contract breaks the build instead of a request at runtime.
 */
export type {
  AdminAccount,
  AdminLoginRequest,
  AdminSessionInfo,
} from './lib/auth';
export {
  EVENT_SERIES_STATUSES,
  EVENT_STATUSES,
  EVENT_TYPES,
  formatEventPeriod,
  hasEnded,
  instantToWallClock,
  isTimeZone,
  localTimeZone,
  wallClockToInstant,
  zoneLabel,
  type EventInput,
  type EventPeriod,
  type EventSeries,
  type EventSeriesInput,
  type EventSeriesStatus,
  type EventStatus,
  type EventType,
  type OrganizerEvent,
  type PublicEvent,
  type PublicEventSeries,
} from './lib/events';
export type {
  AppConfig,
  PluginDescriptor,
  PluginMountPoint,
  Theme,
} from './lib/config';
