/**
 * Configuration and module query shared by both clients.
 *
 * Implements the first two steps of the client start sequence: load the
 * configuration, then apply the theme.
 */
export { AppConfigService } from './lib/app-config.service';
export { provideTrefaroConfig } from './lib/provide-trefaro-config';
