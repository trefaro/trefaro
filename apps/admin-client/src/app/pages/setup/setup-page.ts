import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import type { ApiError } from '@trefaro/shared-http';
import type { SetupState } from '@trefaro/shared-models';
import {
  HEX_COLOR_PATTERN,
  MAX_ORGANIZATION_NAME_LENGTH,
} from '@trefaro/shared-models';
import { ThemeService } from '@trefaro/shared-theming';
import { SetupService } from '../../features/setup/setup.service';

/** Mirrors MIN_ADMIN_PASSWORD_LENGTH on the server; the server is the authority. */
const MIN_PASSWORD_LENGTH = 12;

/**
 * First-run setup of a fresh instance (FR 1.1, UC 02, AP 5 of phase 2).
 *
 * The first screen an organization ever sees, and the only one that exists
 * before there is anybody to log in as. Three steps, and each is a step for a
 * reason:
 *
 * 1. **The token.** A fresh instance answers on its port before the operator
 *    opens a browser, so the first question is "are you the one who started
 *    this?" — answered by pasting the token out of the server log (E28). It is
 *    its own step because it is a different kind of question: the operator has
 *    to go and find something.
 * 2. **The form.** The account, the organization's name, its language and the
 *    two brand colours, prefilled with what the instance was seeded with, so an
 *    organization that only wants a name typed types a name. Everything else has
 *    a page of its own afterwards — the font, the logo, the modules — which is
 *    why they are not here.
 * 3. **Done.** Deliberately not a workspace: the operator signs in, and a
 *    deployment that cannot hold a `Secure` cookie says so right there (E2)
 *    rather than three pages later.
 *
 * The deployment findings from the server are shown on the second step, not
 * hidden behind a link: "no mail server" and "no TLS" are worth reading before
 * the first participant registers, and this is the one moment the operator is
 * certainly present.
 */
