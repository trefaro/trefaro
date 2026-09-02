import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormRecord,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  MAX_ACTIVITY_AREAS_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PROFILE_SEARCH_MODULE_KEY,
  type ParticipantProfileUpdate,
  type ProfileFieldPublic,
} from '@trefaro/shared-models';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';
import { CustomField } from '../../features/fields/custom-field';
import {
  fillAnswers,
  syncAnswers,
  type AnswerControl,
} from '../../features/fields/field-answers';
import { AvatarField } from '../../features/profiles/avatar-field';
import { ParticipantProfileService } from '../../features/profiles/participant-profile.service';

/**
 * The participant's own profile (FR 4.3, UC 09).
 *
 * Four things on one screen, because they are one subject to the person in
 * front of it, and three requests behind it, because they are three writes to
 * the server: the picture is written the moment it is sent (F116), the password
 * needs the old one and ends every other session, and the form itself is a
 * `PATCH`.
 *
 * The address is shown and not editable. It is the identity of this person
 * across the instance (E31) — their registrations are found by it — so
 * changing it would cut their history rather than carry it along, and the
 * sentence under the field says so instead of a disabled input saying nothing.
 *
 * `searchable` arrived with AP 5, and only where it means something: the box is
 * drawn when the `profile-search` module is on. Until AP 5 it was deliberately
 * absent, because a switch promising "other participants can find and write to
 * you" while nobody can search would have been a promise this instance does not
 * keep (F142) — and the same argument applies to an instance that switched the
 * directory off, which is why the box follows the module rather than the code.
 *
 * It sits at the end of the form, under the answers it publishes, because that
 * is what its sentence is about: the switch decides who may read everything
 * above it.
 */
@Component({
  selector: 'trefaro-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarField, CustomField, ReactiveFormsModule, TranslocoPipe],
  template: `
    <h1>{{ 'profile.title' | transloco }}</h1>

    @if (account(); as me) {
      <trefaro-avatar-field
        [currentUrl]="me.avatarUrl"
        [firstName]="me.firstName"
        [lastName]="me.lastName"
        (changed)="avatarChanged($event)"
      />

      @if (error(); as problem) {
        <p class="notice" role="alert">
          {{ problem.key | transloco }}
          @if (problem.detail; as detail) {
            <span class="notice__detail">{{ detail }}</span>
          }
        </p>
      }

      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <fieldset [disabled]="busy()">
          <legend>{{ 'profile.about' | transloco }}</legend>

          <label>
            <span>{{ 'profile.firstName' | transloco }} *</span>
            <input formControlName="firstName" autocomplete="given-name" />
          </label>
          <label>
            <span>{{ 'profile.lastName' | transloco }} *</span>
            <input formControlName="lastName" autocomplete="family-name" />
          </label>

          <div class="fixed">
            <span class="fixed__label">
              {{ 'profile.email' | transloco }}
            </span>
            <span class="fixed__value">{{ me.email }}</span>
            <small class="hint">{{ 'profile.emailFixed' | transloco }}</small>
          </div>

          <label>
            <span>{{ 'profile.language' | transloco }}</span>
            <select formControlName="preferredLocale">
              @for (locale of localeOptions(); track locale) {
                <option [value]="locale">{{ languageName(locale) }}</option>
              }
            </select>
          </label>
          <small class="hint">{{ 'profile.languageHint' | transloco }}</small>

          <label>
            <span>{{ 'profile.activityAreas' | transloco }}</span>
            <input
              formControlName="activityAreas"
              [attr.maxlength]="maxActivityAreasLength"
            />
          </label>
          <small class="hint">
            {{ 'profile.activityAreasHint' | transloco }}
          </small>

          @for (field of fields(); track field.key) {
            <!-- The same component the registration form draws its questions
                 with (E35): what an organization asks about a person is a field
                 kit, and there is one way of drawing one. -->
            <trefaro-custom-field
              [field]="field"
              [control]="answers.controls[field.key]"
            />
          }

          @if (searchEnabled()) {
            <label class="tick">
              <input type="checkbox" formControlName="searchable" />
              <span>{{ 'profile.searchable' | transloco }}</span>
            </label>
            <small class="hint">
              {{ 'profile.searchableHint' | transloco }}
            </small>
          }

          <div class="actions">
            <button type="submit">
              {{ (busy() ? 'profile.saving' : 'profile.save') | transloco }}
            </button>
            @if (saved()) {
              <span class="done" role="status">
                {{ 'profile.saved' | transloco }}
              </span>
            }
          </div>
        </fieldset>
      </form>

      <form
        class="password"
        [formGroup]="passwordForm"
        (ngSubmit)="changePassword()"
        novalidate
      >
        <fieldset [disabled]="passwordBusy()">
          <legend>{{ 'profile.changePassword.heading' | transloco }}</legend>
          <p class="hint">{{ 'profile.changePassword.lead' | transloco }}</p>

          @if (passwordError(); as problem) {
            <p class="notice" role="alert">
              {{ problem.key | transloco }}
              @if (problem.detail; as detail) {
                <span class="notice__detail">{{ detail }}</span>
              }
            </p>
          }

          <label>
            <span>{{ 'profile.changePassword.current' | transloco }}</span>
            <input
              formControlName="currentPassword"
              type="password"
              autocomplete="current-password"
            />
          </label>
          <label>
            <span>{{ 'profile.changePassword.new' | transloco }}</span>
            <input
              formControlName="newPassword"
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

          <div class="actions">
            <button type="submit">
              {{
                (passwordBusy()
                  ? 'profile.changePassword.working'
                  : 'profile.changePassword.submit'
                ) | transloco
              }}
            </button>
            @if (passwordChanged()) {
              <span class="done" role="status">
                {{ 'profile.changePassword.done' | transloco }}
              </span>
            }
          </div>
        </fieldset>
      </form>
    }
  `,
  styles: `
    :host {
      display: block;
      max-inline-size: 34rem;
    }

    trefaro-avatar-field {
      display: block;
      margin-block-end: 2rem;
    }

    form {
      margin-block-end: 2rem;
    }

    fieldset {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    legend {
      padding: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    label > span {
      font-weight: 600;
    }

    input,
    select {
      padding: 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    .fixed {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .fixed__label {
      font-weight: 600;
    }

    .tick {
      flex-direction: row;
      align-items: baseline;
      gap: 0.5rem;
    }

    .tick input {
      inline-size: auto;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      flex-wrap: wrap;
    }

    button {
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
      margin: 0;
      margin-block-start: -0.5rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    .done {
      font-weight: 600;
    }
  `,
})
export class ProfilePage {
  private readonly session = inject(ParticipantSessionService);
  private readonly profiles = inject(ParticipantProfileService);
  private readonly i18n = inject(TranslationService);
  private readonly config = inject(AppConfigService);

