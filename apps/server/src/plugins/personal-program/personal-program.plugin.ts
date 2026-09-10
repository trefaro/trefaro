import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import {
  PLUGIN_API_VERSION,
  type ServerPlugin,
} from '../../app/business/plugin-api';
import { PlanEntryEntity } from './data-access/entities/plan-entry.entity';
import { CreatePersonalProgramSchema1787910000000 } from './data-access/migrations/1787910000000-CreatePersonalProgramSchema';
import { PersonalProgramModule } from './personal-program.module';
import { PERSONAL_PROGRAM_PLUGIN_KEY } from './personal-program.plugin-key';

/**
 * Descriptor of the personal programme plug-in (FR 3.17, P3).
 *
 * The one place the plug-in declares all of its parts to the host: the module
 * carrying its API and business logic, the entity and the migration making up
 * its data access contribution, and the module it needs switched on before it
 * can be.
 *
 * **`requires: ['profiles']`** (E47). A plan belongs to an account, and accounts
 * exist only while the profiles module is on; without it every route of this
 * plug-in would answer 401 and its rows would point at a table nobody can add
 * to. Enforced by the module administration in both directions: switching this
 * on without accounts is a 409 naming `profiles`, and switching `profiles` off
 * while this is on is a 409 naming this plug-in.
 *
 * **One hook point**, the only plug-in of the five with a single one. `FR 3.17`
 * is a participant's screen and nothing else: there is no organizer's half,
 * because who means to attend what is not an attendance list (E55) — the list
 * of who actually holds a seat is the programme's, and the list of who came
 * through the door is the check-in's.
 *
 * Since 04.09.2026 this is a curated plug-in rather than an optional one — the
 * plan of phase 4 promoted FR 3.17 out of the maybe-list — and it is still the
 * last of the five, because FR 3.17 is P3.
 */
export const personalProgramPlugin: ServerPlugin = {
  key: PERSONAL_PROGRAM_PLUGIN_KEY,
  version: '0.1.0',
  // The host's own version rather than a number of its own: this plug-in reads
  // the sessions of an event translated, which is 1.2.0.
  apiVersion: PLUGIN_API_VERSION,
  titleKey: 'plugins.personalProgram.title',
  module: PersonalProgramModule,
  persistence: {
    entities: [PlanEntryEntity],
    // Stamped after the core migrations that create `program_item` and
    // `user_profile`: both streams are ordered together by timestamp, and a
    // reference cannot precede the table it points at.
    migrations: [CreatePersonalProgramSchema1787910000000],
  },
  requires: [PROFILES_MODULE_KEY],
  client: {
    elementName: 'trefaro-plugin-personal-program',
    bundleUrl: '/api/plugins/personal-program/main.js',
    // The event page, and only the event page: a plan is made where the
    // programme is read.
    mountPoints: ['event-detail'],
    labelKey: 'plugins.personalProgram.label',
    // The glyph the closed set has held for it since AP 1 (E49).
    icon: 'event_note',
  },
  // Off by default like every curated plug-in: an instance offers what the
  // organization asked for (NFR 1).
  enabledByDefault: false,
};
