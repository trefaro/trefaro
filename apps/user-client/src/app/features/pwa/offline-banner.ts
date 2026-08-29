import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConnectivityService } from './connectivity.service';

/**
 * Says so when there is no network (F20, F110, NFR 10).
 *
 * The whole of "an offline state instead of a white page": the service worker
 * hands the shell back, this explains why nothing in it loads, and the pages
 * keep their own error notices for requests that fail for other reasons.
 *
 * `role="status"` rather than `alert`: losing a connection is worth announcing
 * once, politely, and not worth interrupting whatever a screen reader was
 * reading.
 */
@Component({
  selector: 'trefaro-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    @if (!connectivity.online()) {
      <div class="offline" role="status">
        <strong class="offline__title">{{
          'app.offline.title' | transloco
        }}</strong>
        <span class="offline__body">{{ 'app.offline.body' | transloco }}</span>
      </div>
    }
  `,
  styles: `
    .offline {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.6rem 1rem;
      /* Not the brand colour: this is the one message on the page that is about
         the device rather than about the organization. */
      background: #3a3a3a;
      color: #ffffff;
      font-size: 0.9rem;
    }

    .offline__body {
      color: color-mix(in oklab, currentColor 80%, transparent);
    }
  `,
})
export class OfflineBanner {
  protected readonly connectivity = inject(ConnectivityService);
}
