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
  formatInstant,
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
export {
  DEFAULT_PARTICIPANT_PAGE_SIZE,
  DEFAULT_PARTICIPANT_SORT,
  DEFAULT_SORT_DIRECTION,
  MAX_PARTICIPANT_PAGE_SIZE,
  PARTICIPANT_SORTS,
  REGISTRATION_STATUSES,
  pageCount,
  type ConfirmationState,
  type ParticipantDetail,
  type ParticipantPage,
  type ParticipantQuery,
  type ParticipantRow,
  type ParticipantSort,
  type RegistrationAcknowledgement,
  type RegistrationConfirmation,
  type RegistrationCounts,
  type RegistrationInput,
  type RegistrationStatistics,
  type RegistrationStatus,
  type RegistrationStatusChange,
  type RegistrationWeek,
  type SortDirection,
} from './lib/registrations';
export type {
  AppConfig,
  PluginDescriptor,
  PluginMountPoint,
  Theme,
} from './lib/config';
