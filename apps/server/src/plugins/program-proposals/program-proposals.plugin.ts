import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import {
  PLUGIN_API_VERSION,
  type ServerPlugin,
} from '../../app/business/plugin-api';
import { CreateProgramProposalsSchema1787880000000 } from './data-access/migrations/1787880000000-CreateProgramProposalsSchema';
import { ProposalEntity } from './data-access/entities/proposal.entity';
import { ProgramProposalsModule } from './program-proposals.module';
import { PROGRAM_PROPOSALS_PLUGIN_KEY } from './program-proposals.plugin-key';

/**
 * Descriptor of the programme proposals plug-in (FR 3.13, FR 3.14, P2).
 *
 * The one place the plug-in declares all of its parts to the host: the module
 * carrying its API and business logic, the entity and migration making up its
 * data access contribution, and — new in plug-in API 1.2.0 — the module it needs
 * switched on before it can be.
 *
 * **`requires: ['profiles']`** (E47). A proposal belongs to a person, and
 * accounts exist only while the profiles module is on; without it every route
 * of this plug-in would answer 401 and its rows would point at a table nobody
 * can add to. Enforced by the module administration in both directions:
 * switching this on without accounts is a 409 naming `profiles`, and switching
 * `profiles` off while this is on is a 409 naming this plug-in.
 *
 * **No client contribution yet.** The web component, its mount points and its
 * icon arrive in AP 3 together with the two screens that render them — a
 * `bundleUrl` in the descriptor before there is a bundle behind it would be a
 * load failure reported to an organizer as a broken plug-in (E21, F47). Until
 * then this is a server-only plug-in, which the contract has always allowed.
 */
export const programProposalsPlugin: ServerPlugin = {
  key: PROGRAM_PROPOSALS_PLUGIN_KEY,
  version: '0.1.0',
  // The host's own version rather than a number of its own: this plug-in reads
  // who is asking and resolves an author's name, both of which are 1.2.0.
  apiVersion: PLUGIN_API_VERSION,
  titleKey: 'plugins.programProposals.title',
  module: ProgramProposalsModule,
  persistence: {
    entities: [ProposalEntity],
    // Stamped after the core migrations that create `event`, `user_profile`
    // and `admin_user`: both streams are ordered together by timestamp, and a
    // reference cannot precede the table it points at.
    migrations: [CreateProgramProposalsSchema1787880000000],
  },
  requires: [PROFILES_MODULE_KEY],
  // Off by default like every curated plug-in: an instance offers what the
  // organization asked for (NFR 1). Participating in the programme is a
  // decision about how an organization works, not a default.
  enabledByDefault: false,
};