  protected readonly maxActivityAreasLength = MAX_ACTIVITY_AREAS_LENGTH;
  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly maxPasswordLength = MAX_PASSWORD_LENGTH;

  protected readonly account = this.session.participant;

  /**
   * Whether this instance runs a participant directory (FR 4.4, F142).
   *
   * The opt-in is only shown where something reads it. On an instance with
   * `profile-search` switched off the column keeps whatever it holds (E14) —
   * switching a module off deletes nothing — but the form neither promises nor
   * withdraws a visibility that does not exist here.
   */
  protected readonly searchEnabled = computed(() =>
    this.config.isModuleEnabled(PROFILE_SEARCH_MODULE_KEY),
  );

  /** The questions this instance asks (E35), in form order. */
  protected readonly fields = signal<readonly ProfileFieldPublic[]>([]);
  /**
   * Whether the questions were actually read.
   *
   * Not the same as "there are none", and the difference decides whether the
   * answers are sent at all: `customFields` is the *complete* set when it is
   * there, so sending `{}` because the list could not be fetched would erase
   * every answer this person has given and fail on the first required question.
   */
  private readonly fieldsLoaded = signal(false);
  /**
   * Which profile the two halves of the form have been filled for.
   *
   * Two marks rather than one, because the two halves become fillable at
   * different moments and the profile's own fields must not wait for the
   * questions: if the definitions cannot be read, somebody has to be able to
   * correct their name anyway — an unfilled required field would otherwise make
   * the whole form unsubmittable over an unrelated failure.
   *
   * Set before filling, and never again for the same profile: saving replaces
   * the account, and re-filling then would overwrite whatever has been typed
   * since.
   */
  private filledFor: string | null = null;
  private answersFilledFor: string | null = null;

