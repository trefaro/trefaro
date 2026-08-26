import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';

/**
 * Organizer start page — the list of all event series (FR 2.2).
 *
 * Phase 1 fills this with the series and the "new event series" action; phase 0
 * proves the shell renders with the instance's configuration applied.
 */
@Component({
  selector: 'trefaro-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Event series</h1>
    @if (config.config()) {
      <p>
        Connected to the server. Creating and managing event series arrives with
        phase 1.
      </p>
    } @else {
      <p class="warn">
        The server could not be reached; this page is showing its fallback
        theme.
      </p>
    }
  `,
  styles: `
    .warn {
      color: #a3341f;
    }
  `,
})
export class DashboardPage {
  protected readonly config = inject(AppConfigService);
}
