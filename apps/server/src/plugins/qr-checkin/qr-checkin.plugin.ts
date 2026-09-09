import {
  PLUGIN_API_VERSION,
  type ServerPlugin,
} from '../../app/business/plugin-api';
import { TicketEntity } from './data-access/entities/ticket.entity';
import { CreateQrCheckinSchema1787900000000 } from './data-access/migrations/1787900000000-CreateQrCheckinSchema';
import { QrCheckinModule } from './qr-checkin.module';
import { QR_CHECKIN_PLUGIN_KEY } from './qr-checkin.plugin-key';

/**
 * Descriptor of the QR code check-in plug-in (FR 3.16, P3).
 *
 * The one place the plug-in declares all of its parts to the host: the module
 * carrying its API and business logic, and the one entity and one migration
 * making up its data access contribution.
 *
 * **No `requires`** (E47). Three of the five curated plug-ins need `profiles`
 * because they attribute something to a **person** and accounts exist only with
 * that module on; a check-in reads a registration, and a registration needs no
 * account — the whole point of E11 is that somebody who never made one still
 * reaches their own page. The session route is the second way in, not the only
 * one, and it answers 401 without accounts exactly as any participant route
 * does.
 *
 * **No `client` half yet.** The ticket page and the door arrive in AP 8, with
 * the `my-registration` hook point (E54) — and a `bundleUrl` without a bundle
 * would be a load error the module administration reports to an organizer as a
 * broken plug-in (F47). The same order the forum shipped in.
 */
export const qrCheckinPlugin: ServerPlugin = {
  key: QR_CHECKIN_PLUGIN_KEY,
  version: '0.1.0',
  // The host's own version rather than a number of its own: this plug-in
  // resolves a self-service claim and reads an event's registrations, both of
  // which are 1.2.0.
  apiVersion: PLUGIN_API_VERSION,
  titleKey: 'plugins.qrCheckin.title',
  module: QrCheckinModule,
  persistence: {
    entities: [TicketEntity],
    // Stamped after the core migrations that create `registration` and
    // `admin_user`: both streams are ordered together by timestamp, and a
    // reference cannot precede the table it points at.
    migrations: [CreateQrCheckinSchema1787900000000],
  },
  // Off by default like every curated plug-in: an instance offers what the
  // organization asked for (NFR 1). A door with a scanner at it is a decision
  // about how an event is run, not a default.
  enabledByDefault: false,
};
