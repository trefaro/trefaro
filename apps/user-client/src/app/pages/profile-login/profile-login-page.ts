import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';

/**
 * The participant login (FR 4.2, UC 09).
 *
 * Two answers get their own sentence, and the difference matters:
 *
 * - **401** is "wrong address or password", the same answer for both, because
 *   anything else would turn this form into a way of finding out who has an
 *   account on an instance that runs political events (E32).
 * - **403** is "confirm your address first". Somebody who can produce the right
 *   password already knows the account exists, and telling them nothing would
 *   leave them stuck with a mail they perhaps deleted — so this page offers to
 *   send the link again by pointing back at the registration form, which is
 *   idempotent by design.
 */
@Component({
  selector: 'trefaro-profile-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    <h1>{{ 'profile.login.title' | transloco }}</h1>

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
        <label>
          <span>{{ 'profile.password' | transloco }}</span>
          <input
            formControlName="password"
            type="password"
            autocomplete="current-password"
          />
        </label>
        <button type="submit">
          {{
            (busy() ? 'profile.login.working' : 'profile.login.title')
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
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 26rem;
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

    .alternative {
      margin-block-start: 1.5rem;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class ProfileLoginPage {
  /**
   * Where the guard was heading when it sent somebody here.
   *
   * Bound from the query string by `withComponentInputBinding()`; absent when
   * the login was reached on purpose rather than by being turned away.
   */
  readonly returnTo = input<string>();

  private readonly session = inject(ParticipantSessionService);
  private readonly router = inject(Router);

  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    // Required and nothing else: a password that is too short for the
    // policy is simply a wrong password here, and printing the policy on a
    // login form tells a stranger what it is without helping anybody who
    // already has an account.
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    try {
      await this.session.logIn(email, password);
      // `navigateByUrl` rather than a segment array: what the guard remembered
      // is a URL, and taking it apart here would only be able to lose a query.
      await this.router.navigateByUrl(this.returnTo() ?? '/profile');
    } catch (error: unknown) {
      this.error.set(problemFor(error as ApiError));
    } finally {
      this.busy.set(false);
    }
  }
}

/**
 * The three refusals this form can explain itself, none of them carrying the
 * server's text (F77).
 *
 * 401 says nothing about which half was wrong, on purpose (E32). 403 is the one
 * refusal with a way forward — the address exists and is not confirmed — and the
 * sentence points at the mail and at the registration form, which sends the link
 * again. 429 would otherwise arrive as an English sentence about a rate limit on
 * a German form.
 */
function problemFor(error: ApiError): Problem {
  if (error?.status === 429) {
    return { key: 'profile.login.errorThrottled', detail: null };
  }
  if (error?.status === 403) {
    return { key: 'profile.login.errorUnconfirmed', detail: null };
  }
  if (error?.status === 401) {
    return { key: 'profile.login.errorCredentials', detail: null };
  }
  return problemOf(error, 'profile.login.failed');
}
