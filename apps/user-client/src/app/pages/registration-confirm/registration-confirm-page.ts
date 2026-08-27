import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ApiError } from '@trefaro/shared-http';
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
  imports: [RouterLink],
  template: `
    <section>
      @if (result(); as done) {
        <h1>
          {{
            done.state === 'confirmed'
              ? 'Your registration is confirmed'
              : 'This registration was already confirmed'
          }}
        </h1>
        <p>
          You are registered for <strong>{{ done.eventName }}</strong
          >.
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
            Back to the event
          </a>
        </p>
      } @else if (!tokenValue()) {
        <h1>Confirm your registration</h1>
        <p class="notice" role="alert">
          This address is missing its confirmation token. Please open the link
          from the mail again — the whole link, including everything after the
          question mark.
        </p>
      } @else {
        <h1>Confirm your registration</h1>
        @if (error()) {
          <p class="notice" role="alert">{{ error() }}</p>
        } @else {
          <p>One click to go: confirm that this address is yours.</p>
        }
        <button type="button" [disabled]="busy()" (click)="confirm()">
          {{ busy() ? 'Confirming…' : 'Confirm my registration' }}
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
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      this.result.set(await this.registrations.confirm(this.tokenValue()));
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.message ??
          'The confirmation could not be completed. Please try again.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
