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
 * **Two hook points, two audiences.** The ticket page draws at
 * `my-registration` — the hook point this plug-in brought with it, because a
 * core mail may carry no plug-in content, so the receipt links the
 * self-service page and the code is rendered there (E54, F198) — and the door
 * draws at `event-dashboard`, beside the three sections of AP 3 to AP 6. One
 * bundle, told apart by the `mountPoint` the slot hands over (F202).
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
  client: {
    elementName: 'trefaro-plugin-qr-checkin',
    bundleUrl: '/api/plugins/qr-checkin/main.js',
    // The one plug-in of the five that draws nothing on the public event page:
    // a ticket belongs to one registration, and the admission list belongs to
    // whoever is holding the door. `my-registration` is the participant's
    // self-service page (E54), `event-dashboard` the organizer's event (E59).
    mountPoints: ['my-registration', 'event-dashboard'],
    labelKey: 'plugins.qrCheckin.label',
    icon: 'qr_code_2',
  },
  // Off by default like every curated plug-in: an instance offers what the
  // organization asked for (NFR 1). A door with a scanner at it is a decision
  // about how an event is run, not a default.
  enabledByDefault: false,
};
