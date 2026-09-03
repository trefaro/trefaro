import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PushSubscriptionService } from './push-subscription.service';

/**
 * Where notifications can be switched on and off again (FR 3.15).
 *
 * The offer in the shell can only ever say yes; this is the place that says
 * both, and it is on the profile because that is the page that belongs to a
 * person. It also answers the question the offer has to stay silent about:
 * *why* there is nothing to switch. A browser that cannot do notifications and
 * an iPhone that could if the app were on the home screen look identical from
 * outside, and the second one is the case F7 depends on — so it gets a
 * sentence rather than an absence.
 *
 * What is deliberately **not** here is anything for a device without an
 * account: there is no page that is theirs, and a browser can withdraw the
 * permission in its own site settings. Recorded in `todo.md` as the named
 * limit it is.
 *
 * Nothing is rendered when the instance does not do push at all
 * (`not-configured` — no VAPID key, or the module switched off): an off switch
 * for something that cannot happen is worse than silence.
 */
@Component({
  selector: 'trefaro-notification-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    @if (push.state() !== 'not-configured') {
      <section
        class="push"
        [attr.aria-label]="'push.settings.title' | transloco"
      >
        <h2>{{ 'push.settings.title' | transloco }}</h2>
        <p class="push__lead">{{ 'push.settings.lead' | transloco }}</p>

        @switch (push.state()) {
          @case ('unsupported') {
            <p class="push__state">{{ 'push.unsupported' | transloco }}</p>
            <p class="push__hint">{{ 'push.installFirst' | transloco }}</p>
          }
          @case ('denied') {
            <p class="push__state">{{ 'push.blocked' | transloco }}</p>
          }
          @case ('subscribed') {
            <p class="push__state" role="status">
              {{ 'push.settings.on' | transloco }}
            </p>
            <button type="button" (click)="turnOff()">
              {{ 'push.settings.disable' | transloco }}
            </button>
          }
          @default {
            <p class="push__state">{{ 'push.settings.off' | transloco }}</p>
            <button
              type="button"
              [disabled]="push.state() === 'subscribing'"
              (click)="turnOn()"
            >
              {{
                (push.state() === 'subscribing'
                  ? 'push.settings.working'
                  : 'push.settings.enable'
                ) | transloco
              }}
            </button>
          }
        }

        @if (push.error(); as reason) {
          <p class="push__error" role="alert">
            {{ 'push.failed' | transloco: { reason } }}
          </p>
        }
      </section>
    }
  `,
  styles: `
    .push {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
      margin-block-end: 2rem;
    }

    h2 {
      margin: 0;
      font-size: 1.1rem;
    }

    .push__lead,
    .push__hint {
      margin: 0;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .push__state {
      margin: 0;
    }

    .push__error {
      margin: 0;
      font-size: 0.9rem;
      color: var(--trefaro-color-primary-strong);
    }

    button {
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
export class NotificationSettings {
  protected readonly push = inject(PushSubscriptionService);

  protected turnOn(): void {
    void this.push.subscribe();
  }

  protected turnOff(): void {
    void this.push.unsubscribe();
  }
}
