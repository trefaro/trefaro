import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';

/**
 * "I have forgotten my password" (AP 4 of phase 5, FR 4.3's missing half).
 *
 * The one dead end a participant could walk into: the password change inside
 * the profile needs the old password, so somebody who has forgotten it had
 * nowhere to go. This form is the way back, and it is built around a rule that
 * shapes every sentence on it — it must not say whether an address has an
 * account here (E10, E32).
 *
 * So it promises exactly what it can keep: a message is on its way to the
 * address that was typed. Which message it is — a link, a confirmation the
 * account still needs, or "there is no account for this address" — only its
 * inbox learns. That every one of the three is a letter is also why the answer
 * takes the same time in all three cases.
 */
@Component({
  selector: 'trefaro-profile-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    @if (sentTo(); as address) {
      <section class="done">
        <h1>{{ 'profile.forgot.done.title' | transloco }}</h1>
        <!-- One key for the whole sentence, with the address inside it (F79). -->
        <p>{{ 'profile.forgot.done.sentTo' | transloco: { address } }}</p>
        <p class="hint">{{ 'profile.forgot.done.noMail' | transloco }}</p>
        <p>
          <a routerLink="/profile/login">
            {{ 'profile.login.title' | transloco }}
          </a>
        </p>
      </section>
    } @else {
      <h1>{{ 'profile.forgot.title' | transloco }}</h1>
      <p class="lead">{{ 'profile.forgot.lead' | transloco }}</p>

      @if (error(); as problem) {
        <p class="notice" role="alert">
          {{ problem.key | transloco }}
          @if (problem.detail; as detail) {
            <span class="notice__detail">{{ detail }}</span>
          }
        </p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <fieldset [disabled]="busy()">
          <label>
            <span>{{ 'profile.email' | transloco }}</span>
            <input
              formControlName="email"
              type="email"
              inputmode="email"
              autocomplete="email"
            />
          </label>
          <button type="submit">
            {{
              (busy() ? 'profile.forgot.working' : 'profile.forgot.submit')
                | transloco
            }}
          </button>
        </fieldset>
      </form>

      <p class="alternative">
        {{ 'profile.login.noAccount' | transloco }}
        <a routerLink="/profile/register">
          {{ 'profile.register.title' | transloco }}
        </a>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 26rem;
    }

    .lead {
      margin-block-end: 1.5rem;
    }

    fieldset {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    label > span {
      font-weight: 600;
    }

    input {
      padding: 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    button {
      align-self: start;
      padding: 0.7rem 1.3rem;
      border: 0;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
    }

    fieldset:disabled button {
      opacity: 0.55;
    }

    .hint {
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .alternative {
      margin-block-start: 1.5rem;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .done h1 {
      margin-block-end: 0.5rem;
    }
  `,
})
export class ProfileForgotPasswordPage {
  private readonly session = inject(ParticipantSessionService);

  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  /** Set once the form went through: the address that was written to. */
  protected readonly sentTo = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    try {
      const answer = await this.session.requestPasswordReset(
        this.form.getRawValue().email,
      );
      this.sentTo.set(answer.email);
    } catch (error: unknown) {
      this.error.set(problemFor(error as ApiError));
    } finally {
      this.busy.set(false);
    }
  }
}

/**
 * The refusals this form can explain itself (F77).
 *
 * 429 is the only one worth its own sentence: it is the answer somebody gets
 * for asking twice in a row, and the server's English line about a rate limit
 * would otherwise land on a German form. Everything else keeps the server's
 * reason beside this client's — "no mail could be sent" is the difference
 * between trying again and telling somebody at the organization.
 */
function problemFor(error: ApiError): Problem {
  if (error?.status === 429) {
    return { key: 'profile.forgot.errorThrottled', detail: null };
  }
  return problemOf(error, 'profile.forgot.failed');
}
