import type { ServerPlugin } from '../app/business/plugin-api';
import { roomPlanningPlugin } from './room-planning/room-planning.plugin';

/**
 * The curated plug-ins bundled in this image (F6).
 *
 * v1 installs no plug-ins at runtime: what an organization can enable is what
 * ships here, which keeps the attack surface of a self-hosted instance small.
 * Enabling and disabling then happens purely through configuration.
 *
 * Registered in this list, not discovered: an accidental directory does not
 * become a mounted plug-in.
 */
export const CURATED_PLUGINS: readonly ServerPlugin[] = [roomPlanningPlugin];
