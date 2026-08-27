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
  type EventSeries,
  type EventSeriesInput,
  type EventSeriesStatus,
  type PublicEventSeries,
} from './lib/events';
export type {
  AppConfig,
  PluginDescriptor,
  PluginMountPoint,
  Theme,
} from './lib/config';
