import {
  MEDIA_LINKS_MODULE_KEY,
  PUSH_MODULE_KEY,
} from '@trefaro/shared-models';

/**
 * Core modules an organization may switch off (FR 1.5).
 *
 * Only genuinely optional functionality is listed. Event management itself —
 * login, configuration, event series, events, program, registration,
 * participants — is not toggleable: without it there is no application. This
 * follows NFR 1: offer only what the organization actually needs, but do not
 * let it disassemble the product.
 *
 * **Only modules that exist** (E21). Until AP 4 this list named six keys and one
 * of them read its flag; the other five were switches wired to nothing, which is
 * the same kind of prop as a field nothing reads (F42) — and it became visible
 * the moment an organizer got to see the list. So:
 *
 * - `newsletter` is gone. There will be no newsletter module (F8), and inviting
 *   former participants is explicitly not one (F55). Should the opt-in
 *   administration of FR 4.8 arrive in phase 3, it gets a key of its own then.
 * - `chat`, `profiles` and `profile-search` are gone and come back in phase 3
 *   with their modules. A descriptor list is not a roadmap.
 * - `push` stays and is real: its subscription endpoints carry the guard, and
 *   `/api/config` withholds the VAPID key while the module is off, so a client
 *   does not offer a subscription nothing would store (NFR 7).
 *
 * Rows in `module_config` for the withdrawn keys are left alone — switching a
 * module off never deletes anything, and neither does withdrawing its
 * descriptor. `ModuleFlagCache` ignores a flag no descriptor claims, so an
 * instance that had `chat` switched on finds it switched on again when phase 3
 * brings the module back.
 */
export interface CoreModuleDescriptor {
  readonly key: string;
  /** Translation key for the module's name in the administration. */
  readonly titleKey: string;
  readonly enabledByDefault: boolean;
}

export const CORE_MODULES: readonly CoreModuleDescriptor[] = [
  // Embedding external stream and media library links costs nothing when unused.
  {
    key: MEDIA_LINKS_MODULE_KEY,
    titleKey: 'modules.mediaLinks',
    enabledByDefault: true,
  },
  // Off by default: push needs a VAPID key pair in the environment, and an
  // instance without one would offer participants a subscription that cannot be
  // stored.
  { key: PUSH_MODULE_KEY, titleKey: 'modules.push', enabledByDefault: false },
];
