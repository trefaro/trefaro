/**
 * Version of the server plug-in contract.
 *
 * NFR 2 requires stable, extensible interfaces, and the architecture rules allow
 * changes to this contract only in versioned steps. Semantics:
 *
 * - MAJOR — a breaking change; plug-ins built against an older major are refused.
 * - MINOR — additions that older plug-ins keep working with.
 * - PATCH — clarifications with no signature change.
 *
 * A plug-in declares the version it was built against; the plug-in manager
 * refuses to mount anything whose major version does not match.
 *
 * History, so a reader can see what a step means in practice:
 *
 * - **1.0.0** — the contract as phase 0 established it: descriptor, mount
 *   points, persistence contribution.
 * - **1.1.0** — adds {@link PluginProgramReads}, the read port the room planning
 *   plug-in needs for the overbooking check (E12). An addition, so every 1.0
 *   plug-in keeps working: it simply never asks.
 * - **1.2.0** — the one step of phase 4, taken in its first work package and
 *   filled by the ones after it (E46). What it adds, in the order the packages
 *   fill it: the slot hands every mounted element `locale` and its own words
 *   from the catalogue (E48), and a client contribution's `icon` is finally
 *   read, from a closed set of names in the image (E49). Then, with their own
 *   packages, `ServerPlugin.requires` (E47), the host ports for participants
 *   and registrations, the title and `listForEvent` with a locale on
 *   {@link PluginProgramReads} (E56 — filled in AP 6, where the room plan
 *   turned out to be the first screen that names its sessions), and the two
 *   further mount points `event-dashboard` and `my-registration` — each
 *   arriving with the code that uses it, because a capability nothing fills is
 *   one that only looks like a capability (F47).
 *
 * - **1.3.0** — the last step before v1.0 (E69, AP 11 of phase 5), and one
 *   field: {@link PluginProgramItem.timezone}, the zone an event's times are
 *   meant to be read in. It closes the one place where a plug-in could not
 *   help being wrong — the room plan and the personal programme drew their
 *   slots in the reader's clock, while the programme above them on the same
 *   page stood in the event's (E8), so a plan read from Toronto disagreed with
 *   the page it was part of. Carried at the **port** rather than at the slot
 *   because only a page knows an event, and a hook point that has none —
 *   `navigation`, `my-registration` — would have to hand over nothing; a
 *   property that is sometimes legitimately absent is one every plug-in has to
 *   handle absent, and the fallback would be the browser's zone, which is the
 *   bug. An addition like the two before it: every phase-4 plug-in stays
 *   mounted and never asks.
 *
 * Five plug-ins in one phase, and **one** minor step for all of them: five
 * steps would have been the same decision five times, with five compatibility
 * cases, and a 1.6.0 whose numbers say nothing about what changed.
 *
 * **After 1.3.0 the contract is closed for v1.0** (E69). What was weighed for
 * this step and deliberately left out is in `docs/PHASE5.md` under AP 11: the
 * two capabilities the second half of E55 would need, and the read that would
 * let a data export carry what a plug-in stores.
 */
export const PLUGIN_API_VERSION = '1.3.0';

interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

function parse(version: string): SemanticVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * A plug-in is compatible when its major version matches the host's and it does
 * not require a newer minor version than the host provides.
 */
export function isCompatiblePluginApiVersion(
  declared: string,
  host: string = PLUGIN_API_VERSION,
): boolean {
  const plugin = parse(declared);
  const server = parse(host);
  if (!plugin || !server) return false;
  if (plugin.major !== server.major) return false;
  return plugin.minor <= server.minor;
}
