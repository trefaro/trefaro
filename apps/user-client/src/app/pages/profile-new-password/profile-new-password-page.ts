import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@trefaro/shared-models';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';

/**
 * The page the reset link points at (AP 4 of phase 5, E5b).
 *
 * The link carries a token and nothing happens when it is opened: the password
 * is set by a form, by POST. The same argument as every other mailed link in
 * this application, and here it is at its sharpest — a mail scanner that
 * fetched the address must not be able to spend the one token that hands an
 * account over.
 *
 * No session is issued afterwards, on purpose: the link proved an address, and
 * logging in proves the person knows the password they just chose. So the page
 * ends by pointing at the login form, where every other device has been signed
 * out by then (F139).
 */
@Component({
  selector: 'trefaro-profile-new-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    @if (done()) {
      <section class="done">
        <h1>{{ 'profile.newPassword.done.title' | transloco }}</h1>
        <p>{{ 'profile.newPassword.done.lead' | transloco }}</p>
        <p>
          <a routerLink="/profile/login">
            {{ 'profile.login.title' | transloco }}
          </a>
        </p>
      </section>
    } @else if (!tokenValue()) {
      <h1>{{ 'profile.newPassword.title' | transloco }}</h1>
      <p class="notice" role="alert">
        {{ 'profile.newPassword.noToken' | transloco }}
      </p>
      <p>
        <a routerLink="/profile/forgot-password">
          {{ 'profile.forgot.title' | transloco }}
        </a>
      </p>
    } @else {
      <h1>{{ 'profile.newPassword.title' | transloco }}</h1>
      <p class="lead">{{ 'profile.newPassword.lead' | transloco }}</p>

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
            <span>{{ 'profile.newPassword.field' | transloco }}</span>
            <input
              formControlName="password"
              type="password"
              autocomplete="new-password"
              [attr.minlength]="minPasswordLength"
              [attr.maxlength]="maxPasswordLength"
            />
          </label>
          <small class="hint">
            {{
              'profile.passwordPolicy'
                | transloco: { minimum: minPasswordLength }
            }}
          </small>
          <button type="submit">
            {{
              (busy()
                ? 'profile.newPassword.working'
                : 'profile.newPassword.submit'
              ) | transloco
            }}
          </button>
        </fieldset>
      </form>
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
      margin-block-start: -0.5rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .done h1 {
      margin-block-end: 0.5rem;
    }
  `,
})
export class ProfileNewPasswordPage {
  /**
   * From the link's query string, bound by `withComponentInputBinding()`.
   *
   * Absent when a mail client broke the link across two lines, which is common
   * enough to deserve its own sentence rather than a failed request.
   */
  readonly token = input<string>();

  /** An absent query parameter arrives as `undefined`, overriding a default. */
  protected readonly tokenValue = computed(() => this.token() ?? '');

  private readonly session = inject(ParticipantSessionService);

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly maxPasswordLength = MAX_PASSWORD_LENGTH;

  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(MIN_PASSWORD_LENGTH),
        Validators.maxLength(MAX_PASSWORD_LENGTH),
      ],
    ],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    try {
      await this.session.setNewPassword(
        this.tokenValue(),
        this.form.getRawValue().password,
      );
      this.done.set(true);
    } catch (error: unknown) {
      // The server's reason stays beside this client's sentence (F77) — and it
      // is one sentence for every way a link can fail, because asking for a new
      // one is the answer to all of them.
      this.error.set(problemOf(error, 'profile.newPassword.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
