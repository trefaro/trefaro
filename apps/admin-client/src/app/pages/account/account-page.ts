import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@trefaro/shared-models';
import { AuthService } from '../../features/auth/auth.service';

/**
 * The organizer's own account (AP 9 of phase 5, FR 1.2).
 *
 * One thing on it, and it is the finding the security review of AP 9 opened
 * the package with: until here an organizer's password was whatever it had
 * been when the account was made — typed into a `.env` by whoever installed
 * the instance, or chosen by a colleague — and nothing could change it.
 *
 * Separate from the administrator list on purpose. That page is about other
 * people and hands their ids to the server; this one has no id at all, because
 * the account it changes is the one the session names. A page that could do
 * both would be a page where the wrong row is one bug away.
 *
 * What is **not** here is a way out for somebody who has forgotten their
 * password. A reset link goes to an address, and an organizer's address is the
 * one this instance sends its own mail *from* — an instance whose mail is
 * misconfigured would be handing out a door nobody can reach. The sentence
 * under the form says so rather than leaving the absence to be discovered.
 */
@Component({
  selector: 'trefaro-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <h1>{{ 'admin.account.title' | transloco }}</h1>

    @if (auth.admin(); as admin) {
      <p class="who">
        {{
          'admin.account.signedInAs'
            | transloco: { name: admin.name, email: admin.email }
        }}
      </p>
    }

    <h2>{{ 'admin.account.passwordHeading' | transloco }}</h2>
    <p class="lead">{{ 'admin.account.passwordLead' | transloco }}</p>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.reason; as reason) {
          <span class="error__detail">{{
            reason.code | transloco: reason.params
          }}</span>
        }
      </p>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <label for="current-password">
        {{ 'admin.account.current' | transloco }}
      </label>
      <input
        id="current-password"
        type="password"
        formControlName="currentPassword"
        autocomplete="current-password"
        required
      />

      <label for="new-password">{{ 'admin.account.new' | transloco }}</label>
      <input
        id="new-password"
        type="password"
        formControlName="newPassword"
        autocomplete="new-password"
        [attr.minlength]="minPasswordLength"
        [attr.maxlength]="maxPasswordLength"
        required
      />
      <small>
        {{
          'admin.admins.passwordHint' | transloco: { count: minPasswordLength }
        }}
      </small>

      <button type="submit" [disabled]="busy()">
        {{
          (busy() ? 'admin.account.working' : 'admin.account.submit')
            | transloco
        }}
      </button>

      @if (changed()) {
        <p class="done" role="status">
          {{ 'admin.account.done' | transloco }}
        </p>
      }
    </form>

    <p class="note">{{ 'admin.account.noReset' | transloco }}</p>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      inline-size: min(24rem, 100%);
    }

    label {
      font-weight: 600;
      margin-block-start: 0.5rem;
    }

    input {
      padding: 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    button[type='submit'] {
      margin-block-start: 1rem;
      align-self: start;
      padding: 0.55rem 0.9rem;
      border: 0;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .who,
    .lead {
      max-inline-size: 42rem;
    }

    .note {
      max-inline-size: 42rem;
      margin-block-start: 2rem;
      padding-inline-start: 0.8rem;
      border-inline-start: 3px solid
        color-mix(in oklab, currentColor 25%, transparent);
      color: var(--trefaro-color-text-muted, #555555);
    }

    .done {
      color: var(--trefaro-color-primary-strong, #14352c);
      font-weight: 600;
    }

    .error {
      color: #a3341f;
    }
  `,
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly maxPasswordLength = MAX_PASSWORD_LENGTH;
  protected readonly busy = signal(false);
  protected readonly changed = signal(false);
  protected readonly error = signal<Problem | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: [
      '',
      [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
    ],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.changed.set(false);
    try {
      await this.auth.changePassword(this.form.getRawValue());
      // Emptied rather than left standing: two boxes still holding a
      // passphrase after it has been changed are two boxes on a screen that
      // an organizer client is often left open on.
      this.form.reset();
      this.changed.set(true);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.account.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
