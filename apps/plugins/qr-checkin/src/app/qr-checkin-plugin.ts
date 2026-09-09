import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PluginMountPoint } from '@trefaro/shared-models';
import { OrganizerDoor } from './organizer-door';
import { ParticipantTicket } from './participant-ticket';

/**
 * The QR check-in plug-in as a web component (FR 3.16).
 *
 * Exported through Angular Elements as `<trefaro-plugin-qr-checkin>` and
 * mounted at two hook points. **This component is only the switch**: which half
 * is drawn depends on `mountPoint`, and everything else lives below it — the
 * ticket a participant shows at `my-registration`, the door an organizer holds
 * at `event-dashboard`.
 *
 * The two halves are further apart than any other plug-in's. The others draw a
 * reader's view and an organizer's view of one thing; here one half is a code
 * on a phone in somebody's hand and the other is the screen it is held up to.
 * They share the bundle, the words and the models — and nothing else.
 *
 * `mountPoint` is handed over by the slot, never guessed (plug-in API 1.2.0,
 * F202). **The default is the ticket**, unlike every other bundle: a host that
 * names no hook point is one that predates 1.2.0, and of these two halves the
 * one that must never be drawn by accident is the door — an admission list on a
 * page nobody authenticated for would be the failure this plug-in exists to
 * prevent. The routes refuse it anyway (E57); the default agrees with them.
 */
@Component({
  selector: 'trefaro-qr-checkin-plugin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrganizerDoor, ParticipantTicket],
  template: `
    @if (mountPoint() === 'event-dashboard') {
      <trefaro-organizer-door
        [eventId]="eventId()"
        [locale]="locale()"
        [strings]="strings()"
      />
    } @else {
      <trefaro-participant-ticket
        [token]="token()"
        [registrationId]="registrationId()"
        [locale]="locale()"
        [strings]="strings()"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class QrCheckinPlugin {
  /**
   * The event of the dashboard hook point, as an element property.
   *
   * Angular Elements exposes an input as a DOM property, so a client written
   * without Angular sets `element.eventId = '…'` just the same.
   */
  readonly eventId = input<string | null>(null);

  /**
   * The signed self-service token, when the reader followed the link in their
   * receipt (E11).
   *
   * Handed over by the hook point rather than read out of the address bar, for
   * the reason `mountPoint` is handed over: what a bundle knows about a page
   * comes from the host, or the deployment of two clients becomes part of a
   * plug-in's contract (F202).
   */
  readonly token = input<string | null>(null);

  /** The registration on the page, when a session is what opened it (F148). */
  readonly registrationId = input<string | null>(null);

  /** Active locale, so the plug-in follows the instance's language (E48). */
  readonly locale = input<string>('en');

  /**
   * This plug-in's words, keyed without the `plugins.qrCheckin.` prefix.
   *
   * Reassigned by the host on a language switch rather than the element being
   * replaced, so a half-typed code at the door survives one.
   */
  readonly strings = input<Readonly<Record<string, string>>>({});

  /** Which hook point is drawing this element (plug-in API 1.2.0, F202). */
  readonly mountPoint = input<PluginMountPoint>('my-registration');
}