  protected readonly error = signal<Problem | null>(null);
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);

  protected readonly passwordError = signal<Problem | null>(null);
  protected readonly passwordBusy = signal(false);
  protected readonly passwordChanged = signal(false);

  protected readonly answers = new FormRecord<AnswerControl>({});

  private readonly builder = inject(FormBuilder);

  protected readonly form = this.builder.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    preferredLocale: [''],
    activityAreas: ['', Validators.maxLength(MAX_ACTIVITY_AREAS_LENGTH)],
    searchable: [false],
    customFields: this.answers,
  });

  protected readonly passwordForm = this.builder.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: [
      '',
      [
        Validators.required,
        Validators.minLength(MIN_PASSWORD_LENGTH),
        Validators.maxLength(MAX_PASSWORD_LENGTH),
      ],
    ],
  });

  /**
   * The languages this profile may be written to in.
   *
   * What the instance offers, plus whatever this profile is set to — a language
   * an organization has since withdrawn is still the language somebody chose,
   * and a select that silently dropped it would change their mail language the
   * next time they corrected their name.
   */
  protected readonly localeOptions = computed<readonly string[]>(() => {
    const offered = this.i18n.availableLocales();
    const own = this.account()?.preferredLocale;
    return own && !offered.includes(own) ? [...offered, own] : offered;
  });

  constructor() {
    effect(() => {
      void this.loadFields();
    });

    // The profile's own fields, as soon as there is a profile.
    effect(() => {
      const me = this.account();
      if (!me || this.filledFor === me.id) return;
      this.filledFor = me.id;
      this.form.patchValue({
        firstName: me.firstName,
        lastName: me.lastName,
        preferredLocale: me.preferredLocale,
        activityAreas: me.activityAreas ?? '',
        searchable: me.searchable,
      });
    });

    // The answers, once the questions they belong to are known as well.
    effect(() => {
      const me = this.account();
      if (!me || !this.fieldsLoaded()) return;
      if (this.answersFilledFor === me.id) return;
      this.answersFilledFor = me.id;
      fillAnswers(this.answers, this.fields(), me.customFields);
    });
  }

  /**
   * The name of a language, in the language of the reader.
   *
   * A method rather than a memoized `computed()`, so it is re-read after a
   * language change — `Intl.DisplayNames` answers differently then, and a
   * cached value would keep the old wording (F72).
   */
  protected languageName(locale: string): string {
    return this.i18n.languageName(locale);
  }

  protected avatarChanged(avatarUrl: string | null): void {
    const me = this.account();
    if (me) this.session.adopt({ ...me, avatarUrl });
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.saved.set(false);

    const raw = this.form.getRawValue();
    const update: ParticipantProfileUpdate = {
      firstName: raw.firstName,
      lastName: raw.lastName,
      preferredLocale: raw.preferredLocale,
      // An empty box means "no longer stated" rather than the empty string.
      activityAreas: raw.activityAreas.trim() || null,
      // Only where the box was on screen. An instance with the directory
      // switched off must not have its participants' opt-in rewritten by a
      // form that never asked about it — the control would send its own
      // default and quietly withdraw somebody's visibility.
      ...(this.searchEnabled() ? { searchable: raw.searchable } : {}),
      // Only when the definitions were read — see `fieldsLoaded`.
      ...(this.fieldsLoaded() ? { customFields: raw.customFields } : {}),
    };

    try {
      // Adopted rather than merged: the server owns what a profile is, down to
      // which answers it kept.
      this.session.adopt(await this.profiles.update(update));
      this.saved.set(true);
    } catch (error: unknown) {
      // The server's reason names the question that was refused, and no key
      // here can do that (F77).
      this.error.set(problemOf(error, 'profile.errorSave'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async changePassword(): Promise<void> {
    if (this.passwordForm.invalid || this.passwordBusy()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.passwordBusy.set(true);
    this.passwordError.set(null);
    this.passwordChanged.set(false);

    try {
      await this.profiles.changePassword(this.passwordForm.getRawValue());
      // Emptied, not left standing: two password boxes still holding a
      // passphrase after it has been changed are two boxes on a shared screen.
      this.passwordForm.reset();
      this.passwordChanged.set(true);
    } catch (error: unknown) {
      this.passwordError.set(problemOf(error, 'profile.changePassword.failed'));
    } finally {
      this.passwordBusy.set(false);
    }
  }

  /**
   * Reads the questions and builds the controls for them.
   *
   * On failure the questions are left out rather than the page: name, language
   * and field of activity are the profile's own fields and always work, and the
   * answers already given are not touched by a form that could not ask about
   * them.
   */
  private async loadFields(): Promise<void> {
    try {
      const fields = await this.profiles.fields();
      // Controls before the list: the template reads a control per field, and
      // the two must never be one render apart.
      syncAnswers(this.answers, fields);
      this.fields.set(fields);
      this.fieldsLoaded.set(true);
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'profile.errorLoad'));
    }
  }
}
