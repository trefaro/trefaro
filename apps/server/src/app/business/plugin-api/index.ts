/**
 * Public surface of the server plug-in contract.
 *
 * Plug-ins import from here and from nowhere else inside the server — enforced
 * by the linter since AP 2 of phase 4, which is why the controller decorator and
 * the enabled guard live in this directory rather than in the plug-in manager.
 * Anything not re-exported is an internal detail that may change without a
 * version bump.
 */
export {
  PLUGIN_API_VERSION,
  isCompatiblePluginApiVersion,
} from './plugin-api-version';
/**
 * The window a paginated list reads (F138, F159).
 *
 * Host code reached **through** the contract rather than copied into a plug-in.
 * Every plug-in of phase 4 answers at least one paginated list, and the rule
 * that put this function in `business/common/` in the first place is the one
 * that forbids the copy: five services had it twice each, and the sixth found a
 * drift nobody had noticed. A plug-in may not import `business/common/`, so the
 * contract re-exports it — one function, no state, and the same reading of
 * "page 0" everywhere.
 */
export {
  pageWindow,
  type PageRequest,
  type PageWindow,
} from '../common/page-window';
/**
 * The reading of `?locale=` (F94), reached through the contract for the same
 * reason: three answers, and only one of them an error — the originals when
 * the parameter is missing, no error for a well-formed language nobody
 * translated into, a 400 for what is not a language tag. A plug-in that reads
 * translated content for a participant (E56) declares the parameter with
 * these two, so the rule is the host's and not a plug-in's second reading.
 */
export { ApiLocaleQuery, LocaleQueryPipe } from '../common/locale-query.pipe';
export {
  CurrentPluginOrganizer,
  CurrentPluginParticipant,
  type PluginOrganizer,
  type PluginParticipant,
} from './current-actor';
export {
  PLUGIN_PARTICIPANT_READS,
  type PluginAuthor,
  type PluginParticipantReads,
} from './participant-reads';
export {
  PLUGIN_ENABLED,
  PluginController,
  PluginEnabledGuard,
  declaredPluginKey,
  type PluginEnabled,
} from './plugin-controller';
export { PLUGIN_PERSISTENCE_REGISTRY, SERVER_PLUGINS } from './plugin-tokens';
export {
  PLUGIN_PROGRAM_READS,
  type PluginProgramItem,
  type PluginProgramReads,
} from './program-reads';
export {
  PLUGIN_REGISTRATION_READS,
  byPluginAccount,
  byPluginLink,
  type PluginRegistration,
  type PluginRegistrationClaim,
  type PluginRegistrationReads,
  type PluginRegistrationSlice,
  type PluginRegistrationWindow,
} from './registration-reads';
export type {
  PluginClientContribution,
  PluginMountPoint,
  PluginPersistenceContribution,
  ServerPlugin,
} from './server-plugin';
