/**
 * Public surface of the server plug-in contract.
 *
 * Plug-ins import from here and from nowhere else inside the server. Anything
 * not re-exported is an internal detail that may change without a version bump.
 */
export {
  PLUGIN_API_VERSION,
  isCompatiblePluginApiVersion,
} from './plugin-api-version';
export { PLUGIN_PERSISTENCE_REGISTRY, SERVER_PLUGINS } from './plugin-tokens';
export {
  PLUGIN_PROGRAM_READS,
  type PluginProgramItem,
  type PluginProgramReads,
} from './program-reads';
export type {
  PluginClientContribution,
  PluginMountPoint,
  PluginPersistenceContribution,
  ServerPlugin,
} from './server-plugin';