@Component({
  selector: 'trefaro-setup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="setup">
      <div class="card">
        <h1>Set up this instance</h1>

        @if (done()) {
          <p class="lead" role="status">
            <strong>{{ done()?.organizationName }}</strong> is set up.
            <em>{{ done()?.adminEmail }}</em> can now sign in.
          </p>
          <p class="meta">
            If signing in does not work from another machine, this instance is
            being served over plain HTTP: the session cookie is marked
            <code>Secure</code>, and a browser stores such a cookie only over
            HTTPS. See <code>docs/INSTALL.md</code>.
          </p>
          <button type="button" (click)="goToLogin()">Go to sign in</button>
        } @else if (state()) {
          <p class="lead">
            One form: the first administrator, and what this instance calls
            itself. Everything else — the font, the logo, the modules — has a
            page of its own once you are signed in.
          </p>

          @if (state()!.warnings.length > 0) {
            <section class="findings" aria-labelledby="findings-heading">
              <h2 id="findings-heading">Worth knowing about this deployment</h2>
              <ul>
                @for (warning of state()!.warnings; track warning) {
                  <li>{{ warning }}</li>
                }
              </ul>
              <p class="meta">
                None of these stops the setup. They are the values whose absence
                only shows up later — the same list the server logs on startup.
              </p>
            </section>
          }

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <fieldset [disabled]="busy()">
              <legend>Your account</legend>

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

              <!-- "Your name", not "Name": the organization has a name too, and
                   two fields with the same accessible name on one form are two
                   fields a screen reader cannot tell apart (NFR 4). -->
              <label for="name">Your name</label>
              <input
                id="name"
                formControlName="name"
                autocomplete="name"
                required
              />

              <label for="password">Password</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                aria-describedby="password-hint"
                autocomplete="new-password"
                required
              />
              <small id="password-hint" class="meta">
                At least {{ minPasswordLength }} characters. Length only — a
                long passphrase beats a short password with a symbol in it.
              </small>
            </fieldset>

            <fieldset [disabled]="busy()">
              <legend>Your organization</legend>

              <label for="organization-name">Organization name</label>
              <input
                id="organization-name"
                formControlName="organizationName"
                aria-describedby="organization-name-hint"
                [attr.maxlength]="maxNameLength"
                autocomplete="organization"
                required
              />
              <small id="organization-name-hint" class="meta">
                Shown in both clients, in page titles and in every mail.
              </small>

              <label for="default-locale">Language</label>
              <select
                id="default-locale"
                formControlName="defaultLocale"
                aria-describedby="default-locale-hint"
              >
                @for (locale of state()!.locales; track locale) {
                  <option [value]="locale">{{ languageName(locale) }}</option>
                }
              </select>
              <small id="default-locale-hint" class="meta">
                The language of outgoing mail and of dates. English is always
                available beside it.
              </small>

              <div class="colours">
                <div class="field">
                  <label for="primary-color">Primary colour</label>
                  <input
                    id="primary-color"
                    type="color"
                    formControlName="primaryColor"
                  />
                </div>
                <div class="field">
                  <label for="accent-color">Accent colour</label>
                  <input
                    id="accent-color"
                    type="color"
                    formControlName="accentColor"
                  />
                </div>
              </div>
              <small class="meta">
                Both can be changed later under Design, with a live preview and
                a legibility check.
              </small>
            </fieldset>

            <button type="submit" [disabled]="busy()">
              {{ busy() ? 'Setting up…' : 'Create administrator' }}
            </button>
          </form>
        } @else {
          <p class="lead">
            This instance has no administrator yet. The server printed a setup
            token when it started — paste it here.
          </p>
          <p class="meta">
            <code>docker compose logs server</code> shows it. It changes on
            every restart and stops working as soon as an administrator exists.
          </p>

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <form [formGroup]="tokenForm" (ngSubmit)="unlock()">
            <fieldset [disabled]="busy()">
              <label for="token">Setup token</label>
              <input
                id="token"
                formControlName="token"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                required
              />
            </fieldset>
            <button type="submit" [disabled]="busy()">
              {{ busy() ? 'Checking…' : 'Continue' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
  styles: `
    .setup {
      display: grid;
      place-items: center;
      min-block-size: 100vh;
      padding: 1.5rem;
    }

    .card {
      inline-size: min(34rem, 100%);
      padding: 1.75rem;
      border-radius: 0.75rem;
      background: var(--trefaro-color-surface, #fff);
      box-shadow: 0 1px 3px rgb(0 0 0 / 18%);
    }

    h1 {
      margin: 0 0 0.5rem;
    }

    h2 {
      margin: 0 0 0.4rem;
      font-size: 1rem;
    }

    .lead {
      margin: 0 0 0.75rem;
    }

    .meta {
      display: block;
      margin: 0 0 0.75rem;
      color: color-mix(in oklab, currentColor 65%, transparent);
    }

    .findings {
      margin-block-end: 1.25rem;
      padding: 0.75rem 0.9rem;
      border-inline-start: 3px solid var(--trefaro-color-accent-strong, #b5761f);
      background: color-mix(in oklab, currentColor 4%, transparent);
    }

    .findings ul {
      margin: 0 0 0.5rem;
      padding-inline-start: 1.1rem;
    }

    .findings li {
      margin-block-end: 0.35rem;
    }

    fieldset {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      margin: 0 0 1.25rem;
      padding: 0.9rem 1rem 1rem;
      border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
      border-radius: 0.5rem;
    }

    legend {
      padding-inline: 0.35rem;
      font-weight: 600;
    }

    label {
      font-weight: 600;
      margin-block-start: 0.5rem;
    }

    input,
    select {
      padding: 0.55rem 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    input[type='color'] {
      padding: 0.15rem;
      block-size: 2.4rem;
    }

    .colours {
      display: flex;
      gap: 1rem;
      margin-block-start: 0.5rem;
    }

    .field {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.3rem;
    }

    button {
      padding: 0.6rem 0.9rem;
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
      margin: 0 0 0.75rem;
      color: #a3341f;
    }

    code {
      font-family: ui-monospace, monospace;
    }
  `,
})
export class SetupPage {
  protected readonly maxNameLength = MAX_ORGANIZATION_NAME_LENGTH;
  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  private readonly setup = inject(SetupService);
  private readonly config = inject(AppConfigService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<{
    adminEmail: string;
    organizationName: string;
  } | null>(null);

  /** Non-null once a token has been accepted — which is what shows the form. */
  protected readonly state = computed<SetupState | null>(() =>
    this.setup.state(),
  );

  protected readonly tokenForm = this.formBuilder.nonNullable.group({
    token: ['', Validators.required],
  });

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    name: ['', Validators.required],
    password: [
      '',
      [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
    ],
    organizationName: [
      '',
      [Validators.required, Validators.maxLength(MAX_ORGANIZATION_NAME_LENGTH)],
    ],
    defaultLocale: ['en', Validators.required],
    primaryColor: ['#1f6f5c', Validators.pattern(HEX_COLOR_PATTERN)],
    accentColor: ['#e8a33d', Validators.pattern(HEX_COLOR_PATTERN)],
  });

  protected async unlock(): Promise<void> {
    if (this.tokenForm.invalid || this.busy()) {
      this.tokenForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    try {
      const state = await this.setup.unlock(
        this.tokenForm.getRawValue().token.trim(),
      );
      // Prefilled from the instance, so nothing has to be invented to get past
      // this form.
      this.form.patchValue({
        organizationName: state.organizationName,
        defaultLocale: state.defaultLocale,
        primaryColor: state.primaryColor,
        accentColor: state.accentColor,
      });
    } catch (error: unknown) {
      this.error.set(tokenMessage(error as ApiError));
    } finally {
      this.busy.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    try {
      this.done.set(
        await this.setup.complete({
          admin: {
            email: value.email.trim(),
            name: value.name.trim(),
            password: value.password,
          },
          organizationName: value.organizationName.trim(),
          defaultLocale: value.defaultLocale,
          primaryColor: value.primaryColor,
          accentColor: value.accentColor,
        }),
      );
      // The name and the colours this client shows are now the organization's,
      // and only the server knows what it stored after trimming (E17, F60).
      const applied = await this.config.reload();
      // And repaint: the theme is applied once, in the startup initializer, so a
      // reload alone refreshes the data and leaves the document in Trefaro's
      // default green. Nothing else in this client repaints (E20) — but this
      // page is the moment an organization sees its own colour for the first
      // time, and the login form it hands over to is a route change, not a fresh
      // load.
      this.theme.apply(applied.theme);
    } catch (error: unknown) {
      this.error.set(submitMessage(error as ApiError));
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * The language's name in that language — "Deutsch", not "de".
   *
   * `Intl.DisplayNames` is part of the platform, so this needs no catalogue and
   * no download; it is the one piece of language naming that works before AP 6
   * brings the translations. An engine that cannot answer gets the tag back.
   */
  protected languageName(tag: string): string {
    try {
      return new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag;
    } catch {
      return tag;
    }
  }

  protected goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}

function tokenMessage(error: ApiError): string {
  if (error?.status === 401) {
    return 'That is not the token this server printed. It changes on every restart — check the most recent lines of the log.';
  }
  if (error?.status === 404) {
    return 'This instance already has an administrator. Sign in instead.';
  }
  return error?.message ?? 'The token could not be checked.';
}

function submitMessage(error: ApiError): string {
  if (error?.status === 404) {
    return 'This instance already has an administrator — somebody set it up in the meantime. Sign in instead.';
  }
  if (error?.status === 409) {
    return error.message;
  }
  return error?.message ?? 'The instance could not be set up.';
}
