export { RegistrationModule } from './registration.module';
export { RegistrationService } from './registration.service';
export {
  REGISTRATION_REPOSITORY,
  RegistrationExistsError,
  type NewRegistration,
  type RegistrationChanges,
  type RegistrationRecord,
  type RegistrationRepository,
} from './ports/registration.repository';
export {
  REGISTRATION_TALLY,
  type RegistrationTally,
} from './ports/registration-tally';
