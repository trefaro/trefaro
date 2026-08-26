import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { ApiError } from '@trefaro/shared-http';
import { AuthService } from '../../features/auth/auth.service';

/**
 * Administrative login (UC 01, FR 1.3).
 *
 * One message for every kind of rejection, because the server deliberately does
 * not distinguish an unknown address from a wrong password — telling them apart
 * would turn this form into a way of finding out who works for the organization.
 */
@Component({
  selector: 'trefaro-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login">
      <form class="card" [formGroup]="form" (ngSubmit)="submit()">
        <h1>Sign in</h1>
        <p class="hint">Administration of this Trefaro instance.</p>

        <label for="email">E-mail address</label>
        <input
          id="email"
          type="email"
          formControlName="email"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          required
        />

        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          formControlName="password"
          autocomplete="current-password"
          required
        />

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button type="submit" [disabled]="busy()">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .login {
      display: grid;
      place-items: center;
      min-block-size: 100vh;
      padding: 1.5rem;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      inline-size: min(24rem, 100%);
      padding: 1.75rem;
      border-radius: 0.75rem;
      background: var(--trefaro-color-surface, #fff);
      box-shadow: 0 1px 3px rgb(0 0 0 / 18%);
    }

    h1 {
      margin: 0;
    }

    .hint {
      margin: 0 0 0.75rem;
      color: color-mix(in oklab, currentColor 60%, transparent);
    }

    label {
      font-weight: 600;
      margin-block-start: 0.5rem;
    }

    input {
      padding: 0.55rem 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    button {
      margin-block-start: 1.25rem;
      padding: 0.6rem 0.8rem;
      border: 0;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    button[disabled] {
      cursor: progress;
      opacity: 0.7;
    }

    .error {
      margin: 0.75rem 0 0;
      color: #a3341f;
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);

      const returnTo = new URLSearchParams(window.location.search).get(
        'returnTo',
      );
      // Only relative paths: a returnTo pointing at another origin would turn
      // the login into an open redirect.
      await this.router.navigateByUrl(
        returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : '/',
      );
    } catch (error: unknown) {
      this.error.set(messageFor(error as ApiError));
    } finally {
      this.busy.set(false);
    }
  }
}

function messageFor(error: ApiError): string {
  if (error?.status === 429) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  if (error?.status === 401) {
    return 'Wrong e-mail address or password.';
  }
  return error?.message ?? 'Signing in failed.';
}
