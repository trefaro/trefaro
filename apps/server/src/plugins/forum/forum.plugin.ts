import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import {
  PLUGIN_API_VERSION,
  type ServerPlugin,
} from '../../app/business/plugin-api';
import { CreateForumSchema1787890000000 } from './data-access/migrations/1787890000000-CreateForumSchema';
import { ThreadOutlivesItsOpener1787911000000 } from './data-access/migrations/1787911000000-ThreadOutlivesItsOpener';
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
 * **Two hook points, one bundle** (AP 5). The web component renders a
 * participant's forum at `event-detail` — the threads, one thread with its
 * posts, and the two forms — and the organization's moderation section at
 * `event-dashboard`, where the tile above it is a jump link (E59). Which of the
 * two it is drawing arrives as `mountPoint` in the slot context (F202). AP 4
 * shipped this descriptor without the `client` half on purpose: a `bundleUrl`
 * without a bundle would have been a load error the module administration
 * reports to an organizer as a broken plug-in (F47).
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
    migrations: [
      CreateForumSchema1787890000000,
      ThreadOutlivesItsOpener1787911000000,
    ],
  },
  requires: [PROFILES_MODULE_KEY],
  client: {
    elementName: 'trefaro-plugin-forum',
    bundleUrl: '/api/plugins/forum/main.js',
    // Both halves of FR 4.6 in one element: taking part is something a
    // participant does while reading about an event, and moderating is
    // something an organizer does on that event's dashboard.
    mountPoints: ['event-detail', 'event-dashboard'],
    labelKey: 'plugins.forum.label',
    // The glyph the closed set has held for it since AP 1 (E49).
    icon: 'forum',
  },
  // Off by default like every curated plug-in: an instance offers what the
  // organization asked for (NFR 1). A forum is a decision about how an
  // organization talks with its participants, not a default.
  enabledByDefault: false,
};
