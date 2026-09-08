import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PluginMountPoint } from '@trefaro/shared-models';
import { OrganizerRooms } from './organizer-rooms';
import { ParticipantRooms } from './participant-rooms';

/**
 * The room planning plug-in as a web component (FR 3.11, FR 3.6).
 *
 * Exported through Angular Elements as `<trefaro-plugin-room-planning>` and
 * mounted by the clients' plug-in manager at two hook points. **This component
 * is only the switch**: which of the two halves is drawn depends on
 * `mountPoint`, and everything else lives in the two components below it —
 * the plan a participant reads at `event-detail`, the editor at
 * `event-dashboard`.
 *
 * From phase 0 until AP 6 of phase 4 this element was the demonstration of
 * the mechanism: the context the host handed over and a counter that proved
 * change detection inside a custom element. Both things it proved are now
 * proved by the sections themselves.
 *
 * `mountPoint` is handed over by the slot, never guessed (plug-in API 1.2.0,
 * F202). Its styling uses only the `--trefaro-*` custom properties the host
 * document defines, never a colour or font of its own — the properties inherit
 * across the shadow DOM boundary, which is what lets the architecture require
 * plug-ins to bring no design with them.
 */
@Component({
  selector: 'trefaro-room-planning-plugin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrganizerRooms, ParticipantRooms],
  template: `
    @if (mountPoint() === 'event-dashboard') {
      <trefaro-organizer-rooms
        [eventId]="eventId()"
        [locale]="locale()"
        [strings]="strings()"
      />
    } @else {
      <trefaro-participant-rooms
        [eventId]="eventId()"
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
export class RoomPlanningPlugin {
  /**
   * The event this hook point is about, as an element property.
   *
   * Angular Elements exposes an input as a DOM property, so a client written
   * without Angular sets `element.eventId = '…'` just the same.
   */
  readonly eventId = input<string | null>(null);

  /** Active locale, so the plug-in follows the instance's language (E48). */
  readonly locale = input<string>('en');

  /**
   * This plug-in's words, keyed without the `plugins.roomPlanning.` prefix.
   *
   * Reassigned by the host on a language switch rather than the element being
   * replaced, so an open room form survives one — which is the point of
   * handing words over instead of finished text.
   */
  readonly strings = input<Readonly<Record<string, string>>>({});

  /**
   * Which hook point is drawing this element (plug-in API 1.2.0).
   *
   * Defaults to the participant's plan: a host that predates 1.2.0 assigns
   * nothing, and of the two halves that is the one a public event page would
   * have wanted. The editor is behind an administrative session either way.
   */
  readonly mountPoint = input<PluginMountPoint>('event-detail');
}
