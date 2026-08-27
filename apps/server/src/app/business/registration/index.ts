export { RegistrationModule } from './registration.module';
export { RegistrationService } from './registration.service';
export { ParticipantsService } from './participants.service';
export {
  REGISTRATION_REPOSITORY,
  RegistrationExistsError,
  type NewRegistration,
  type RegistrationChanges,
  type RegistrationRecord,
  type RegistrationRepository,
  type RegistrationSearch,
  type RegistrationSlice,
} from './ports/registration.repository';
export {
  REGISTRATION_TALLY,
  type RegistrationTally,
} from './ports/registration-tally';
