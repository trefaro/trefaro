import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
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
 * certainly present. They stay English: the server writes them (F77).
 *
 * No language switcher here, unlike the login form. This page already asks for
 * a language — the instance's default, the one its mail goes out in — and a
 * second control beside it would be two questions that look like one.
 */
@Component({
  selector: 'trefaro-setup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <div class="setup">
      <div class="card">
        <h1>{{ 'admin.setup.title' | transloco }}</h1>

        @if (done(); as result) {
          <!-- One key for the whole sentence, so a translator can order the two
               halves as their language wants (F79); the bold and the italics
               are the price. -->
          <p class="lead" role="status">
            {{
              'admin.setup.done'
                | transloco
                  : {
                      organization: result.organizationName,
                      email: result.adminEmail,
                    }
            }}
          </p>
          <p class="meta">
            {{
              'admin.setup.doneMeta'
                | transloco
                  : { attribute: 'Secure', document: 'docs/INSTALL.md' }
            }}
          </p>
          <button type="button" (click)="goToLogin()">
            {{ 'admin.setup.goToLogin' | transloco }}
          </button>
        } @else if (state()) {
          <p class="lead">{{ 'admin.setup.lead' | transloco }}</p>

          @if (state()!.warnings.length > 0) {
            <section class="findings" aria-labelledby="findings-heading">
              <h2 id="findings-heading">
                {{ 'admin.setup.findingsHeading' | transloco }}
              </h2>
              <ul>
                @for (warning of state()!.warnings; track warning) {
                  <li>{{ warning }}</li>
                }
              </ul>
              <p class="meta">
                {{ 'admin.setup.findingsMeta' | transloco }}
              </p>
            </section>
          }

          @if (error(); as problem) {
            <p class="error" role="alert">
              {{ problem.key | transloco }}
              @if (problem.detail; as detail) {
                <span class="error__detail">{{ detail }}</span>
              }
            </p>
          }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <fieldset [disabled]="busy()">
              <legend>{{ 'admin.setup.accountLegend' | transloco }}</legend>

              <label for="email">{{ 'admin.setup.email' | transloco }}</label>
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
                   fields a screen reader cannot tell apart (NFR 4). The two
                   catalogue keys keep that apart in every language. -->
              <label for="name">{{ 'admin.setup.name' | transloco }}</label>
              <input
                id="name"
                formControlName="name"
                autocomplete="name"
                required
              />

              <label for="password">
                {{ 'admin.setup.password' | transloco }}
              </label>
              <input
                id="password"
                type="password"
                formControlName="password"
                aria-describedby="password-hint"
                autocomplete="new-password"
                required
              />
              <small id="password-hint" class="meta">
                {{
                  'admin.setup.passwordHint'
                    | transloco: { count: minPasswordLength }
                }}
              </small>
            </fieldset>

            <fieldset [disabled]="busy()">
              <legend>
                {{ 'admin.setup.organizationLegend' | transloco }}
              </legend>

              <label for="organization-name">
                {{ 'admin.setup.organizationName' | transloco }}
              </label>
              <input
                id="organization-name"
                formControlName="organizationName"
                aria-describedby="organization-name-hint"
                [attr.maxlength]="maxNameLength"
                autocomplete="organization"
                required
              />
              <small id="organization-name-hint" class="meta">
                {{ 'admin.setup.organizationNameHint' | transloco }}
              </small>

              <label for="default-locale">
                {{ 'admin.setup.language' | transloco }}
              </label>
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
                {{ 'admin.setup.languageHint' | transloco }}
              </small>

              <div class="colours">
                <div class="field">
                  <label for="primary-color">
                    {{ 'admin.setup.primaryColor' | transloco }}
                  </label>
                  <input
                    id="primary-color"
                    type="color"
                    formControlName="primaryColor"
                  />
                </div>
                <div class="field">
                  <label for="accent-color">
                    {{ 'admin.setup.accentColor' | transloco }}
                  </label>
                  <input
                    id="accent-color"
                    type="color"
                    formControlName="accentColor"
                  />
                </div>
              </div>
              <small class="meta">
                {{ 'admin.setup.coloursHint' | transloco }}
              </small>
            </fieldset>

            <button type="submit" [disabled]="busy()">
              {{
                (busy() ? 'admin.setup.submitting' : 'admin.setup.submit')
                  | transloco
              }}
            </button>
          </form>
        } @else {
          <p class="lead">{{ 'admin.setup.tokenLead' | transloco }}</p>
          <p class="meta">
            {{
              'admin.setup.tokenMeta'
                | transloco: { command: 'docker compose logs server' }
            }}
          </p>

          @if (error(); as problem) {
            <p class="error" role="alert">
              {{ problem.key | transloco }}
              @if (problem.detail; as detail) {
                <span class="error__detail">{{ detail }}</span>
              }
            </p>
          }

          <form [formGroup]="tokenForm" (ngSubmit)="unlock()">
            <fieldset [disabled]="busy()">
              <label for="token">{{ 'admin.setup.token' | transloco }}</label>
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
              {{
                (busy()
                  ? 'admin.setup.tokenChecking'
                  : 'admin.setup.tokenSubmit'
                ) | transloco
              }}
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
  protected readonly error = signal<Problem | null>(null);
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
      this.error.set(tokenProblem(error as ApiError));
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
      this.error.set(submitProblem(error as ApiError));
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

/**
 * The two statuses are the contract of this route (F64), so this client says
 * what they mean itself and shows no server text beside it: 401 is "the token
 * is wrong", 404 is "there is an administrator already".
 */
function tokenProblem(error: ApiError): Problem {
  if (error?.status === 401) {
    return { key: 'admin.setup.errorToken', detail: null };
  }
  if (error?.status === 404) {
    return { key: 'admin.setup.errorClaimed', detail: null };
  }
  return problemOf(error, 'admin.setup.errorTokenGeneric');
}

/**
 * A 409 is a value the server refused — a short password, a name it will not
 * store — and its reason is the only thing that says which. It arrives beside
 * this client's sentence rather than instead of it (F77).
 */
function submitProblem(error: ApiError): Problem {
  if (error?.status === 404) {
    return { key: 'admin.setup.errorClaimedMeanwhile', detail: null };
  }
  return problemOf(error, 'admin.setup.error');
}
