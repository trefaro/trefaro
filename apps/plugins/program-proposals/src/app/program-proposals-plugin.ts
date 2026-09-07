import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PluginMountPoint } from '@trefaro/shared-models';
import { OrganizerProposals } from './organizer-proposals';
import { ParticipantProposals } from './participant-proposals';

/**
 * The programme proposals plug-in as a web component (FR 3.13, FR 3.14).
 *
 * Exported through Angular Elements as
 * `<trefaro-plugin-program-proposals>` and mounted by the clients' plug-in
 * manager at two hook points. **This component is only the switch**: which of
 * the two halves is drawn depends on `mountPoint`, and everything else lives in
 * the two components below it.
 *
 * One element for two audiences, because the contract gives a plug-in one
 * `elementName` and one `bundleUrl` — and that is the right shape: the two
 * screens are two views of one thing, they share the models and the API
 * service, and an organization switches *the plug-in* on, not one of its
 * halves.
 *
 * `mountPoint` is handed over by the slot, never guessed (plug-in API 1.2.0).
 * A bundle that read the address in the browser's bar to tell the participant
 * client from the organizer client would make the two clients' deployment part
 * of a plug-in's contract; asking which of its own calls answers 401 would be
 * worse, since that is also what an expired session looks like.
 *
 * Its styling uses only the `--trefaro-*` custom properties the host document
 * defines, never a colour or font of its own — the properties inherit across
 * the shadow DOM boundary, which is what lets the architecture require plug-ins
 * to bring no design with them. Layout is the plug-in's own business; the
 * *theme* is what must not be hard-coded.
 */
@Component({
  selector: 'trefaro-program-proposals-plugin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrganizerProposals, ParticipantProposals],
  template: `
    @if (mountPoint() === 'event-dashboard') {
      <trefaro-organizer-proposals
        [eventId]="eventId()"
        [locale]="locale()"
        [strings]="strings()"
      />
    } @else {
      <trefaro-participant-proposals
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
export class ProgramProposalsPlugin {
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
   * This plug-in's words, keyed without the `plugins.programProposals.` prefix.
   *
   * Reassigned by the host on a language switch rather than the element being
   * replaced, so a half-written proposal survives one — which is the point of
   * handing words over instead of finished text.
   */
  readonly strings = input<Readonly<Record<string, string>>>({});

  /**
   * Which hook point is drawing this element (plug-in API 1.2.0).
   *
   * Defaults to the participant's view: a host that predates 1.2.0 assigns
   * nothing, and of the two halves that is the one a public event page would
   * have wanted. The organizer's section is behind an administrative session
   * either way, so guessing wrong in that direction shows a login problem
   * rather than somebody else's queue.
   */
  readonly mountPoint = input<PluginMountPoint>('event-detail');
}
