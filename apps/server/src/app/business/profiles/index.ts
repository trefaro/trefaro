export { CurrentParticipant } from './current-participant.decorator';
export { ParticipantGuard, isParticipantPath } from './participant.guard';
export type { RequestWithParticipant } from './participant.guard';
export { ProfilesModule } from './profiles.module';
export {
  ProfilesService,
  type ParticipantCredentialCheck,
} from './profiles.service';
export {
  USER_PROFILE_REPOSITORY,
  ProfileEmailTakenError,
  type NewUserProfile,
  type UserProfileChanges,
  type UserProfileRecord,
  type UserProfileRepository,
} from './ports/user-profile.repository';
export {
  USER_SESSION_REPOSITORY,
  type AuthenticatedParticipant,
  type NewUserSession,
  type UserSessionRepository,
} from './ports/user-session.repository';
export { UserSessionService } from './user-session.service';
export {
  USER_SESSION_COOKIE,
  userSessionCookieOptions,
} from './user-session-cookie';
