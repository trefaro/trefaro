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
 */
export const PLUGIN_API_VERSION = '1.1.0';

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
