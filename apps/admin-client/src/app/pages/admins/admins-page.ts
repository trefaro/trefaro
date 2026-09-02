import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  MIN_PASSWORD_LENGTH,
  formatInstant,
  localTimeZone,
} from '@trefaro/shared-models';
import { AdminAccountsService } from '../../features/admins/admin-accounts.service';
import { AuthService } from '../../features/auth/auth.service';

/**
 * Administrator accounts (FR 1.2).
 *
 * Your own account has no delete button: the server refuses it anyway, and that
 * refusal is what keeps an instance from ending up with no administrator at all.
 *
 * The one timestamp on this page is not an event's, so it is shown in the
 * reader's own zone rather than in one hanging off a record (E8 is about event
 * times); the language it is written in is the reader's too (F78).
 */
@Component({
  selector: 'trefaro-admins-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <h1>{{ 'admin.admins.title' | transloco }}</h1>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    <table>
      <thead>
        <tr>
          <th>{{ 'admin.admins.name' | transloco }}</th>
          <th>{{ 'admin.admins.email' | transloco }}</th>
          <th>{{ 'admin.admins.lastLogin' | transloco }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (account of accounts.accounts(); track account.id) {
          <tr>
            <td>{{ account.name }}</td>
            <td>{{ account.email }}</td>
            <td>
              @if (account.lastLoginAt; as at) {
                {{ when(at) }}
              } @else {
                {{ 'admin.admins.never' | transloco }}
              }
            </td>
            <td>
              @if (account.id === ownId()) {
                <span class="self">{{ 'admin.admins.you' | transloco }}</span>
              } @else {
                <button type="button" (click)="remove(account)">
                  {{ 'admin.common.delete' | transloco }}
                </button>
              }
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="4">
              {{
                (accounts.isLoading() ? 'common.loading' : 'admin.admins.empty')
                  | transloco
              }}
            </td>
          </tr>
        }
      </tbody>
    </table>

    <h2>{{ 'admin.admins.addHeading' | transloco }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="new-name">{{ 'admin.admins.name' | transloco }}</label>
      <input id="new-name" formControlName="name" required />

      <label for="new-email">{{ 'admin.admins.email' | transloco }}</label>
      <input
        id="new-email"
        type="email"
        formControlName="email"
        autocapitalize="none"
        spellcheck="false"
        required
      />

      <label for="new-password">
        {{ 'admin.admins.password' | transloco }}
      </label>
      <input
        id="new-password"
        type="password"
        formControlName="password"
        autocomplete="new-password"
        required
      />
      <small>
        {{
          'admin.admins.passwordHint' | transloco: { count: minPasswordLength }
        }}
      </small>

      <button type="submit" [disabled]="busy()">
        {{ 'admin.admins.create' | transloco }}
      </button>
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
  protected readonly error = signal<Problem | null>(null);

  private readonly i18n = inject(TranslationService);
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
      this.error.set(problemOf(error, 'admin.admins.errorCreate'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(account: { id: string; name: string }): Promise<void> {
    const question = this.i18n.translate('admin.admins.confirmDelete', {
      name: account.name,
    });
    if (!confirm(question)) return;

    this.error.set(null);
    try {
      await this.accounts.remove(account.id);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.admins.errorDelete'));
    }
  }

  /**
   * A method rather than a `computed()`: it takes an argument, and the pipes on
   * this page mark the view when the language changes, so it is re-evaluated
   * with it (F72).
   */
  protected when(iso: string): string {
    // The reader's own zone: a sign-in belongs to no event, and E8 is about
    // event times.
    return formatInstant(iso, localTimeZone(), this.i18n.locale());
  }

  private async load(): Promise<void> {
    try {
      await this.accounts.reload();
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.admins.errorLoad'));
    }
  }
}
