import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PushSubscriptionService } from './push-subscription.service';

/**
 * Explains notifications, and only then asks the browser (FR 3.15, NFR 4).
 *
 * The one thing this component exists for is the order. A bare button that
 * fires `Notification.requestPermission()` puts a system dialogue in front of
 * somebody who has been told nothing: the browser's wording is the browser's,
 * it names a domain rather than an organization, and it says nothing about
 * what would be sent. NFR 4 aims at people with rudimentary IT skills, and for
 * them that dialogue is a question with no context and one irreversible wrong
 * answer — a refusal cannot be asked again from here.
 *
 * So the offer says what will be sent, says that the browser will ask next,
 * and says it can be withdrawn. Only the button triggers the dialogue.
 *
 * Shown in the shell rather than on a page, beside the installation hint and
 * for the same reason: being notifiable is a fact about this client, not about
 * the screen somebody is on — and both audiences E43 names have to reach it.
 * Somebody with an account will find the same switch on their profile; a
 * browser without one has only this.
 *
 * It appears only where it can be followed: no service worker, no VAPID key,
 * an already refused permission or a "not now" all mean nothing is rendered
 * (see {@link PushSubscriptionService.offering}).
 */
@Component({
  selector: 'trefaro-notification-offer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    @if (push.offering()) {
      <aside class="offer">
        <div class="offer__text">
          <strong>{{ 'push.offer.title' | transloco }}</strong>
          <span class="offer__body">{{ 'push.offer.body' | transloco }}</span>
        </div>
        <div class="offer__actions">
          <button type="button" class="offer__accept" (click)="allow()">
            {{ 'push.offer.allow' | transloco }}
          </button>
          <button type="button" class="offer__dismiss" (click)="push.dismiss()">
            {{ 'push.offer.later' | transloco }}
          </button>
        </div>
      </aside>
    }
  `,
  styles: `
    .offer {
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

    .offer__text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .offer__body {
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    .offer__actions {
      display: flex;
      gap: 0.5rem;
    }

    .offer__accept {
      padding: 0.45rem 0.9rem;
      border: none;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      cursor: pointer;
    }

    .offer__dismiss {
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
export class NotificationOffer {
  protected readonly push = inject(PushSubscriptionService);

  protected allow(): void {
    void this.push.subscribe();
  }
}
