import type { ServerPlugin } from '../app/business/plugin-api';
import { forumPlugin } from './forum/forum.plugin';
import { personalProgramPlugin } from './personal-program/personal-program.plugin';
import { programProposalsPlugin } from './program-proposals/program-proposals.plugin';
import { qrCheckinPlugin } from './qr-checkin/qr-checkin.plugin';
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
 *
 * The order is the one the plan of phase 4 fixes, which is also the order of the
 * work packages — and it is the order the organizer's dashboard draws its tiles
 * and the sections under them in (E59). Registered rather than discovered means
 * sorted rather than incidental, so it is worth being deliberate about: the
 * reference plug-in moved down a line when the first plug-in of phase 4 arrived
 * above it, and another when the forum followed — and the check-in came in
 * below it, because FR 3.16 is P3 and the plan orders these by priority. The
 * personal programme is last for the same reason: FR 3.17 is P3 as well, and
 * of the two it is the one nothing else waits on.
 */
export const CURATED_PLUGINS: readonly ServerPlugin[] = [
  programProposalsPlugin,
  forumPlugin,
  roomPlanningPlugin,
  qrCheckinPlugin,
  personalProgramPlugin,
];
