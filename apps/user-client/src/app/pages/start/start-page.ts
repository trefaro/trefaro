import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';

/**
 * Start page of the participant client — the event series overview (FR 2.3).
 *
 * Reachable without a login, deliberately: the thesis asks for a low entry
 * barrier, so anyone can see what an organization is running before deciding to
 * register.
 *
 * Phase 1 fills this with the actual series; phase 0 only proves that the page
 * renders with the configured theme applied.
 */
@Component({
  selector: 'trefaro-start-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>Event series</h1>

    @if (config.config()) {
      <p class="lead">
        This instance is configured and reachable. Event series appear here once
        an organizer has created them.
      </p>
    } @else {
      <p class="lead">
        The server could not be reached, so this page is showing its fallback
        theme. Event series will appear once the connection is back.
      </p>
    }

    <p><a routerLink="/spikes">Architecture spike console</a></p>
  `,
  styles: `
    .lead {
      color: var(--trefaro-color-primary-strong);
      max-inline-size: 40rem;
    }
  `,
})
export class StartPage {
  protected readonly config = inject(AppConfigService);
}
