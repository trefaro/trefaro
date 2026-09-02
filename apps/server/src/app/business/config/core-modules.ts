import {
  CHAT_MODULE_KEY,
  MEDIA_LINKS_MODULE_KEY,
  PROFILES_MODULE_KEY,
  PROFILE_SEARCH_MODULE_KEY,
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
 * - `chat` and `profile-search` were gone and came back with their modules; a
 *   descriptor list is not a roadmap. `profiles` came back in AP 1 of phase 3,
 *   the day it had endpoints to switch off — which is the shape of the rule:
 *   a key appears here together with the code behind it, never before.
 *   `profile-search` came back in AP 5 and `chat` in AP 6, both on the same
 *   terms. All three keys are now real, and the five withdrawn placeholders of
 *   phase 2 are down to one that will never return: `newsletter`.
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
  /**
   * Translation key for the module's name in the administration.
   *
   * Under `modules.`, the same shape a plug-in uses under `plugins.` (AP 6 of
   * phase 2). One convention rather than two: the administration lists both
   * families in one table, and a name that resolves for one row and not for the
   * next is worse than no name at all. Written out rather than derived from
   * {@link key} — a key segment is `lowerCamelCase`, and `media-links` is not.
   * `module-keys.spec.ts` holds every descriptor to that.
   */
  readonly titleKey: string;
  readonly enabledByDefault: boolean;
  /**
   * Keys that have to be on before this module can be (E42).
   *
   * Declared here rather than checked in the service, so the administration can
   * show the prerequisite in the row and the check has one source. Enforced in
   * both directions by `ModuleAdminService`: switching this on without its
   * prerequisite is a 409 naming the missing key, and so is switching the
   * prerequisite off while this is on. Never resolved silently — "then I will
   * switch the others off for you" is a switch that does more than it says.
   *
   * Only core modules can carry one. A plug-in reaches core data through the
   * plug-in contract (E12), which is always there; a plug-in that needed
   * another module switched on would be reaching past that contract.
   */
  readonly requires?: readonly string[];
}

export const CORE_MODULES: readonly CoreModuleDescriptor[] = [
  // Participant accounts, profiles and everything that needs one (FR 4.1–4.3).
  // On by default and needing no configuration: an instance that keeps accounts
  // works the moment it starts. An organization that only runs events switches
  // it off, and then registering, logging in and every profile route answers
  // 404 — which is what the switch has to mean (F53). Switching it off deletes
  // nothing (E14): the accounts are still there when it comes back on.
  {
    key: PROFILES_MODULE_KEY,
    titleKey: 'modules.profiles.title',
    enabledByDefault: true,
  },
  // Finding other participants (FR 4.4, UC 12). On by default, like the
  // accounts it needs: the decision that protects a profile is the person's own
  // `searchable`, which is off until they say otherwise (E37, F13) — so a fresh
  // instance offers a search that finds nobody, which is the right way round.
  // An organization that wants accounts without a community directory switches
  // this off, and then the search endpoints answer 404 (F53) and the opt-in
  // disappears from the profile form, because a switch nothing reads is worse
  // than an absent one (F142).
  {
    key: PROFILE_SEARCH_MODULE_KEY,
    titleKey: 'modules.profileSearch.title',
    enabledByDefault: true,
    // There is nothing to search without accounts (E42).
    requires: [PROFILES_MODULE_KEY],
  },
  // Writing to one another (FR 4.5, UC 13). On by default, like the accounts
  // and the directory it sits beside, and for the same reason: nobody can be
  // written to until they switch `searchable` on themselves (E37, F13), so a
  // fresh instance has a chat in which no conversation can be started yet.
  // An organization that wants a participant directory without messaging
  // switches this off, and then the conversation endpoints — and the route
  // that serves a message's picture — answer 404 (F53). Switching it off
  // deletes nothing (E14): the conversations are still there when it returns.
  {
    key: CHAT_MODULE_KEY,
    titleKey: 'modules.chat.title',
    enabledByDefault: true,
    // A conversation is between accounts (E42). Deliberately **not**
    // `profile-search` as well: without the directory no new conversation can
    // be opened, but the ones that exist stay readable — a prerequisite would
    // claim that messaging is meaningless without a directory.
    requires: [PROFILES_MODULE_KEY],
  },
  // Embedding external stream and media library links costs nothing when unused.
  {
    key: MEDIA_LINKS_MODULE_KEY,
    titleKey: 'modules.mediaLinks.title',
    enabledByDefault: true,
  },
  // Off by default: push needs a VAPID key pair in the environment, and an
  // instance without one would offer participants a subscription that cannot be
  // stored.
  {
    key: PUSH_MODULE_KEY,
    titleKey: 'modules.push.title',
    enabledByDefault: false,
  },
];
