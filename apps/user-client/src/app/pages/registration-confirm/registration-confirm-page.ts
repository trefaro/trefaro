import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import type { RegistrationConfirmation } from '@trefaro/shared-models';
import { RegistrationsService } from '../../features/registrations/registration.service';

/**
 * The page the confirmation mail links to (E5b).
 *
 * It does not confirm anything on its own: a button does, by POST. Two reasons
 * to spend a click on this. A mail scanner or a link previewer that fetches
 * every URL in a message would otherwise confirm registrations nobody agreed to
 * — and the participant would never see that anything happened, because a
 * redirect is not an answer.
 */
@Component({
  selector: 'trefaro-registration-confirm-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section>
      @if (result(); as done) {
        <h1>
          {{
            (done.state === 'confirmed'
              ? 'confirm.done'
              : 'confirm.alreadyDone'
            ) | transloco
          }}
        </h1>
        <!-- The event's name is inside the sentence rather than beside it; see
             the registration page for why. -->
        <p>
          {{ 'confirm.registeredFor' | transloco: { event: done.eventName } }}
        </p>
        <p>
          <a
            [routerLink]="[
              '/series',
              done.seriesSlug,
              'events',
              done.eventSlug,
            ]"
          >
            {{ 'confirm.backToEvent' | transloco }}
          </a>
        </p>
      } @else if (!tokenValue()) {
        <h1>{{ 'confirm.title' | transloco }}</h1>
        <p class="notice" role="alert">
          {{ 'confirm.noToken' | transloco }}
        </p>
      } @else {
        <h1>{{ 'confirm.title' | transloco }}</h1>
        @if (error(); as problem) {
          <p class="notice" role="alert">
            {{ problem.key | transloco }}
            @if (problem.detail; as detail) {
              <span class="notice__detail">{{ detail }}</span>
            }
          </p>
        } @else {
          <p>{{ 'confirm.lead' | transloco }}</p>
        }
        <button type="button" [disabled]="busy()" (click)="confirm()">
          {{ (busy() ? 'confirm.working' : 'confirm.submit') | transloco }}
        </button>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 34rem;
    }

    button {
      padding: 0.7rem 1.3rem;
      border: 0;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
    }

    button:disabled {
      opacity: 0.55;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class RegistrationConfirmPage {
  /**
   * From the link's query string, bound by `withComponentInputBinding()`.
   *
   * Empty when someone opened the page without a token — a mail client that
   * broke the link across two lines is the usual reason, so the page says which
   * part is missing rather than reporting a failure.
   */
  readonly token = input<string>();

  /**
   * The token as a string, present or not.
   *
   * The router binds a query parameter that is not in the URL as `undefined`,
   * which overrides an `input()` default — so the default would look like a
   * guarantee it is not.
   */
  protected readonly tokenValue = computed(() => this.token() ?? '');

  private readonly registrations = inject(RegistrationsService);

  protected readonly result = signal<RegistrationConfirmation | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      this.result.set(await this.registrations.confirm(this.tokenValue()));
    } catch (error: unknown) {
      // The server's reason is worth keeping (F77): "this link has expired" is
      // the difference between trying again and asking for a new mail.
      this.error.set(problemOf(error, 'confirm.error'));
    } finally {
      this.busy.set(false);
    }
  }
}
