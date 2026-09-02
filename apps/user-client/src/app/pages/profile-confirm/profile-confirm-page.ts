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
import type { ProfileConfirmation } from '@trefaro/shared-models';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';

/**
 * The page the account confirmation mail links to (FR 4.1, E5b).
 *
 * It confirms nothing on its own: a button does, by POST. The same two reasons
 * as for a registration confirmation — a mail scanner that fetches every URL in
 * a message would otherwise confirm addresses nobody agreed to, and a redirect
 * is not an answer somebody can read.
 *
 * A second click reports what is already true rather than failing: people click
 * links twice, and forward them to themselves.
 */
@Component({
  selector: 'trefaro-profile-confirm-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section>
      @if (result(); as done) {
        <h1>
          {{
            (done.state === 'confirmed'
              ? 'profile.confirm.done'
              : 'profile.confirm.alreadyDone'
            ) | transloco
          }}
        </h1>
        <!-- The name inside the sentence rather than beside it (F79). -->
        <p>
          {{ 'profile.confirm.greeting' | transloco: { name: done.firstName } }}
        </p>
        <p>
          <a routerLink="/profile/login">
            {{ 'profile.login.title' | transloco }}
          </a>
        </p>
      } @else if (!tokenValue()) {
        <h1>{{ 'profile.confirm.title' | transloco }}</h1>
        <p class="notice" role="alert">
          {{ 'profile.confirm.noToken' | transloco }}
        </p>
      } @else {
        <h1>{{ 'profile.confirm.title' | transloco }}</h1>
        @if (error(); as problem) {
          <p class="notice" role="alert">
            {{ problem.key | transloco }}
            @if (problem.detail; as detail) {
              <span class="notice__detail">{{ detail }}</span>
            }
          </p>
        } @else {
          <p>{{ 'profile.confirm.lead' | transloco }}</p>
        }
        <button type="button" [disabled]="busy()" (click)="confirm()">
          {{
            (busy() ? 'profile.confirm.working' : 'profile.confirm.title')
              | transloco
          }}
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
export class ProfileConfirmPage {
  /**
   * From the link's query string, bound by `withComponentInputBinding()`.
   *
   * Empty when somebody opened the page without a token — a mail client that
   * broke the link across two lines is the usual reason, so the page says which
   * part is missing rather than reporting a failure.
   */
  readonly token = input<string>();

  /**
   * The token as a string, present or not.
   *
   * The router binds an absent query parameter as `undefined`, which overrides
   * an `input()` default — so a default here would look like a guarantee it is
   * not.
   */
  protected readonly tokenValue = computed(() => this.token() ?? '');

  private readonly session = inject(ParticipantSessionService);

  protected readonly result = signal<ProfileConfirmation | null>(null);
  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      this.result.set(await this.session.confirm(this.tokenValue()));
    } catch (error: unknown) {
      // The server's reason is worth keeping (F77): "this link has expired" is
      // the difference between trying again and registering once more.
      this.error.set(problemOf(error, 'profile.confirm.error'));
    } finally {
      this.busy.set(false);
    }
  }
}
