import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { InstallPromptService } from './install-prompt.service';

/**
 * Offers to put this client on the home screen (F20).
 *
 * Shown only while the browser has actually offered an installation — see
 * {@link InstallPromptService} for why a hint that cannot be followed is not
 * shown at all.
 *
 * Below the content rather than above it: somebody who arrived through a link to
 * an event came for the event, and an installation offer between them and it is
 * the pattern this application exists to avoid.
 */
@Component({
  selector: 'trefaro-install-hint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    @if (install.available()) {
      <aside class="install">
        <div class="install__text">
          <strong>{{ 'app.install.title' | transloco }}</strong>
          <span class="install__body">{{
            'app.install.body' | transloco
          }}</span>
        </div>
        <div class="install__actions">
          <button type="button" class="install__accept" (click)="accept()">
            {{ 'app.install.action' | transloco }}
          </button>
          <button
            type="button"
            class="install__dismiss"
            (click)="install.dismiss()"
          >
            {{ 'app.install.dismiss' | transloco }}
          </button>
        </div>
      </aside>
    }
  `,
  styles: `
    .install {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin: 1rem;
      padding: 0.8rem 1rem;
      border: 1px solid
        color-mix(in oklab, var(--trefaro-color-primary) 35%, transparent);
      border-radius: 0.5rem;
      background: var(--trefaro-color-primary-muted);
    }

    .install__text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .install__body {
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    .install__actions {
      display: flex;
      gap: 0.5rem;
    }

    .install__accept {
      padding: 0.45rem 0.9rem;
      border: none;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      cursor: pointer;
    }

    .install__dismiss {
      padding: 0.45rem 0.9rem;
      border: 1px solid currentColor;
      border-radius: 0.4rem;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
  `,
})
export class InstallHint {
  protected readonly install = inject(InstallPromptService);

  protected accept(): void {
    void this.install.install();
  }
}
