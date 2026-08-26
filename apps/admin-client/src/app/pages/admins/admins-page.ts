import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ApiError } from '@trefaro/shared-http';
import { AdminAccountsService } from '../../features/admins/admin-accounts.service';
import { AuthService } from '../../features/auth/auth.service';

/** Mirrors MIN_ADMIN_PASSWORD_LENGTH on the server; the server is the authority. */
const MIN_PASSWORD_LENGTH = 12;

/**
 * Administrator accounts (FR 1.2).
 *
 * Your own account has no delete button: the server refuses it anyway, and that
 * refusal is what keeps an instance from ending up with no administrator at all.
 */
@Component({
  selector: 'trefaro-admins-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <h1>Administrators</h1>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>E-mail address</th>
          <th>Last sign-in</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (account of accounts.accounts(); track account.id) {
          <tr>
            <td>{{ account.name }}</td>
            <td>{{ account.email }}</td>
            <td>
              {{
                account.lastLoginAt
                  ? (account.lastLoginAt | date: 'medium')
                  : 'never'
              }}
            </td>
            <td>
              @if (account.id === ownId()) {
                <span class="self">you</span>
              } @else {
                <button type="button" (click)="remove(account)">Delete</button>
              }
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="4">
              {{ accounts.isLoading() ? 'Loading…' : 'No accounts.' }}
            </td>
          </tr>
        }
      </tbody>
    </table>

    <h2>Add an administrator</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="new-name">Name</label>
      <input id="new-name" formControlName="name" required />

      <label for="new-email">E-mail address</label>
      <input
        id="new-email"
        type="email"
        formControlName="email"
        autocapitalize="none"
        spellcheck="false"
        required
      />

      <label for="new-password">Password</label>
      <input
        id="new-password"
        type="password"
        formControlName="password"
        autocomplete="new-password"
        required
      />
      <small>
        At least {{ minPasswordLength }} characters. A long passphrase beats a
        short password with a symbol in it.
      </small>

      <button type="submit" [disabled]="busy()">Create account</button>
    </form>
  `,
  styles: `
    table {
      border-collapse: collapse;
      inline-size: 100%;
      margin-block-end: 2rem;
    }

    th,
    td {
      padding: 0.5rem 0.6rem;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 15%, transparent);
      text-align: start;
    }

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

    .self {
      color: color-mix(in oklab, currentColor 60%, transparent);
    }

    .error {
      color: #a3341f;
    }
  `,
})
export class AdminsPage {
  protected readonly accounts = inject(AdminAccountsService);
  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly auth = inject(AuthService);
  protected readonly ownId = computed(() => this.auth.admin()?.id ?? null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
    ],
  });

  constructor() {
    void this.load();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      await this.accounts.create(this.form.getRawValue());
      this.form.reset();
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.message ?? 'Creating the account failed.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(account: { id: string; name: string }): Promise<void> {
    if (!confirm(`Delete the account of ${account.name}?`)) return;

    this.error.set(null);
    try {
      await this.accounts.remove(account.id);
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.message ?? 'Deleting the account failed.',
      );
    }
  }

  private async load(): Promise<void> {
    try {
      await this.accounts.reload();
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.message ?? 'Loading the accounts failed.',
      );
    }
  }
}
