import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import {
  PLUGIN_API_VERSION,
  type ServerPlugin,
} from '../../app/business/plugin-api';
import { CreateForumSchema1787890000000 } from './data-access/migrations/1787890000000-CreateForumSchema';
import { PostEntity } from './data-access/entities/post.entity';
import { ThreadEntity } from './data-access/entities/thread.entity';
import { ForumModule } from './forum.module';
import { FORUM_PLUGIN_KEY } from './forum.plugin-key';

/**
 * Descriptor of the discussion forum plug-in (FR 4.6, P2).
 *
 * The one place the plug-in declares all of its parts to the host: the module
 * carrying its API and business logic, the two entities and the one migration
 * making up its data access contribution, and the module it needs switched on
 * before it can be.
 *
 * **`requires: ['profiles']`** (E47). A post belongs to a person, and accounts
 * exist only while the profiles module is on; without it every route of this
 * plug-in would answer 401 and its rows would point at a table nobody can add
 * to. Enforced by the module administration in both directions: switching this
 * on without accounts is a 409 naming `profiles`, and switching `profiles` off
 * while this is on is a 409 naming this plug-in.
 *
 * **No `client` half yet.** The web component, its two hook points
 * (`event-detail`, `event-dashboard`) and its icon come in AP 5, together with
 * the screens they draw; a `bundleUrl` without a bundle would be a load error
 * the module administration reports to an organizer as a broken plug-in (F47).
 * Until then the plug-in is an API with a name in the module list.
 */
export const forumPlugin: ServerPlugin = {
  key: FORUM_PLUGIN_KEY,
  version: '0.1.0',
  // The host's own version rather than a number of its own: this plug-in reads
  // who is asking and resolves an author's name, both of which are 1.2.0.
  apiVersion: PLUGIN_API_VERSION,
  titleKey: 'plugins.forum.title',
  module: ForumModule,
  persistence: {
    entities: [ThreadEntity, PostEntity],
    // Stamped after the core migrations that create `event`, `user_profile`
    // and `admin_user`: both streams are ordered together by timestamp, and a
    // reference cannot precede the table it points at.
    migrations: [CreateForumSchema1787890000000],
  },
  requires: [PROFILES_MODULE_KEY],
  // Off by default like every curated plug-in: an instance offers what the
  // organization asked for (NFR 1). A forum is a decision about how an
  // organization talks with its participants, not a default.
  enabledByDefault: false,
};
