import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@trefaro/shared-models';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';

/**
 * Creating a participant account (FR 4.1, UC 09).
 *
 * The form says the same thing whatever the address turns out to be: unknown,
 * waiting for a confirmation it never got, or long since in use (E32). What
 * differs is the mail that goes out, and only its recipient reads it — an
 * address that already has an account gets a message pointing at the login
 * rather than a second confirmation link.
 *
 * That is also why a second submission is a way forward rather than an error:
 * somebody who lost the confirmation mail fills the form in again and gets
 * another link.
 *
 * The language the form was filled in travels with it, so the confirmation mail
 * arrives in it (F90) — not the instance's default, which would write to
 * somebody in a language they did not choose.
 */
@Component({
  selector: 'trefaro-profile-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    @if (sentTo(); as address) {
      <section class="done">
        <h1>{{ 'profile.register.done.title' | transloco }}</h1>
        <!-- One key for the whole sentence, with the address in it: a sentence
             built around an element is three fragments to whoever translates it
             (F79). -->
        <p>{{ 'profile.register.done.sentTo' | transloco: { address } }}</p>
        <p class="hint">{{ 'profile.register.done.noMail' | transloco }}</p>
        <p>
          <a routerLink="/">{{ 'app.nav.series' | transloco }}</a>
        </p>
      </section>
    } @else {
      <h1>{{ 'profile.register.title' | transloco }}</h1>
      <p class="lead">{{ 'profile.register.lead' | transloco }}</p>

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
            <span>{{ 'profile.firstName' | transloco }} *</span>
            <input formControlName="firstName" autocomplete="given-name" />
          </label>
          <label>
            <span>{{ 'profile.lastName' | transloco }} *</span>
            <input formControlName="lastName" autocomplete="family-name" />
          </label>
          <label>
            <span>{{ 'profile.email' | transloco }} *</span>
            <input
              formControlName="email"
              type="email"
              inputmode="email"
              autocomplete="email"
            />
          </label>
          <small class="hint">{{ 'profile.emailFixed' | transloco }}</small>
          <label>
            <span>{{ 'profile.password' | transloco }} *</span>
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
              (busy() ? 'profile.register.working' : 'profile.register.title')
                | transloco
            }}
          </button>
        </fieldset>
      </form>

      <p class="alternative">
        {{ 'profile.register.haveAccount' | transloco }}
        <a routerLink="/profile/login">
          {{ 'profile.login.title' | transloco }}
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
      margin-block-start: -0.5rem;
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
export class ProfileRegisterPage {
  private readonly session = inject(ParticipantSessionService);
  private readonly i18n = inject(TranslationService);

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly maxPasswordLength = MAX_PASSWORD_LENGTH;

  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  /** Set once the form went through; the address the link was sent to. */
  protected readonly sentTo = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
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

    const raw = this.form.getRawValue();
    try {
      const answer = await this.session.register({
        email: raw.email,
        password: raw.password,
        firstName: raw.firstName,
        lastName: raw.lastName,
        preferredLocale: this.i18n.locale(),
      });
      this.sentTo.set(answer.email);
    } catch (error: unknown) {
      // The server's reason stays beside this client's sentence (F77): "no mail
      // could be sent" is the difference between trying again and telling
      // somebody at the organization.
      this.error.set(problemOf(error, 'profile.register.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
